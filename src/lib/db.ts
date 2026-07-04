import { type DBSchema, type IDBPDatabase, openDB } from "idb";

import type { CharacterCard } from "../types/character";
import type { SillyTavernChatLog } from "../types/chat";
import type { ChatCompletionPreset } from "../types/preset";
import type { NativeWorldInfoBook, PortableCharacterBook } from "../types/worldinfo";

export const databaseName = "my_silly";
export const databaseVersion = 1;

export interface StoredEntity<TPayload> {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  payload: TPayload;
}

export type StoredCharacter = StoredEntity<CharacterCard>;
export type StoredPreset = StoredEntity<ChatCompletionPreset>;
export type StoredWorldInfo = StoredEntity<NativeWorldInfoBook | PortableCharacterBook>;
export type StoredChat = StoredEntity<SillyTavernChatLog> & {
  characterId?: string;
  groupId?: string;
};

export interface StoredSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface MySillyDatabase extends DBSchema {
  characters: {
    key: string;
    value: StoredCharacter;
    indexes: {
      "by-name": string;
      "by-updatedAt": string;
    };
  };
  presets: {
    key: string;
    value: StoredPreset;
    indexes: {
      "by-name": string;
      "by-updatedAt": string;
    };
  };
  worlds: {
    key: string;
    value: StoredWorldInfo;
    indexes: {
      "by-name": string;
      "by-updatedAt": string;
    };
  };
  chats: {
    key: string;
    value: StoredChat;
    indexes: {
      "by-characterId": string;
      "by-updatedAt": string;
    };
  };
  settings: {
    key: string;
    value: StoredSetting;
  };
}

export type MySillyDatabaseConnection = IDBPDatabase<MySillyDatabase>;

let sharedDatabasePromise: Promise<MySillyDatabaseConnection> | undefined;

export function getMySillyDatabase(): Promise<MySillyDatabaseConnection> {
  sharedDatabasePromise ??= openMySillyDatabase(databaseName);
  return sharedDatabasePromise;
}

export function resetDatabaseConnectionForTests(): void {
  sharedDatabasePromise = undefined;
}

export function openMySillyDatabase(
  name = databaseName,
): Promise<MySillyDatabaseConnection> {
  return openDB<MySillyDatabase>(name, databaseVersion, {
    upgrade(database) {
      createEntityStore(database, "characters");
      createEntityStore(database, "presets");
      createEntityStore(database, "worlds");

      if (!database.objectStoreNames.contains("chats")) {
        const chatStore = database.createObjectStore("chats", { keyPath: "id" });
        chatStore.createIndex("by-characterId", "characterId");
        chatStore.createIndex("by-updatedAt", "updatedAt");
      }

      if (!database.objectStoreNames.contains("settings")) {
        database.createObjectStore("settings", { keyPath: "key" });
      }
    },
  });
}

export async function saveCharacter(
  character: StoredCharacter,
  database?: MySillyDatabaseConnection,
): Promise<string> {
  const db = database ?? (await getMySillyDatabase());
  return db.put("characters", character);
}

export async function getCharacter(
  id: string,
  database?: MySillyDatabaseConnection,
): Promise<StoredCharacter | undefined> {
  const db = database ?? (await getMySillyDatabase());
  return db.get("characters", id);
}

export async function listCharacters(
  database?: MySillyDatabaseConnection,
): Promise<StoredCharacter[]> {
  const db = database ?? (await getMySillyDatabase());
  return db.getAll("characters");
}

export async function deleteCharacter(
  id: string,
  database?: MySillyDatabaseConnection,
): Promise<void> {
  const db = database ?? (await getMySillyDatabase());
  await db.delete("characters", id);
}

export async function savePreset(
  preset: StoredPreset,
  database?: MySillyDatabaseConnection,
): Promise<string> {
  const db = database ?? (await getMySillyDatabase());
  return db.put("presets", preset);
}

export async function getPreset(
  id: string,
  database?: MySillyDatabaseConnection,
): Promise<StoredPreset | undefined> {
  const db = database ?? (await getMySillyDatabase());
  return db.get("presets", id);
}

export async function listPresets(
  database?: MySillyDatabaseConnection,
): Promise<StoredPreset[]> {
  const db = database ?? (await getMySillyDatabase());
  return db.getAll("presets");
}

export async function deletePreset(
  id: string,
  database?: MySillyDatabaseConnection,
): Promise<void> {
  const db = database ?? (await getMySillyDatabase());
  await db.delete("presets", id);
}

export async function saveWorldInfo(
  worldInfo: StoredWorldInfo,
  database?: MySillyDatabaseConnection,
): Promise<string> {
  const db = database ?? (await getMySillyDatabase());
  return db.put("worlds", worldInfo);
}

export async function getWorldInfo(
  id: string,
  database?: MySillyDatabaseConnection,
): Promise<StoredWorldInfo | undefined> {
  const db = database ?? (await getMySillyDatabase());
  return db.get("worlds", id);
}

export async function listWorlds(
  database?: MySillyDatabaseConnection,
): Promise<StoredWorldInfo[]> {
  const db = database ?? (await getMySillyDatabase());
  return db.getAll("worlds");
}

export async function deleteWorldInfo(
  id: string,
  database?: MySillyDatabaseConnection,
): Promise<void> {
  const db = database ?? (await getMySillyDatabase());
  await db.delete("worlds", id);
}

export async function saveChat(
  chat: StoredChat,
  database?: MySillyDatabaseConnection,
): Promise<string> {
  const db = database ?? (await getMySillyDatabase());
  return db.put("chats", chat);
}

export async function getChat(
  id: string,
  database?: MySillyDatabaseConnection,
): Promise<StoredChat | undefined> {
  const db = database ?? (await getMySillyDatabase());
  return db.get("chats", id);
}

export async function listChats(
  database?: MySillyDatabaseConnection,
): Promise<StoredChat[]> {
  const db = database ?? (await getMySillyDatabase());
  return db.getAll("chats");
}

export async function listChatsByCharacterId(
  characterId: string,
  database?: MySillyDatabaseConnection,
): Promise<StoredChat[]> {
  const db = database ?? (await getMySillyDatabase());
  return db.getAllFromIndex("chats", "by-characterId", characterId);
}

export async function deleteChat(
  id: string,
  database?: MySillyDatabaseConnection,
): Promise<void> {
  const db = database ?? (await getMySillyDatabase());
  await db.delete("chats", id);
}

export async function saveSetting(
  setting: StoredSetting,
  database?: MySillyDatabaseConnection,
): Promise<string> {
  const db = database ?? (await getMySillyDatabase());
  return db.put("settings", setting);
}

export async function getSetting(
  key: string,
  database?: MySillyDatabaseConnection,
): Promise<StoredSetting | undefined> {
  const db = database ?? (await getMySillyDatabase());
  return db.get("settings", key);
}

function createEntityStore(
  database: MySillyDatabaseConnection,
  storeName: "characters" | "presets" | "worlds",
): void {
  if (database.objectStoreNames.contains(storeName)) {
    return;
  }

  const store = database.createObjectStore(storeName, { keyPath: "id" });
  store.createIndex("by-name", "name");
  store.createIndex("by-updatedAt", "updatedAt");
}
