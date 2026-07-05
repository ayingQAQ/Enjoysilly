import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { getChat, openMySillyDatabase } from "../lib/db";
import { serializeSillyTavernChatJsonl } from "../lib/chatIO";
import type { ChatMessageLine } from "../types/chat";
import {
  createChatLogSnapshot,
  createChatSnapshotName,
  createStoredChatSnapshot,
  saveChatSnapshotToDatabase,
} from "./chatPersistence";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_chat_persistence_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

function createMessages(): ChatMessageLine[] {
  return [
    {
      name: "User",
      is_user: true,
      send_date: "2026-07-05@12h00m01s",
      mes: "你好",
      swipe_id: 0,
      swipes: ["你好"],
      extra: {
        keep: true,
      },
      unknown_field: "keep me",
    },
    {
      name: "角色",
      send_date: "2026-07-05@12h00m02s",
      mes: "你来了。",
      swipe_id: 0,
      swipes: ["你来了。"],
      swipe_info: [{ finish_reason: "stop" }],
    },
  ];
}

describe("chat persistence service", () => {
  it("creates a SillyTavern JSONL-compatible chat snapshot without mutating messages", () => {
    const messages = createMessages();
    const originalMessages = structuredClone(messages);
    const snapshot = createChatLogSnapshot({
      messages,
      userName: "User",
      characterName: "角色",
      now: new Date(2026, 6, 5, 12, 0, 0),
      chatMetadata: {
        presetId: "preset-1",
      },
    });

    expect(snapshot).toEqual({
      metadata: {
        user_name: "User",
        character_name: "角色",
        create_date: "2026-07-05@12h00m00s",
        chat_metadata: {
          presetId: "preset-1",
        },
      },
      messages: originalMessages,
    });
    expect(snapshot.messages).not.toBe(messages);
    expect(snapshot.messages[0]).not.toBe(messages[0]);
    expect(messages).toEqual(originalMessages);

    const serialized = serializeSillyTavernChatJsonl(snapshot);

    expect(serialized.split("\n")).toHaveLength(3);
    expect(JSON.parse(serialized.split("\n")[0] ?? "{}")).toEqual(
      snapshot.metadata,
    );
  });

  it("creates stored chat metadata for a selected character", () => {
    const now = new Date(2026, 6, 5, 12, 0, 0);
    const stored = createStoredChatSnapshot({
      id: "chat-1",
      characterId: "char-1",
      messages: createMessages(),
      userName: "User",
      characterName: "角色",
      now,
    });

    expect(stored).toMatchObject({
      id: "chat-1",
      name: "角色 · 2026-07-05@12h00m00s",
      characterId: "char-1",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    expect(stored.payload.messages).toHaveLength(2);
  });

  it("saves a chat snapshot to IndexedDB", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = new Date(2026, 6, 5, 12, 0, 0);
    const stored = await saveChatSnapshotToDatabase({
      database,
      id: "chat-save",
      characterId: "char-1",
      name: "手动命名",
      messages: createMessages(),
      userName: "User",
      characterName: "角色",
      now,
    });

    await expect(getChat("chat-save", database)).resolves.toEqual(stored);

    database.close();
  });

  it("creates a fallback name when metadata is incomplete", () => {
    expect(createChatSnapshotName({})).toBe("未命名对话");
    expect(createChatSnapshotName({ character_name: "角色" })).toBe("角色");
    expect(createChatSnapshotName({ create_date: "2026-07-05@12h00m00s" })).toBe(
      "2026-07-05@12h00m00s",
    );
  });
});
