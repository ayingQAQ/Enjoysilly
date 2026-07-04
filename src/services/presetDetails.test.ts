import "fake-indexeddb/auto";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { openMySillyDatabase, savePreset } from "../lib/db";
import { importPresetToDatabase } from "./presetImport";
import {
  createPresetDetailSummary,
  loadPresetDetailSummary,
} from "./presetDetails";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_preset_details_${crypto.randomUUID()}`;
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

describe("preset detail summaries", () => {
  it("creates read-only summaries for prompts, order slots, and regex scripts", () => {
    const summary = createPresetDetailSummary({
      id: "preset-1",
      name: "测试预设",
      createdAt: "2026-07-04T17:00:00.000Z",
      updatedAt: "2026-07-04T17:00:00.000Z",
      payload: {
        temperature: 0.6,
        top_p: 0.95,
        top_k: 40,
        min_p: 0.05,
        openai_max_tokens: 2048,
        openai_max_context: 8192,
        stream_openai: true,
        prompts: [
          {
            identifier: "system",
            name: "系统提示",
            role: "system",
            system_prompt: true,
            enabled: true,
            content: "  这是一段\n\n系统提示，会被压缩空白用于预览。  ",
            injection_depth: 4,
            injection_order: 100,
            injection_position: 0,
            injection_trigger: ["A", "B"],
          },
          {
            identifier: "history",
            marker: true,
            enabled: false,
          },
        ],
        prompt_order: [
          {
            character_id: 100000,
            order: [
              {
                identifier: "system",
                enabled: true,
              },
              {
                identifier: "history",
                enabled: false,
              },
            ],
          },
        ],
        extensions: {
          SPreset: { keep: true },
          tavern_helper: { keep: true },
          extensions: { keep: true },
          regex_scripts: [
            {
              scriptName: "清理输出",
              findRegex: "/hello\\s+world/g",
              replaceString: "hi",
              disabled: true,
              markdownOnly: true,
              promptOnly: true,
              placement: [1, 2],
              minDepth: null,
              maxDepth: 8,
            },
          ],
        },
      },
    });

    expect(summary).toMatchObject({
      id: "preset-1",
      name: "测试预设",
      promptCount: 2,
      enabledPromptCount: 1,
      markerPromptCount: 1,
      systemPromptCount: 1,
      orderSlotCount: 1,
      orderedPromptCount: 2,
      enabledOrderedPromptCount: 1,
      regexScriptCount: 1,
      extensionFlags: {
        hasRegexScripts: true,
        hasSPreset: true,
        hasTavernHelper: true,
        hasNestedExtensions: true,
      },
      sampling: {
        temperature: 0.6,
        topP: 0.95,
        topK: 40,
        minP: 0.05,
        maxTokens: 2048,
        contextTokens: 8192,
        stream: true,
      },
    });
    expect(summary.promptPreviews).toEqual([
      expect.objectContaining({
        identifier: "system",
        displayName: "系统提示",
        role: "system",
        enabled: true,
        marker: false,
        systemPrompt: true,
        contentPreview: "这是一段 系统提示，会被压缩空白用于预览。",
        injectionDepth: 4,
        injectionOrder: 100,
        injectionPosition: 0,
        triggerCount: 2,
      }),
      expect.objectContaining({
        identifier: "history",
        displayName: "history",
        enabled: false,
        marker: true,
        contentPreview: "",
      }),
    ]);
    expect(summary.orderSlotPreviews).toEqual([
      {
        characterId: 100000,
        orderCount: 2,
        enabledOrderCount: 1,
        sampleIdentifiers: ["system", "history"],
      },
    ]);
    expect(summary.regexScriptPreviews).toEqual([
      expect.objectContaining({
        scriptName: "清理输出",
        findRegexPreview: "/hello\\s+world/g",
        replacePreview: "hi",
        disabled: true,
        promptOnly: true,
        markdownOnly: true,
        placementCount: 2,
        minDepth: null,
        maxDepth: 8,
      }),
    ]);
  });

  it("loads a real preset fixture detail summary from IndexedDB", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await importPresetToDatabase(readFileSync(findPresetFixture()), "preset.json", {
      database,
      id: "real-preset",
      name: "真实预设",
      now: () => "2026-07-04T17:10:00.000Z",
    });

    const summary = await loadPresetDetailSummary("real-preset", database);

    expect(summary.promptCount).toBe(50);
    expect(summary.orderSlotCount).toBe(2);
    expect(summary.orderedPromptCount).toBe(39);
    expect(summary.regexScriptCount).toBe(10);
    expect(summary.extensionFlags).toMatchObject({
      hasRegexScripts: true,
      hasSPreset: true,
      hasTavernHelper: true,
    });
    expect(summary.promptPreviews.length).toBeLessThanOrEqual(12);
    expect(summary.regexScriptPreviews.length).toBeLessThanOrEqual(12);

    database.close();
  });

  it("reports a missing preset detail clearly", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await expect(loadPresetDetailSummary("missing", database)).rejects.toThrow(
      "找不到预设：missing",
    );

    database.close();
  });

  it("does not mutate the stored preset payload while creating summaries", () => {
    const stored = {
      id: "preset-immutable",
      name: "不可变",
      createdAt: "2026-07-04T17:20:00.000Z",
      updatedAt: "2026-07-04T17:20:00.000Z",
      payload: {
        prompts: [
          {
            identifier: "a",
            content: "A",
          },
        ],
        prompt_order: [],
        extensions: {
          regex_scripts: [],
        },
      },
    };
    const before = JSON.parse(JSON.stringify(stored));

    createPresetDetailSummary(stored);

    expect(stored).toEqual(before);
  });

  it("truncates long previews and keeps executable regex fields as inert metadata", () => {
    const longContent = `${"prompt ".repeat(40)}{{macro_should_not_run}}`;
    const longRegex = `/${"very-long-pattern-".repeat(16)}/g`;
    const longReplace = `${"replace ".repeat(40)}$1`;
    const stored = {
      id: "preset-long",
      name: "长文本",
      createdAt: "2026-07-04T17:30:00.000Z",
      updatedAt: "2026-07-04T17:30:00.000Z",
      payload: {
        prompts: [
          {
            identifier: "long",
            content: longContent,
            unknown_prompt_field: {
              keep: true,
            },
          },
        ],
        prompt_order: [
          {
            character_id: 100001,
            order: [
              {
                identifier: "long",
                enabled: true,
                unknown_order_field: "keep",
              },
            ],
          },
        ],
        extensions: {
          regex_scripts: [
            {
              scriptName: "长正则",
              findRegex: longRegex,
              replaceString: longReplace,
              runOnEdit: true,
              disabled: false,
              unknown_regex_field: "keep",
            },
          ],
        },
      },
    };
    const before = JSON.parse(JSON.stringify(stored));

    const summary = createPresetDetailSummary(stored);

    expect(summary.promptPreviews[0].contentPreview).toHaveLength(140);
    expect(summary.promptPreviews[0].contentPreview.endsWith("…")).toBe(true);
    expect(summary.regexScriptPreviews[0].findRegexPreview).toHaveLength(140);
    expect(summary.regexScriptPreviews[0].findRegexPreview.endsWith("…")).toBe(
      true,
    );
    expect(summary.regexScriptPreviews[0].replacePreview).toHaveLength(140);
    expect(summary.regexScriptPreviews[0].replacePreview.endsWith("…")).toBe(
      true,
    );
    expect(summary.regexScriptPreviews[0]).not.toHaveProperty("runOnEdit");
    expect(stored).toEqual(before);
  });
});
