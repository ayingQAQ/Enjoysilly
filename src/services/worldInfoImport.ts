import { parseWorldInfoJson } from "../lib/worldInfoIO";
import {
  getMySillyDatabase,
  saveWorldInfo,
  type MySillyDatabaseConnection,
  type StoredWorldInfo,
} from "../lib/db";
import type {
  NativeWorldInfoBook,
  PortableCharacterBook,
} from "../types/worldinfo";
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

export interface ImportWorldInfoToDatabaseOptions extends StoredEntityOptions {
  database?: MySillyDatabaseConnection;
  name?: string;
}

export interface ImportedStoredWorldInfo {
  worldInfo: NativeWorldInfoBook | PortableCharacterBook;
  stored: StoredWorldInfo;
  result: ImportResult<StoredWorldInfo, NativeWorldInfoBook | PortableCharacterBook>;
}

export function createStoredWorldInfo(
  worldInfo: NativeWorldInfoBook | PortableCharacterBook,
  name: string,
  options: StoredEntityOptions = {},
): StoredWorldInfo {
  return createStoredEntity(worldInfo, name, "world", options);
}

export async function importWorldInfoToDatabase(
  bytes: Uint8Array,
  fileName: string,
  options: ImportWorldInfoToDatabaseOptions = {},
): Promise<ImportedStoredWorldInfo> {
  const worldInfo = parseWorldInfoJson(new TextDecoder().decode(bytes));
  const stored = createStoredWorldInfo(
    worldInfo,
    options.name ?? deriveWorldInfoName(worldInfo, fileName),
    options,
  );
  const database = options.database ?? (await getMySillyDatabase());

  await saveWorldInfo(stored, database);

  return {
    worldInfo,
    stored,
    result: createImportResult("world", fileName, stored, worldInfo, [
      unknownFieldsPreservedWarning(),
    ]),
  };
}

function deriveWorldInfoName(
  worldInfo: NativeWorldInfoBook | PortableCharacterBook,
  fileName: string,
): string {
  return typeof worldInfo.name === "string" && worldInfo.name.trim().length > 0
    ? worldInfo.name
    : stripFileExtension(fileName);
}
