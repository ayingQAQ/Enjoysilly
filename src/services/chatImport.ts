import { parseSillyTavernChatJsonl } from "../lib/chatIO";
import {
  getMySillyDatabase,
  saveChat,
  type MySillyDatabaseConnection,
  type StoredChat,
} from "../lib/db";
import type { SillyTavernChatLog } from "../types/chat";
import {
  createStoredEntity,
  stripFileExtension,
  type StoredEntityOptions,
} from "./entityMetadata";
import {
  createImportResult,
  type ImportResult,
  unknownFieldsPreservedWarning,
} from "./importResult";

export interface StoredChatOptions extends StoredEntityOptions {
  characterId?: string;
  groupId?: string;
}

export interface ImportChatToDatabaseOptions extends StoredChatOptions {
  database?: MySillyDatabaseConnection;
  name?: string;
}

export interface ImportedStoredChat {
  chat: SillyTavernChatLog;
  stored: StoredChat;
  result: ImportResult<StoredChat, SillyTavernChatLog>;
}

export function createStoredChat(
  chat: SillyTavernChatLog,
  name: string,
  options: StoredChatOptions = {},
): StoredChat {
  return {
    ...createStoredEntity(chat, name, "chat", options),
    characterId: options.characterId,
    groupId: options.groupId,
  };
}

export async function importChatToDatabase(
  bytes: Uint8Array,
  fileName: string,
  options: ImportChatToDatabaseOptions = {},
): Promise<ImportedStoredChat> {
  const chat = parseSillyTavernChatJsonl(new TextDecoder().decode(bytes));
  const stored = createStoredChat(
    chat,
    options.name ?? deriveChatName(chat, fileName),
    options,
  );
  const database = options.database ?? (await getMySillyDatabase());

  await saveChat(stored, database);

  return {
    chat,
    stored,
    result: createImportResult("chat", fileName, stored, chat, [
      unknownFieldsPreservedWarning(),
    ]),
  };
}

function deriveChatName(chat: SillyTavernChatLog, fileName: string): string {
  const characterName = chat.metadata.character_name;
  const createDate = chat.metadata.create_date;

  if (characterName && createDate) {
    return `${characterName} · ${createDate}`;
  }

  return stripFileExtension(fileName);
}
