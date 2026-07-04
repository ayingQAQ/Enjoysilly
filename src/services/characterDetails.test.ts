import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { openMySillyDatabase, saveCharacter, type StoredCharacter } from "../lib/db";
import { importCharacterToDatabase } from "./characterImport";
import {
  createCharacterDetailSummary,
  loadCharacterDetailSummary,
} from "./characterDetails";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_character_details_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("character detail summaries", () => {
  it("creates read-only summaries for character card fields and embedded books", () => {
    const stored: StoredCharacter = {
      id: "char-1",
      name: "林黛玉",
      createdAt: "2026-07-04T12:00:00.000Z",
      updatedAt: "2026-07-04T12:30:00.000Z",
      payload: {
        spec: "chara_card_v2",
        spec_version: "2.0",
        root_unknown: "keep",
        data: {
          name: "林黛玉",
          description: "  一段\n角色描述。  ",
          personality: "敏感聪慧",
          scenario: "大观园",
          first_mes: "初见问候",
          mes_example: "示例对话",
          creator_notes: "作者备注",
          system_prompt: "系统提示",
          post_history_instructions: "历史后提示",
          alternate_greetings: ["问候 1", "问候 2"],
          avatar: "avatar.png",
          tags: ["红楼", "测试"],
          creator: "曹雪芹",
          character_version: "1.0",
          custom_data_field: true,
          extensions: {
            keep: true,
          },
          character_book: {
            name: "红楼世界",
            entries: [
              {
                keys: ["大观园", "潇湘馆"],
                content: "地点设定",
                comment: "地点",
                constant: true,
                enabled: true,
                display_index: 1,
              },
              {
                keys: ["关闭"],
                content: "停用条目",
                selective: true,
                enabled: false,
              },
            ],
          },
        },
      },
    };

    const summary = createCharacterDetailSummary(stored);

    expect(summary).toMatchObject({
      id: "char-1",
      name: "林黛玉",
      spec: "chara_card_v2",
      specVersion: "2.0",
      hasAvatar: true,
      tags: ["红楼", "测试"],
      creator: "曹雪芹",
      characterVersion: "1.0",
      alternateGreetingCount: 2,
      groupOnlyGreetingCount: 0,
      extensionFieldNames: ["keep"],
      rootUnknownFieldNames: ["root_unknown"],
    });
    expect(summary.dataUnknownFieldNames).toEqual(["avatar", "custom_data_field"]);
    expect(summary.textPreviews).toMatchObject({
      description: "一段 角色描述。",
      personality: "敏感聪慧",
      scenario: "大观园",
      firstMessage: "初见问候",
      messageExample: "示例对话",
      creatorNotes: "作者备注",
      systemPrompt: "系统提示",
      postHistoryInstructions: "历史后提示",
    });
    expect(summary.embeddedBook).toEqual({
      name: "红楼世界",
      entryCount: 2,
      enabledEntryCount: 1,
      constantEntryCount: 1,
      selectiveEntryCount: 1,
      sampleKeys: ["大观园", "潇湘馆", "关闭"],
      sampleComments: ["地点"],
      entryUnknownFieldNames: ["display_index"],
    });
  });

  it("loads a real PNG fixture detail summary from IndexedDB", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await importCharacterToDatabase(
      readFileSync(join(fixturesDir, "红楼.png")),
      "红楼.png",
      {
        database,
        id: "honglou",
        now: () => "2026-07-04T12:05:00.000Z",
      },
    );

    const summary = await loadCharacterDetailSummary("honglou", database);

    expect(summary).toMatchObject({
      id: "honglou",
      name: "红楼梦世界",
      spec: "chara_card_v2",
      specVersion: "2.0",
      hasAvatar: true,
    });
    expect(summary.dataUnknownFieldNames).toContain("avatar");
    expect(summary.embeddedBook).toEqual(
      expect.objectContaining({
        entryCount: 10,
        enabledEntryCount: 10,
        constantEntryCount: 2,
      }),
    );
    expect(summary.embeddedBook?.entryUnknownFieldNames).toContain(
      "display_index",
    );

    database.close();
  });

  it("reports a missing character detail clearly", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await expect(loadCharacterDetailSummary("missing", database)).rejects.toThrow(
      "找不到角色卡：missing",
    );

    database.close();
  });

  it("does not mutate the stored character payload while creating summaries", () => {
    const stored: StoredCharacter = {
      id: "immutable",
      name: "不可变角色",
      createdAt: "2026-07-04T12:00:00.000Z",
      updatedAt: "2026-07-04T12:00:00.000Z",
      payload: {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: {
          name: "不可变角色",
          description: "A",
          extensions: {
            keep: true,
          },
        },
      },
    };
    const before = JSON.parse(JSON.stringify(stored));

    createCharacterDetailSummary(stored);

    expect(stored).toEqual(before);
  });

  it("skips malformed embedded book entries without breaking summaries", () => {
    const summary = createCharacterDetailSummary({
      id: "loose",
      name: "宽松角色",
      createdAt: "2026-07-04T12:00:00.000Z",
      updatedAt: "2026-07-04T12:00:00.000Z",
      payload: {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: {
          name: "宽松角色",
          character_book: {
            entries: [
              "not an entry",
              {
                content: "没有关键词。",
                enabled: true,
                custom_entry_field: "keep",
              },
            ],
          },
        },
      } as never,
    });

    expect(summary.embeddedBook).toEqual({
      name: "内嵌世界书",
      entryCount: 1,
      enabledEntryCount: 1,
      constantEntryCount: 0,
      selectiveEntryCount: 0,
      sampleKeys: [],
      sampleComments: [],
      entryUnknownFieldNames: ["custom_entry_field"],
    });
  });
});
