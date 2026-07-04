import "fake-indexeddb/auto";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import {
  openMySillyDatabase,
  saveCharacter,
  savePreset,
  saveWorldInfo,
} from "../lib/db";
import {
  loadCharacterAssetSummaries,
  loadPresetAssetSummaries,
  loadWorldInfoAssetSummaries,
} from "./assetCatalog";
import { importPresetToDatabase } from "./presetImport";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_asset_catalog_${crypto.randomUUID()}`;
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

describe("asset catalog service", () => {
  it("loads character summaries sorted by update time", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await saveCharacter(
      {
        id: "older",
        name: "旧角色",
        createdAt: "2026-07-04T08:00:00.000Z",
        updatedAt: "2026-07-04T08:00:00.000Z",
        payload: {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: {
            name: "旧角色",
            scenario: "旧场景",
          },
        },
      },
      database,
    );
    await saveCharacter(
      {
        id: "newer",
        name: "新角色",
        createdAt: "2026-07-04T09:00:00.000Z",
        updatedAt: "2026-07-04T10:00:00.000Z",
        payload: {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: {
            name: "新角色",
            avatar: "avatar.png",
            description: "新描述",
            tags: ["测试", "V2"],
            character_book: {
              entries: [
                {
                  keys: ["A"],
                  content: "A",
                },
                {
                  keys: ["B"],
                  content: "B",
                },
              ],
            },
          },
        },
      },
      database,
    );

    await expect(loadCharacterAssetSummaries(database)).resolves.toEqual([
      {
        id: "newer",
        name: "新角色",
        spec: "chara_card_v2",
        specVersion: "2.0",
        createdAt: "2026-07-04T09:00:00.000Z",
        updatedAt: "2026-07-04T10:00:00.000Z",
        description: "新描述",
        tags: ["测试", "V2"],
        avatar: "avatar.png",
        worldEntryCount: 2,
      },
      {
        id: "older",
        name: "旧角色",
        spec: "chara_card_v2",
        specVersion: "2.0",
        createdAt: "2026-07-04T08:00:00.000Z",
        updatedAt: "2026-07-04T08:00:00.000Z",
        description: "旧场景",
        tags: [],
        avatar: undefined,
        worldEntryCount: 0,
      },
    ]);

    database.close();
  });

  it("loads world info summaries for native and portable dialects", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await saveWorldInfo(
      {
        id: "native",
        name: "原生世界书",
        createdAt: "2026-07-04T09:00:00.000Z",
        updatedAt: "2026-07-04T09:30:00.000Z",
        payload: {
          entries: {
            "0": {
              key: ["大观园", "怡红院"],
              content: "园中地点。",
              constant: true,
              enabled: false,
            },
            "1": {
              key: ["停用"],
              content: "停用条目。",
              disable: true,
            },
          },
        },
      },
      database,
    );
    await saveWorldInfo(
      {
        id: "portable",
        name: "内嵌世界书",
        createdAt: "2026-07-04T10:00:00.000Z",
        updatedAt: "2026-07-04T10:30:00.000Z",
        payload: {
          entries: [
            {
              keys: ["潇湘馆"],
              content: "林黛玉居所。",
              enabled: true,
            },
            {
              keys: ["关闭"],
              content: "关闭条目。",
              enabled: false,
            },
          ],
        },
      },
      database,
    );

    await expect(loadWorldInfoAssetSummaries(database)).resolves.toEqual([
      {
        id: "portable",
        name: "内嵌世界书",
        dialect: "portable",
        createdAt: "2026-07-04T10:00:00.000Z",
        updatedAt: "2026-07-04T10:30:00.000Z",
        entryCount: 2,
        enabledEntryCount: 1,
        constantEntryCount: 0,
        sampleKeys: ["潇湘馆", "关闭"],
      },
      {
        id: "native",
        name: "原生世界书",
        dialect: "native",
        createdAt: "2026-07-04T09:00:00.000Z",
        updatedAt: "2026-07-04T09:30:00.000Z",
        entryCount: 2,
        enabledEntryCount: 1,
        constantEntryCount: 1,
        sampleKeys: ["大观园", "怡红院", "停用"],
      },
    ]);

    database.close();
  });

  it("loads preset summaries with prompt, order, regex, and extension counts", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await savePreset(
      {
        id: "older",
        name: "旧预设",
        createdAt: "2026-07-04T08:00:00.000Z",
        updatedAt: "2026-07-04T08:00:00.000Z",
        payload: {
          prompts: [],
          prompt_order: [],
        },
      },
      database,
    );
    await savePreset(
      {
        id: "newer",
        name: "新预设",
        createdAt: "2026-07-04T09:00:00.000Z",
        updatedAt: "2026-07-04T10:00:00.000Z",
        payload: {
          temperature: 0.8,
          top_p: 0.9,
          openai_max_tokens: 2048,
          prompts: [
            {
              identifier: "system",
              name: "系统提示",
              enabled: true,
            },
            {
              identifier: "disabled",
              name: "停用提示",
              enabled: false,
            },
            {
              identifier: "marker-only",
              marker: true,
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
                  identifier: "disabled",
                  enabled: false,
                },
              ],
            },
          ],
          extensions: {
            SPreset: { keep: true },
            regex_scripts: [
              {
                scriptName: "正则 1",
                findRegex: "/a/g",
              },
              {
                scriptName: "正则 2",
                findRegex: "/b/g",
              },
            ],
          },
        },
      },
      database,
    );

    await expect(loadPresetAssetSummaries(database)).resolves.toEqual([
      {
        id: "newer",
        name: "新预设",
        createdAt: "2026-07-04T09:00:00.000Z",
        updatedAt: "2026-07-04T10:00:00.000Z",
        promptCount: 3,
        enabledPromptCount: 2,
        orderSlotCount: 1,
        orderedPromptCount: 2,
        enabledOrderedPromptCount: 1,
        regexScriptCount: 2,
        hasThirdPartyData: true,
        samplePromptNames: ["系统提示", "停用提示", "marker-only"],
        temperature: 0.8,
        topP: 0.9,
        maxTokens: 2048,
      },
      {
        id: "older",
        name: "旧预设",
        createdAt: "2026-07-04T08:00:00.000Z",
        updatedAt: "2026-07-04T08:00:00.000Z",
        promptCount: 0,
        enabledPromptCount: 0,
        orderSlotCount: 0,
        orderedPromptCount: 0,
        enabledOrderedPromptCount: 0,
        regexScriptCount: 0,
        hasThirdPartyData: false,
        samplePromptNames: [],
        temperature: undefined,
        topP: undefined,
        maxTokens: undefined,
      },
    ]);

    database.close();
  });

  it("summarizes the real preset fixture without dropping extension signals", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await importPresetToDatabase(readFileSync(findPresetFixture()), "preset.json", {
      database,
      id: "real-preset",
      name: "真实预设",
      now: () => "2026-07-04T12:30:00.000Z",
    });

    await expect(loadPresetAssetSummaries(database)).resolves.toEqual([
      expect.objectContaining({
        id: "real-preset",
        name: "真实预设",
        promptCount: 50,
        orderSlotCount: 2,
        orderedPromptCount: 39,
        regexScriptCount: 10,
        hasThirdPartyData: true,
        updatedAt: "2026-07-04T12:30:00.000Z",
      }),
    ]);

    database.close();
  });

  it("skips malformed world info entries when building summaries", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await saveWorldInfo(
      {
        id: "loose",
        name: "宽松导入",
        createdAt: "2026-07-04T11:00:00.000Z",
        updatedAt: "2026-07-04T11:00:00.000Z",
        payload: {
          entries: {
            "0": "not an entry",
            "1": {
              content: "没有关键词但仍是对象。",
            },
          },
        } as never,
      },
      database,
    );

    await expect(loadWorldInfoAssetSummaries(database)).resolves.toEqual([
      {
        id: "loose",
        name: "宽松导入",
        dialect: "native",
        createdAt: "2026-07-04T11:00:00.000Z",
        updatedAt: "2026-07-04T11:00:00.000Z",
        entryCount: 1,
        enabledEntryCount: 1,
        constantEntryCount: 0,
        sampleKeys: [],
      },
    ]);

    database.close();
  });
});
