import type { CharacterCard } from "../types/character";
import {
  importCharacterCardFromBytes,
  type ImportedCharacterCard,
} from "../lib/cardIO";
import {
  getMySillyDatabase,
  saveCharacter,
  saveWorldInfo,
  type MySillyDatabaseConnection,
  type StoredCharacter,
  type StoredWorldInfo,
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
import { createStoredWorldInfo } from "./worldInfoImport";

export type StoredCharacterOptions = StoredEntityOptions;

export interface ImportCharacterToDatabaseOptions extends StoredCharacterOptions {
  database?: MySillyDatabaseConnection;
  embeddedWorldInfoId?: string;
}

export interface ImportedStoredCharacter {
  imported: ImportedCharacterCard;
  stored: StoredCharacter;
  embeddedWorldInfo?: StoredWorldInfo;
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
  const embeddedWorldInfo = imported.card.data.character_book
    ? createStoredWorldInfo(
        imported.card.data.character_book,
        `${imported.card.data.name} · 内嵌世界书`,
        {
          id: options.embeddedWorldInfoId ?? `${stored.id}__character_book`,
          now: options.now,
        },
      )
    : undefined;

  if (embeddedWorldInfo) {
    await saveWorldInfo(embeddedWorldInfo, database);
  }

  return {
    embeddedWorldInfo,
    imported,
    stored,
    result: createImportResult("character", fileName, stored, imported.card, [
      unknownFieldsPreservedWarning(),
    ]),
  };
}
