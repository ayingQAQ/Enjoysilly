import { formatSillyTavernChatDate } from "../lib/chatTurn";
import {
  getMySillyDatabase,
  saveChat,
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
}

export async function saveChatSnapshotToDatabase(
  input: SaveChatSnapshotToDatabaseInput,
): Promise<StoredChat> {
  const database = input.database ?? (await getMySillyDatabase());
  const stored = createStoredChatSnapshot(input);

  await saveChat(stored, database);

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
    // 合并而非覆盖：保留已导入的 chat_metadata 字段，叠加新传入的值
    metadata.chat_metadata = {
      ...cloneUnknownRecord(metadata.chat_metadata ?? {}),
      ...cloneUnknownRecord(input.chatMetadata),
    };
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
