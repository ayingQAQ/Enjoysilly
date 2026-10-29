import { getMySillyDatabase, type MySillyDatabaseConnection } from "../lib/db";
import type { ChatMessageLine, ChatMetadataLine } from "../types/chat";

export interface ChatWorkspaceDraft {
  version: 1;
  inputText: string;
  messages: ChatMessageLine[];
  archiveId: string | null;
  archiveName: string | null;
  archiveUpdatedAt?: string | null;
  recoveryNotice?: string;
  metadata: ChatMetadataLine | null;
  dirty: boolean;
  characterId: string;
  userName: string;
  presetId?: string;
  characterName?: string;
  characterDescription?: string;
  personaDescription?: string;
  messageEdit?: { index: number; original: string; text: string } | null;
}
const key = (tab: string) => `chatDraft:v1:${tab}`;

export async function loadChatDraft(tab: string, database?: MySillyDatabaseConnection): Promise<ChatWorkspaceDraft | null> {
  const db = database ?? await getMySillyDatabase();
  const record = await db.get("settings", key(tab));
  if (!record) return null;
  const value = record.value as Partial<ChatWorkspaceDraft> | null;
  if (!value || value.version !== 1 || typeof value.inputText !== "string" ||
    typeof value.dirty !== "boolean" || typeof value.characterId !== "string" || typeof value.userName !== "string" ||
    !Array.isArray(value.messages) || !value.messages.every(m => m && typeof m.mes === "string" && typeof m.name === "string") ||
    !(value.archiveId === null || typeof value.archiveId === "string") ||
    !(value.archiveName === null || typeof value.archiveName === "string") ||
    !(value.metadata === null || (typeof value.metadata === "object" && !Array.isArray(value.metadata))) ||
    [value.presetId, value.characterName, value.characterDescription, value.personaDescription].some(v => v !== undefined && typeof v !== "string") ||
    (value.messageEdit != null && (!Number.isInteger(value.messageEdit.index) || value.messageEdit.index < 0 ||
      typeof value.messageEdit.original !== "string" || typeof value.messageEdit.text !== "string"))) {
    throw new Error("本地草稿格式损坏或版本不受支持；原记录已保留，请勿清除浏览器数据。");
  }
  const draft = value as ChatWorkspaceDraft;
  if (draft.archiveId) {
    const archive = await db.get("chats", draft.archiveId);
    if (archive && !draft.dirty) {
      return { ...draft, messages: archive.payload.messages, metadata: archive.payload.metadata,
        archiveName: archive.name, archiveUpdatedAt: archive.updatedAt };
    }
    if (!archive || draft.archiveUpdatedAt !== archive.updatedAt) {
      return { ...draft, archiveId: null, archiveUpdatedAt: null, archiveName: `恢复副本 · ${draft.archiveName ?? "未命名对话"}`,
        dirty: true, recoveryNotice: "原存档已变化或删除；本地草稿已恢复为独立副本，不会覆盖原存档。" };
    }
  }
  return draft;
}

export async function saveChatDraft(tab: string, draft: ChatWorkspaceDraft, database?: MySillyDatabaseConnection) {
  const captured = structuredClone(draft);
  const db = database ?? await getMySillyDatabase();
  await db.put("settings", { key: key(tab), value: captured, updatedAt: new Date().toISOString() });
}

export async function deleteChatDraft(tab: string, database?: MySillyDatabaseConnection) {
  const db = database ?? await getMySillyDatabase();
  await db.delete("settings", key(tab));
}

export function getChatDraftTabId(): string {
  const key = "enjoy-silly:chat-draft-tab";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
}

export function setChatDraftTabId(id: string) {
  sessionStorage.setItem("enjoy-silly:chat-draft-tab", id);
}
