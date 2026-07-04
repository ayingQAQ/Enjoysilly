import "fake-indexeddb/auto";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { openMySillyDatabase, savePreset, type StoredPreset } from "../lib/db";
import { parseChatCompletionPresetJson } from "../lib/presetIO";
import { importPresetToDatabase } from "./presetImport";
import {
  createRegexCatalogSummary,
  loadRegexCatalogSummary,
} from "./regexCatalog";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_regex_catalog_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

function findNativePresetFixture(): string {
  const fileName = readdirSync(fixturesDir).find((name) => {
    if (!name.endsWith(".json")) {
      return false;
    }

    try {
      const preset = parseChatCompletionPresetJson(
        readFileSync(join(fixturesDir, name), "utf8"),
      );

      return preset.extensions?.regex_scripts?.length === 10;
    } catch {
      return false;
    }
  });

  if (!fileName) {
    throw new Error("Missing native preset fixture with regex_scripts.");
  }

  return join(fixturesDir, fileName);
}

describe("regex catalog service", () => {
  it("aggregates regex metadata from stored presets without executing scripts", () => {
    const summary = createRegexCatalogSummary([
      createStoredPreset({
        id: "older",
        name: "旧预设",
        updatedAt: "2026-07-04T08:00:00.000Z",
        regexScripts: [
          {
            id: "script-a",
            scriptName: "清理输出",
            findRegex: "/hello\\s+world/g",
            replaceString: "hi",
            trimStrings: [" "],
            placement: [1, 2],
            disabled: true,
            markdownOnly: true,
            promptOnly: true,
            runOnEdit: true,
            substituteRegex: 1,
            minDepth: null,
            maxDepth: 8,
            unknown_regex_field: "keep",
          },
        ],
      }),
      createStoredPreset({
        id: "newer",
        name: "新预设",
        updatedAt: "2026-07-04T09:00:00.000Z",
        regexScripts: [
          {
            scriptName: "输入处理",
            findRegex: "/input/g",
            replaceString: "output",
            placement: [0],
            disabled: false,
          },
        ],
      }),
    ]);

    expect(summary).toMatchObject({
      totalPresetCount: 2,
      presetWithRegexCount: 2,
      scriptCount: 2,
      enabledScriptCount: 1,
      disabledScriptCount: 1,
      runOnEditCount: 1,
      promptOnlyCount: 1,
      markdownOnlyCount: 1,
    });
    expect(summary.items.map((item) => item.sourcePresetName)).toEqual([
      "新预设",
      "旧预设",
    ]);
    expect(summary.items[1]).toMatchObject({
      id: "older:regex:0",
      sourcePresetId: "older",
      sourcePresetName: "旧预设",
      scriptIndex: 0,
      scriptId: "script-a",
      scriptName: "清理输出",
      disabled: true,
      placement: [1, 2],
      placementLabels: ["placement:1", "placement:2"],
      promptOnly: true,
      markdownOnly: true,
      runOnEdit: true,
      substituteRegex: 1,
      minDepth: null,
      maxDepth: 8,
      trimStringCount: 1,
      findRegexPreview: "/hello\\s+world/g",
      replaceStringPreview: "hi",
      unknownFieldNames: ["unknown_regex_field"],
    });
  });

  it("reports presets with no regex_scripts as an empty catalog", () => {
    const summary = createRegexCatalogSummary([
      {
        id: "no-regex",
        name: "无正则预设",
        createdAt: "2026-07-04T08:00:00.000Z",
        updatedAt: "2026-07-04T08:00:00.000Z",
        payload: {
          prompts: [],
          prompt_order: [],
          extensions: {},
        },
      },
    ]);

    expect(summary).toMatchObject({
      totalPresetCount: 1,
      presetWithRegexCount: 0,
      scriptCount: 0,
      enabledScriptCount: 0,
      disabledScriptCount: 0,
    });
    expect(summary.items).toEqual([]);
  });

  it("skips malformed regex entries and tolerates missing fields", () => {
    const summary = createRegexCatalogSummary([
      {
        id: "loose",
        name: "宽松预设",
        createdAt: "2026-07-04T08:00:00.000Z",
        updatedAt: "2026-07-04T08:00:00.000Z",
        payload: {
          prompts: [],
          prompt_order: [],
          extensions: {
            regex_scripts: [
              null,
              "not an object",
              {
                scriptName: 123,
                findRegex: 456,
                replaceString: false,
                placement: [1, "bad", 3],
                extraField: "keep",
              },
            ],
          },
        } as never,
      },
    ]);

    expect(summary).toMatchObject({
      totalPresetCount: 1,
      presetWithRegexCount: 1,
      scriptCount: 1,
    });
    expect(summary.items).toEqual([
      expect.objectContaining({
        scriptName: "未命名正则 #1",
        findRegex: "",
        replaceString: "",
        placement: [1, 3],
        placementLabels: ["placement:1", "placement:3"],
        unknownFieldNames: ["extraField"],
      }),
    ]);
  });

  it("loads the real native preset fixture and exposes ten regex scripts", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await importPresetToDatabase(
      readFileSync(findNativePresetFixture()),
      "preset.json",
      {
        database,
        id: "real-preset",
        name: "真实预设",
        now: () => "2026-07-04T12:30:00.000Z",
      },
    );

    const summary = await loadRegexCatalogSummary(database);

    expect(summary).toMatchObject({
      totalPresetCount: 1,
      presetWithRegexCount: 1,
      scriptCount: 10,
    });
    expect(summary.items).toHaveLength(10);
    expect(summary.items[0]).toEqual(
      expect.objectContaining({
        sourcePresetId: "real-preset",
        sourcePresetName: "真实预设",
        scriptIndex: 0,
      }),
    );
    expect(summary.items.every((item) => item.findRegex.length > 0)).toBe(true);

    database.close();
  });

  it("keeps runOnEdit as inert metadata and does not mutate original payloads", () => {
    const longRegex = `/${"very-long-pattern-".repeat(16)}/g`;
    const longReplace = `${"replace ".repeat(40)}$1`;
    const stored = createStoredPreset({
      id: "immutable",
      name: "不可变预设",
      updatedAt: "2026-07-04T09:00:00.000Z",
      regexScripts: [
        {
          scriptName: "长正则",
          findRegex: longRegex,
          replaceString: longReplace,
          runOnEdit: true,
          disabled: false,
          unknown_regex_field: {
            keep: true,
          },
        },
      ],
    });
    const before = JSON.parse(JSON.stringify(stored));

    const summary = createRegexCatalogSummary([stored]);

    expect(summary.runOnEditCount).toBe(1);
    expect(summary.items[0].runOnEdit).toBe(true);
    expect(summary.items[0].findRegexPreview).toHaveLength(140);
    expect(summary.items[0].findRegexPreview.endsWith("…")).toBe(true);
    expect(summary.items[0].replaceStringPreview).toHaveLength(140);
    expect(summary.items[0].replaceStringPreview.endsWith("…")).toBe(true);
    expect(stored).toEqual(before);
  });

  it("loads regex catalog summaries from IndexedDB", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await savePreset(
      createStoredPreset({
        id: "db-preset",
        name: "数据库预设",
        updatedAt: "2026-07-04T10:00:00.000Z",
        regexScripts: [
          {
            scriptName: "数据库正则",
            findRegex: "/db/g",
          },
        ],
      }),
      database,
    );

    await expect(loadRegexCatalogSummary(database)).resolves.toEqual(
      expect.objectContaining({
        totalPresetCount: 1,
        presetWithRegexCount: 1,
        scriptCount: 1,
      }),
    );

    database.close();
  });
});

function createStoredPreset({
  id,
  name,
  updatedAt,
  regexScripts,
}: {
  id: string;
  name: string;
  updatedAt: string;
  regexScripts: StoredPreset["payload"]["extensions"]["regex_scripts"];
}): StoredPreset {
  return {
    id,
    name,
    createdAt: updatedAt,
    updatedAt,
    payload: {
      prompts: [],
      prompt_order: [],
      extensions: {
        regex_scripts: regexScripts,
      },
    },
  };
}
