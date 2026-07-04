import type { CharacterCard } from "../types/character";
import {
  importCharacterCardFromBytes,
  type ImportedCharacterCard,
} from "../lib/cardIO";
import {
  getMySillyDatabase,
  saveCharacter,
  type MySillyDatabaseConnection,
  type StoredCharacter,
} from "../lib/db";
import {
  createStoredEntity,
  type StoredEntityOptions,
} from "./entityMetadata";
import {
  createImportResult,
  type ImportResult,
  unknownFieldsPreservedWarning,
} from "./importResult";

export type StoredCharacterOptions = StoredEntityOptions;

export interface ImportCharacterToDatabaseOptions extends StoredCharacterOptions {
  database?: MySillyDatabaseConnection;
}

export interface ImportedStoredCharacter {
  imported: ImportedCharacterCard;
  stored: StoredCharacter;
  result: ImportResult<StoredCharacter, CharacterCard>;
}

export function createStoredCharacter(
  card: CharacterCard,
  options: StoredCharacterOptions = {},
): StoredCharacter {
  return createStoredEntity(card, card.data.name, "character", options);
}

export async function importCharacterToDatabase(
  bytes: Uint8Array,
  fileName: string,
  options: ImportCharacterToDatabaseOptions = {},
): Promise<ImportedStoredCharacter> {
  const imported = importCharacterCardFromBytes(bytes, fileName);
  const stored = createStoredCharacter(imported.card, options);
  const database = options.database ?? (await getMySillyDatabase());

  if (imported.format === "png") {
    stored.sourcePngBytes = new Uint8Array(bytes);
    stored.sourceFileName = fileName;
  }

  await saveCharacter(stored, database);

  return {
    imported,
    stored,
    result: createImportResult("character", fileName, stored, imported.card, [
      unknownFieldsPreservedWarning(),
    ]),
  };
}
