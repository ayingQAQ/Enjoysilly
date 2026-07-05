import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import {
  openMySillyDatabase,
  saveChat,
  type MySillyDatabaseConnection,
  type StoredChat,
} from "../lib/db";
import {
  createChatArchiveSummary,
  deleteChatArchive,
  loadChatArchiveDetail,
  loadChatArchiveSummaries,
  renameChatArchive,
} from "./chatArchive";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_chat_archive_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

function createStoredChat(input: {
  id: string;
  name: string;
  updatedAt: string;
  characterId?: string;
  messages?: StoredChat["payload"]["messages"];
}): StoredChat {
  return {
    id: input.id,
    name: input.name,
    characterId: input.characterId,
    createdAt: "2026-07-05T12:00:00.000Z",
    updatedAt: input.updatedAt,
    payload: {
      metadata: {
        user_name: "User",
        character_name: "角色",
        create_date: "2026-07-05@12h00m00s",
        custom_metadata: true,
      },
      messages:
        input.messages ??
        [
          {
            name: "User",
            is_user: true,
            send_date: "2026-07-05@12h00m01s",
            mes: "你好",
            swipe_id: 0,
            swipes: ["你好"],
          },
          {
            name: "角色",
            send_date: "2026-07-05@12h00m02s",
            mes: "你来了。",
            swipe_id: 0,
            swipes: ["你来了。"],
            extra: {
              keep: true,
            },
          },
        ],
    },
  };
}

async function seedChats(database: MySillyDatabaseConnection): Promise<void> {
  await saveChat(
    createStoredChat({
      id: "older",
      name: "旧对话",
      characterId: "char-1",
      updatedAt: "2026-07-05T12:00:00.000Z",
    }),
    database,
  );
  await saveChat(
    createStoredChat({
      id: "newer",
      name: "新对话",
      characterId: "char-1",
      updatedAt: "2026-07-05T13:00:00.000Z",
    }),
    database,
  );
  await saveChat(
    createStoredChat({
      id: "other",
      name: "其他角色对话",
      characterId: "char-2",
      updatedAt: "2026-07-05T14:00:00.000Z",
    }),
    database,
  );
}

describe("chat archive service", () => {
  it("creates chat archive summaries without mutating stored chats", () => {
    const stored = createStoredChat({
      id: "summary",
      name: "摘要对话",
      characterId: "char-1",
      updatedAt: "2026-07-05T12:30:00.000Z",
      messages: [
        {
          name: "系统",
          is_system: true,
          mes: "系统消息",
        },
        {
          name: "User",
          is_user: true,
          mes: "你好",
        },
        {
          name: "角色",
          mes: "旧回复",
          swipe_id: 1,
          swipes: ["旧回复", "很长的回复\n".repeat(40)],
          custom_message_field: "keep",
        },
      ],
    });
    const before = structuredClone(stored);

    expect(createChatArchiveSummary(stored)).toEqual({
      id: "summary",
      name: "摘要对话",
      createdAt: "2026-07-05T12:00:00.000Z",
      updatedAt: "2026-07-05T12:30:00.000Z",
      characterId: "char-1",
      groupId: undefined,
      userName: "User",
      characterName: "角色",
      createDate: "2026-07-05@12h00m00s",
      messageCount: 3,
      userMessageCount: 1,
      assistantMessageCount: 1,
      lastMessagePreview: expect.stringMatching(/^很长的回复/),
    });
    expect(createChatArchiveSummary(stored).lastMessagePreview.length).toBeLessThanOrEqual(
      120,
    );
    expect(createChatArchiveSummary(stored).lastMessagePreview).toMatch(/…$/);
    expect(stored).toEqual(before);
  });

  it("loads chat summaries sorted by updated time", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    await seedChats(database);

    await expect(loadChatArchiveSummaries({ database })).resolves.toEqual([
      expect.objectContaining({ id: "other" }),
      expect.objectContaining({ id: "newer" }),
      expect.objectContaining({ id: "older" }),
    ]);

    database.close();
  });

  it("loads chat summaries filtered by character id", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    await seedChats(database);

    await expect(
      loadChatArchiveSummaries({ characterId: "char-1", database }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "newer", characterId: "char-1" }),
      expect.objectContaining({ id: "older", characterId: "char-1" }),
    ]);

    database.close();
  });

  it("loads a chat detail as a cloned stored payload", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const stored = createStoredChat({
      id: "detail",
      name: "详情对话",
      characterId: "char-1",
      updatedAt: "2026-07-05T13:00:00.000Z",
    });

    await saveChat(stored, database);

    const detail = await loadChatArchiveDetail("detail", database);

    expect(detail.summary).toEqual(expect.objectContaining({ id: "detail" }));
    expect(detail.stored).toEqual(stored);
    expect(detail.stored).not.toBe(stored);
    expect(detail.stored.payload.messages[0]).not.toBe(stored.payload.messages[0]);

    detail.stored.payload.messages[0]!.mes = "已修改副本";
    await expect(loadChatArchiveDetail("detail", database)).resolves.toEqual(
      expect.objectContaining({
        stored: expect.objectContaining({
          payload: expect.objectContaining({
            messages: [
              expect.objectContaining({ mes: "你好" }),
              expect.any(Object),
            ],
          }),
        }),
      }),
    );

    database.close();
  });

  it("reports a missing chat detail clearly", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await expect(loadChatArchiveDetail("missing", database)).rejects.toThrow(
      "找不到对话存档：missing",
    );

    database.close();
  });

  it("renames a chat archive without changing the stored payload", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const stored = createStoredChat({
      id: "rename-me",
      name: "旧名称",
      characterId: "char-1",
      updatedAt: "2026-07-05T13:00:00.000Z",
    });

    await saveChat(stored, database);

    const renamed = await renameChatArchive({
      chatId: "rename-me",
      name: "  新名称  ",
      now: new Date("2026-07-05T14:00:00.000Z"),
      database,
    });

    expect(renamed.summary).toEqual(
      expect.objectContaining({
        id: "rename-me",
        name: "新名称",
        updatedAt: "2026-07-05T14:00:00.000Z",
      }),
    );
    await expect(loadChatArchiveDetail("rename-me", database)).resolves.toEqual(
      expect.objectContaining({
        stored: expect.objectContaining({
          name: "新名称",
          createdAt: stored.createdAt,
          payload: stored.payload,
        }),
      }),
    );

    database.close();
  });

  it("rejects empty archive names", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await expect(
      renameChatArchive({
        chatId: "rename-me",
        name: "   ",
        database,
      }),
    ).rejects.toThrow("对话存档名称不能为空");

    database.close();
  });

  it("deletes only the selected chat archive", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    await seedChats(database);

    await expect(deleteChatArchive("newer", database)).resolves.toEqual(
      expect.objectContaining({
        id: "newer",
        name: "新对话",
      }),
    );
    await expect(loadChatArchiveDetail("newer", database)).rejects.toThrow(
      "找不到对话存档：newer",
    );
    await expect(loadChatArchiveDetail("older", database)).resolves.toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ id: "older" }),
      }),
    );

    database.close();
  });

  it("reports a missing chat archive before deleting", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await expect(deleteChatArchive("missing", database)).rejects.toThrow(
      "找不到对话存档：missing",
    );

    database.close();
  });
});
