import "fake-indexeddb/auto";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { openMySillyDatabase, savePreset } from "../lib/db";
import { parseChatCompletionPresetJson } from "../lib/presetIO";
import { importPresetToDatabase } from "./presetImport";
import {
  createPresetJsonExport,
  createPresetJsonFileName,
} from "./presetExport";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_preset_export_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

function findPresetFixture(): string {
  const fileName = readdirSync(fixturesDir).find((name) =>
    name.endsWith(".json"),
  );

  if (!fileName) {
    throw new Error("Missing preset fixture.");
  }

  return join(fixturesDir, fileName);
}

describe("preset export service", () => {
  it("creates safe JSON export file names", () => {
    expect(createPresetJsonFileName(' my:preset?/\\*?"<>| ')).toBe(
      "my_preset_________.json",
    );
    expect(createPresetJsonFileName("COM1")).toBe("_COM1.json");
    expect(createPresetJsonFileName("   ")).toBe("preset.json");
    expect(createPresetJsonFileName("...")).toBe("preset.json");
  });

  it("exports a stored preset without changing payload fields", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const payload = {
      temperature: 0.7,
      prompts: [
        {
          identifier: "system",
          name: "系统",
          enabled: true,
          custom_prompt_field: "keep",
        },
      ],
      prompt_order: [
        {
          character_id: 100000,
          order: [
            {
              identifier: "system",
              enabled: true,
              custom_order_field: "keep",
            },
          ],
        },
      ],
      extensions: {
        regex_scripts: [
          {
            scriptName: "正则",
            findRegex: "/hello/g",
            custom_regex_field: "keep",
          },
        ],
        tavern_helper: {
          keep: true,
        },
      },
      root_unknown: "keep",
    };

    await savePreset(
      {
        id: "preset-1",
        name: "测试预设",
        createdAt: "2026-07-04T16:00:00.000Z",
        updatedAt: "2026-07-04T16:00:00.000Z",
        payload,
      },
      database,
    );

    const exported = await createPresetJsonExport("preset-1", database);
    const parsed = parseChatCompletionPresetJson(
      new TextDecoder().decode(exported.bytes),
    );

    expect(exported.fileName).toBe("测试预设.json");
    expect(exported.stored.name).toBe("测试预设");
    expect(parsed).toEqual(payload);
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("name");
    expect(parsed).not.toHaveProperty("createdAt");
    expect(parsed).not.toHaveProperty("updatedAt");
    expect(parsed.prompts[0]).toHaveProperty("custom_prompt_field", "keep");
    expect(parsed.prompt_order[0].order[0]).toHaveProperty(
      "custom_order_field",
      "keep",
    );
    expect(parsed.extensions?.regex_scripts?.[0]).toHaveProperty(
      "custom_regex_field",
      "keep",
    );

    database.close();
  });

  it("exports the real preset fixture without losing extension data", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    try {
      const imported = await importPresetToDatabase(
        readFileSync(findPresetFixture()),
        "preset.json",
        {
          database,
          id: "real-preset",
          name: "真实预设",
          now: () => "2026-07-04T16:05:00.000Z",
        },
      );

      const exported = await createPresetJsonExport("real-preset", database);
      const parsed = parseChatCompletionPresetJson(
        new TextDecoder().decode(exported.bytes),
      );

      expect(exported.fileName).toBe("真实预设.json");
      expect(parsed).toEqual(imported.preset);
      expect(parsed.prompts).toHaveLength(50);
      expect(parsed.prompt_order).toHaveLength(2);
      expect(parsed.extensions?.regex_scripts).toHaveLength(10);
      expect(parsed.extensions?.tavern_helper).toBeDefined();
      expect(parsed.extensions?.SPreset).toBeDefined();
    } finally {
      database.close();
    }
  });

  it("reports a missing preset export clearly", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await expect(createPresetJsonExport("missing", database)).rejects.toThrow(
      "找不到预设：missing",
    );

    database.close();
  });
});
