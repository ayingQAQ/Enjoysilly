import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { describe, expect, it } from "vitest";
import { openMySillyDatabase } from "../lib/db";
import { loadChatDraft, saveChatDraft, deleteChatDraft, type ChatWorkspaceDraft } from "./chatDrafts";
import { saveChatSnapshotToDatabase } from "./chatPersistence";

describe("versioned local chat drafts", () => {
  it("refreshes clean drafts from the archive and detaches conflicting dirty drafts", async () => {
    const name = `draft-${crypto.randomUUID()}`;
    const db = await openMySillyDatabase(name);
    try {
      const archive = await saveChatSnapshotToDatabase({ database: db, id: "archive", messages: [{ name: "C", mes: "new" }], userName: "U", characterName: "C" });
      const draft: ChatWorkspaceDraft = { version: 1, inputText: "keep input", messages: [{ name: "C", mes: "old" }], archiveId: archive.id,
        archiveName: "old name", metadata: null, dirty: false, characterId: "c", userName: "U", archiveUpdatedAt: "outdated" };
      await saveChatDraft("tab", draft, db);
      const clean = await loadChatDraft("tab", db);
      expect(clean?.messages[0].mes).toBe("new");
      expect(clean?.inputText).toBe("keep input");
      await saveChatDraft("tab", { ...draft, dirty: true }, db);
      const conflict = await loadChatDraft("tab", db);
      expect(conflict?.messages[0].mes).toBe("old");
      expect(conflict?.archiveId).toBeNull();
      expect(conflict?.recoveryNotice).toContain("副本");
      await db.delete("chats", archive.id);
      await saveChatDraft("tab", draft, db);
      expect((await loadChatDraft("tab", db))?.archiveId).toBeNull();
    } finally { db.close(); await deleteDB(name); }
  });
  it("roundtrips drafts separately from archives and isolates browser tabs", async () => {
    const name = `draft-${crypto.randomUUID()}`;
    const db = await openMySillyDatabase(name);
    const draft: ChatWorkspaceDraft = { version: 1, inputText: "未发送🌙", messages: [{ name: "角色", mes: "内容", extra: { keep: true } }],
      archiveId: null, archiveName: null, metadata: null, dirty: true, characterId: "c", userName: "U" };
    try {
      await saveChatDraft("tab-a", draft, db);
      expect(await loadChatDraft("tab-a", db)).toEqual(draft);
      expect(await loadChatDraft("tab-b", db)).toBeNull();
      expect(await db.count("chats")).toBe(0);
      await deleteChatDraft("tab-a", db);
      expect(await loadChatDraft("tab-a", db)).toBeNull();
    } finally { db.close(); await deleteDB(name); }
  });

  it("rejects damaged or future-version drafts without overwriting them", async () => {
    const name = `draft-${crypto.randomUUID()}`;
    const db = await openMySillyDatabase(name);
    try {
      await db.put("settings", { key: "chatDraft:v1:tab", value: { version: 2 }, updatedAt: "now" });
      await expect(loadChatDraft("tab", db)).rejects.toThrow("草稿");
      expect((await db.get("settings", "chatDraft:v1:tab"))?.value).toEqual({ version: 2 });
    } finally { db.close(); await deleteDB(name); }
  });
  it("rejects malformed message-edit drafts", async () => {
    const name = `draft-${crypto.randomUUID()}`;
    const db = await openMySillyDatabase(name);
    try {
      await db.put("settings", { key: "chatDraft:v1:tab", updatedAt: "now", value: {
        version: 1, inputText: "", messages: [], archiveId: null, archiveName: null,
        metadata: null, dirty: false, characterId: "c", userName: "U", messageEdit: { index: -1, text: 123 },
      } });
      await expect(loadChatDraft("tab", db)).rejects.toThrow("草稿");
    } finally { db.close(); await deleteDB(name); }
  });
});
