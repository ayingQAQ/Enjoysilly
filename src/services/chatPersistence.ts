import { formatSillyTavernChatDate } from "../lib/chatTurn";
import {
  getMySillyDatabase,
  type MySillyDatabaseConnection,
  type StoredChat,
} from "../lib/db";
import type {
  ChatMessageLine,
  ChatMetadataLine,
  SillyTavernChatLog,
} from "../types/chat";
import type { UnknownRecord } from "../types/common";
import { createStoredChat } from "./chatImport";

export interface CreateChatLogSnapshotInput {
  messages: ChatMessageLine[];
  userName: string;
  characterName: string;
  now?: Date;
  metadata?: ChatMetadataLine;
  chatMetadata?: UnknownRecord;
}

export interface CreateStoredChatSnapshotInput
  extends CreateChatLogSnapshotInput {
  id?: string;
  name?: string;
  characterId?: string;
  groupId?: string;
}

export interface SaveChatSnapshotToDatabaseInput
  extends CreateStoredChatSnapshotInput {
  database?: MySillyDatabaseConnection;
  expectedUpdatedAt?: string | null;
}

export async function saveChatSnapshotToDatabase(
  input: SaveChatSnapshotToDatabaseInput,
): Promise<StoredChat> {
  const database = input.database ?? (await getMySillyDatabase());
  const transaction = database.transaction("chats", "readwrite");
  const previous = input.id ? await transaction.store.get(input.id) : undefined;
  if (input.expectedUpdatedAt !== undefined && (previous?.updatedAt ?? null) !== input.expectedUpdatedAt) {
    await transaction.done;
    throw new Error("存档保存冲突：原存档已被其他页面修改或删除。请导出当前内容后重新加载，避免覆盖。");
  }
  const stored = createStoredChatSnapshot({
    ...input,
    metadata: input.metadata ?? previous?.payload.metadata,
    name: input.name ?? previous?.name,
  });
  if (previous) {
    stored.createdAt = previous.createdAt;
    const previousTime = Date.parse(previous.updatedAt);
    if (Number.isFinite(previousTime) && Date.parse(stored.updatedAt) <= previousTime) {
      stored.updatedAt = new Date(previousTime + 1).toISOString();
    }
  }
  await transaction.store.put(stored);
  await transaction.done;

  return stored;
}

export function createStoredChatSnapshot(
  input: CreateStoredChatSnapshotInput,
): StoredChat {
  const chatLog = createChatLogSnapshot(input);
  const now = input.now ?? new Date();

  return createStoredChat(
    chatLog,
    input.name ?? createChatSnapshotName(chatLog.metadata),
    {
      id: input.id,
      characterId: input.characterId,
      groupId: input.groupId,
      now: () => now.toISOString(),
    },
  );
}

export function createChatLogSnapshot(
  input: CreateChatLogSnapshotInput,
): SillyTavernChatLog {
  return {
    metadata: createChatMetadata(input),
    messages: input.messages.map(cloneChatMessage),
  };
}

export function createChatSnapshotName(metadata: ChatMetadataLine): string {
  const characterName = metadata.character_name?.trim();
  const createDate = metadata.create_date?.trim();

  if (characterName && createDate) {
    return `${characterName} · ${createDate}`;
  }

  return createDate || characterName || "未命名对话";
}

function createChatMetadata(
  input: CreateChatLogSnapshotInput,
): ChatMetadataLine {
  const metadata: ChatMetadataLine = input.metadata
    ? cloneChatMetadata(input.metadata)
    : {};

  metadata.user_name = input.userName;
  metadata.character_name = input.characterName;

  if (!metadata.create_date) {
    metadata.create_date = formatSillyTavernChatDate(input.now);
  }

  if (input.chatMetadata) {
    metadata.chat_metadata = cloneUnknownRecord(input.chatMetadata);
  }

  return metadata;
}

function cloneChatMetadata(value: ChatMetadataLine): ChatMetadataLine {
  return structuredClone(value) as ChatMetadataLine;
}

function cloneChatMessage(message: ChatMessageLine): ChatMessageLine {
  return structuredClone(message) as ChatMessageLine;
}

function cloneUnknownRecord(value: UnknownRecord): UnknownRecord {
  return structuredClone(value) as UnknownRecord;
}
