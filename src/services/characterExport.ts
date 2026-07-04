import {
  encodeCharacterCardJson,
  exportCharacterCardToPng,
} from "../lib/cardIO";
import {
  getCharacter,
  getMySillyDatabase,
  type MySillyDatabaseConnection,
  type StoredCharacter,
} from "../lib/db";
import { createSafeFileName, createSafeJsonFileName } from "./exportFileName";

export interface CharacterJsonExport {
  fileName: string;
  bytes: Uint8Array;
  stored: StoredCharacter;
}

export interface CharacterPngExport {
  fileName: string;
  bytes: Uint8Array;
  stored: StoredCharacter;
  source: "original" | "default";
}

const defaultCharacterPngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

export async function createCharacterJsonExport(
  characterId: string,
  database?: MySillyDatabaseConnection,
): Promise<CharacterJsonExport> {
  const db = database ?? (await getMySillyDatabase());
  const stored = await getCharacter(characterId, db);

  if (!stored) {
    throw new Error(`Character card not found: ${characterId}`);
  }

  return {
    fileName: createCharacterJsonFileName(stored.name),
    bytes: encodeCharacterCardJson(stored.payload),
    stored,
  };
}

export async function createCharacterPngExport(
  characterId: string,
  database?: MySillyDatabaseConnection,
): Promise<CharacterPngExport> {
  const db = database ?? (await getMySillyDatabase());
  const stored = await getCharacter(characterId, db);

  if (!stored) {
    throw new Error(`Character card not found: ${characterId}`);
  }

  const sourcePngBytes = stored.sourcePngBytes ?? defaultCharacterPngBytes;
  const source = stored.sourcePngBytes ? "original" : "default";

  return {
    fileName: createCharacterPngFileName(stored.name),
    bytes: exportCharacterCardToPng(sourcePngBytes, stored.payload),
    stored,
    source,
  };
}

export function createCharacterJsonFileName(name: string): string {
  return createSafeJsonFileName(name, "character");
}

export function createCharacterPngFileName(name: string): string {
  return createSafeFileName(name, "character", "png");
}
