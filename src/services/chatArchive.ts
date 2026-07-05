import {
  deleteChat,
  getChat,
  getMySillyDatabase,
  listChats,
  listChatsByCharacterId,
  saveChat,
  type MySillyDatabaseConnection,
  type StoredChat,
} from "../lib/db";
import { getChatMessageDisplayText } from "../lib/chatHistory";
import type { ChatMessageLine } from "../types/chat";

export interface ChatArchiveSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  characterId?: string;
  groupId?: string;
  userName?: string;
  characterName?: string;
  createDate?: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  lastMessagePreview: string;
}

export interface LoadChatArchiveSummariesOptions {
  characterId?: string;
  database?: MySillyDatabaseConnection;
}

export interface ChatArchiveDetail {
  summary: ChatArchiveSummary;
  stored: StoredChat;
}

export interface RenameChatArchiveInput {
  chatId: string;
  name: string;
  now?: Date;
  database?: MySillyDatabaseConnection;
}

export async function loadChatArchiveSummaries(
  options: LoadChatArchiveSummariesOptions = {},
): Promise<ChatArchiveSummary[]> {
  const database = options.database ?? (await getMySillyDatabase());
  const chats = options.characterId
    ? await listChatsByCharacterId(options.characterId, database)
    : await listChats(database);

  return chats
    .map(createChatArchiveSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadChatArchiveDetail(
  chatId: string,
  database?: MySillyDatabaseConnection,
): Promise<ChatArchiveDetail> {
  const db = database ?? (await getMySillyDatabase());
  const stored = await getChat(chatId, db);

  if (!stored) {
    throw new Error(`找不到对话存档：${chatId}`);
  }

  const clonedStored = cloneStoredChat(stored);

  return {
    summary: createChatArchiveSummary(clonedStored),
    stored: clonedStored,
  };
}

export async function renameChatArchive(
  input: RenameChatArchiveInput,
): Promise<ChatArchiveDetail> {
  const nextName = normalizeArchiveName(input.name);
  const database = input.database ?? (await getMySillyDatabase());
  const stored = await getChat(input.chatId, database);

  if (!stored) {
    throw new Error(`找不到对话存档：${input.chatId}`);
  }

  const renamed: StoredChat = {
    ...cloneStoredChat(stored),
    name: nextName,
    updatedAt: (input.now ?? new Date()).toISOString(),
  };

  await saveChat(renamed, database);

  return {
    summary: createChatArchiveSummary(renamed),
    stored: cloneStoredChat(renamed),
  };
}

export async function deleteChatArchive(
  chatId: string,
  database?: MySillyDatabaseConnection,
): Promise<ChatArchiveSummary> {
  const db = database ?? (await getMySillyDatabase());
  const stored = await getChat(chatId, db);

  if (!stored) {
    throw new Error(`找不到对话存档：${chatId}`);
  }

  const summary = createChatArchiveSummary(stored);
  await deleteChat(chatId, db);

  return summary;
}

export function createChatArchiveSummary(
  stored: StoredChat,
): ChatArchiveSummary {
  const messages = stored.payload.messages;
  const lastMessage = [...messages].reverse().find(hasDisplayText);

  return {
    id: stored.id,
    name: stored.name,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    characterId: stored.characterId,
    groupId: stored.groupId,
    userName: stored.payload.metadata.user_name,
    characterName: stored.payload.metadata.character_name,
    createDate: stored.payload.metadata.create_date,
    messageCount: messages.length,
    userMessageCount: messages.filter((message) => message.is_user === true).length,
    assistantMessageCount: messages.filter(isAssistantMessage).length,
    lastMessagePreview: createMessagePreview(
      lastMessage ? getChatMessageDisplayText(lastMessage) : "",
    ),
  };
}

function cloneStoredChat(stored: StoredChat): StoredChat {
  return structuredClone(stored) as StoredChat;
}

function normalizeArchiveName(name: string): string {
  const normalized = name.trim();

  if (!normalized) {
    throw new Error("对话存档名称不能为空");
  }

  return normalized;
}

function hasDisplayText(message: ChatMessageLine): boolean {
  return getChatMessageDisplayText(message).trim().length > 0;
}

function isAssistantMessage(message: ChatMessageLine): boolean {
  return message.is_user !== true && message.is_system !== true;
}

function createMessagePreview(value: string, maxLength = 120): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}
