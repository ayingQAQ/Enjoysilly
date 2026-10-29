import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { expect, it } from "vitest";
import { openMySillyDatabase, type StoredChat } from "../lib/db";
import { createChatBranch } from "./chatBranch";
import { saveChatSnapshotToDatabase } from "./chatPersistence";

it("creates independent prefix with unknown fields/swipes, keeps original intact and provenance through later saves", async () => {
  const name = `branch-${crypto.randomUUID()}`;
  const db = await openMySillyDatabase(name);
  try {
    const original: StoredChat = { id: "source", name: "原存档", createdAt: "2026-01-01", updatedAt: "2026-01-02", characterId: "char", payload: { metadata: { custom: "keep" }, messages: [{ name: "N", mes: "first", send_date: "date", swipes: ["first", "second"], swipe_id: 1, extra: { custom: true } }, { name: "N", mes: "later", send_date: "date" }] } };
    await db.put("chats", original);
    const branch = await createChatBranch({ name: "分支", payload: original.payload, throughIndex: 0, sourceArchiveId: "source", expectedUpdatedAt: original.updatedAt, characterId: "char", database: db });
    expect(branch.id).not.toBe("source");
    expect(branch.payload.messages).toEqual([original.payload.messages[0]]);
    expect(branch.payload.metadata).toEqual({ custom: "keep" });
    expect(branch.branch?.sourceArchiveId).toBe("source");
    expect(branch.branch?.messageIndex).toBe(0);
    expect(await db.get("chats", "source")).toEqual(original);
    const saved = await saveChatSnapshotToDatabase({ id: branch.id, messages: branch.payload.messages, userName: "U", characterName: "N", database: db });
    expect(saved.branch).toEqual(branch.branch);
    await expect(createChatBranch({ name: "stale", payload: original.payload, throughIndex: 0, sourceArchiveId: "source", expectedUpdatedAt: "stale", database: db })).rejects.toThrow(/冲突/);
    await expect(createChatBranch({ name: "missing", payload: original.payload, throughIndex: 0, sourceArchiveId: "missing", expectedUpdatedAt: "old", database: db })).rejects.toThrow(/冲突|不存在/);
    await expect(createChatBranch({ name: "bad", payload: original.payload, throughIndex: 10, database: db })).rejects.toThrow();
    expect(await db.count("chats")).toBe(2);
  } finally { db.close(); await deleteDB(name); }
});
