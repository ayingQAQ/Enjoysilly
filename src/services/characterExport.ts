import { encodeCharacterCardJson } from "../lib/cardIO";
import {
  getCharacter,
  getMySillyDatabase,
  type MySillyDatabaseConnection,
  type StoredCharacter,
} from "../lib/db";
import { createSafeJsonFileName } from "./exportFileName";

export interface CharacterJsonExport {
  fileName: string;
  bytes: Uint8Array;
  stored: StoredCharacter;
}

export async function createCharacterJsonExport(
  characterId: string,
  database?: MySillyDatabaseConnection,
): Promise<CharacterJsonExport> {
  const db = database ?? (await getMySillyDatabase());
  const stored = await getCharacter(characterId, db);

  if (!stored) {
    throw new Error(`找不到角色卡：${characterId}`);
  }

  return {
    fileName: createCharacterJsonFileName(stored.name),
    bytes: encodeCharacterCardJson(stored.payload),
    stored,
  };
}

export function createCharacterJsonFileName(name: string): string {
  return createSafeJsonFileName(name, "character");
}
