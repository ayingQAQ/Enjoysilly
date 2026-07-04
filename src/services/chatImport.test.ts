import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { getChat, openMySillyDatabase } from "../lib/db";
import { createStoredChat, importChatToDatabase } from "./chatImport";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_chat_import_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("chat import service", () => {
  it("creates stable stored chat metadata", () => {
    const stored = createStoredChat(
      {
        metadata: {
          character_name: "林黛玉",
        },
        messages: [],
      },
      "测试对话",
      {
        id: "chat-test",
        characterId: "char-1",
        now: () => "2026-07-04T00:10:00.000Z",
      },
    );

    expect(stored).toMatchObject({
      id: "chat-test",
      name: "测试对话",
      characterId: "char-1",
      createdAt: "2026-07-04T00:10:00.000Z",
      updatedAt: "2026-07-04T00:10:00.000Z",
    });
  });

  it("imports chat JSONL and saves it to IndexedDB", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const bytes = new TextEncoder().encode(
      [
        JSON.stringify({
          user_name: "见山",
          character_name: "林黛玉",
          create_date: "2026-07-04@00h10m00s",
        }),
        JSON.stringify({
          name: "林黛玉",
          mes: "你来了。",
          swipe_id: 0,
          swipes: ["你来了。"],
        }),
      ].join("\n"),
    );

    const result = await importChatToDatabase(bytes, "chat.jsonl", {
      database,
      id: "chat-real",
      characterId: "char-1",
      now: () => "2026-07-04T00:10:00.000Z",
    });

    expect(result.stored.name).toBe("林黛玉 · 2026-07-04@00h10m00s");
    expect(result.chat.messages).toHaveLength(1);
    expect(result.result).toMatchObject({
      assetKind: "chat",
      fileName: "chat.jsonl",
      stored: result.stored,
    });
    expect(result.result.warnings.map((warning) => warning.code)).toEqual([
      "unknown-fields-preserved",
    ]);

    await expect(getChat("chat-real", database)).resolves.toEqual(
      result.stored,
    );

    database.close();
  });
});
