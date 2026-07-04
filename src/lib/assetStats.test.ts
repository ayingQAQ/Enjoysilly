import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import {
  openMySillyDatabase,
  saveCharacter,
  saveChat,
  savePreset,
  saveWorldInfo,
} from "./db";
import { loadAssetStats } from "./assetStats";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_asset_stats_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("asset stats", () => {
  it("loads aggregate counts from IndexedDB", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-07-04T00:20:00.000Z";

    await saveCharacter(
      {
        id: "char-1",
        name: "角色",
        createdAt: now,
        updatedAt: now,
        payload: {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: {
            name: "角色",
          },
        },
      },
      database,
    );
    await savePreset(
      {
        id: "preset-1",
        name: "预设",
        createdAt: now,
        updatedAt: now,
        payload: {
          prompts: [],
          prompt_order: [],
          extensions: {
            regex_scripts: [
              {
                scriptName: "隐藏",
                findRegex: "/a/g",
              },
            ],
          },
        },
      },
      database,
    );
    await saveWorldInfo(
      {
        id: "world-1",
        name: "世界书",
        createdAt: now,
        updatedAt: now,
        payload: {
          entries: {
            "0": {
              key: ["A"],
              content: "A",
            },
            "1": {
              key: ["B"],
              content: "B",
            },
          },
        },
      },
      database,
    );
    await saveChat(
      {
        id: "chat-1",
        name: "对话",
        createdAt: now,
        updatedAt: now,
        payload: {
          metadata: {},
          messages: [],
        },
      },
      database,
    );

    await expect(loadAssetStats(database)).resolves.toEqual({
      characters: 1,
      presets: 1,
      worlds: 1,
      chats: 1,
      regexScripts: 1,
      worldEntries: 2,
    });

    database.close();
  });
});
