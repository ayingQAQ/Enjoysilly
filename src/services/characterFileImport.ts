import {
  getMySillyDatabase,
  type MySillyDatabaseConnection,
} from "../lib/db";
import {
  importCharacterToDatabase,
  type ImportedStoredCharacter,
} from "./characterImport";
import type { StoredEntityOptions } from "./entityMetadata";

export interface CharacterFileImportItem {
  fileName: string;
  bytes: Uint8Array;
}

export interface CharacterFileImportFailure {
  fileName: string;
  message: string;
}

export interface ImportCharacterFilesOptions
  extends Pick<StoredEntityOptions, "now"> {
  database?: MySillyDatabaseConnection;
}

export interface ImportCharacterFilesResult {
  imported: ImportedStoredCharacter[];
  failed: CharacterFileImportFailure[];
}

export async function importCharacterFilesToDatabase(
  files: CharacterFileImportItem[],
  options: ImportCharacterFilesOptions = {},
): Promise<ImportCharacterFilesResult> {
  const database = options.database ?? (await getMySillyDatabase());
  const imported: ImportedStoredCharacter[] = [];
  const failed: CharacterFileImportFailure[] = [];

  for (const file of files) {
    try {
      imported.push(
        await importCharacterToDatabase(file.bytes, file.fileName, {
          database,
          now: options.now,
        }),
      );
    } catch (error: unknown) {
      failed.push({
        fileName: file.fileName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    imported,
    failed,
  };
}
