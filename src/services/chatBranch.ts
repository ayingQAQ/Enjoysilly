import { getMySillyDatabase, type MySillyDatabaseConnection, type StoredChat } from "../lib/db";
import type { SillyTavernChatLog } from "../types/chat";

export async function createChatBranch(input: {
  name: string; payload: SillyTavernChatLog; throughIndex: number;
  sourceArchiveId?: string; expectedUpdatedAt?: string; characterId?: string;
  database?: MySillyDatabaseConnection;
}): Promise<StoredChat> {
  const snapshot = structuredClone(input.payload);
  if (!input.name.trim() || !Number.isInteger(input.throughIndex) || input.throughIndex < 0 || input.throughIndex >= snapshot.messages.length) throw new Error("分支名称或消息位置无效");
  snapshot.messages = snapshot.messages.slice(0, input.throughIndex + 1);
  const db = input.database ?? await getMySillyDatabase();
  const transaction = db.transaction("chats", "readwrite");
  const source = input.sourceArchiveId ? await transaction.store.get(input.sourceArchiveId) : undefined;
  if (input.sourceArchiveId && (!source || source.updatedAt !== input.expectedUpdatedAt)) {
    await transaction.done;
    throw new Error("分支保存冲突：来源存档已变化或不存在，请重新加载后重试。当前对话未改动。");
  }
  const now = new Date().toISOString();
  const branch: StoredChat = { id: crypto.randomUUID(), name: input.name.trim(), createdAt: now, updatedAt: now,
    characterId: input.characterId ?? source?.characterId, groupId: source?.groupId, payload: snapshot,
    branch: { version: 1, sourceArchiveId: input.sourceArchiveId, sourceUpdatedAt: source?.updatedAt, messageIndex: input.throughIndex, createdAt: now } };
  await transaction.store.add(branch);
  await transaction.done;
  return branch;
}
