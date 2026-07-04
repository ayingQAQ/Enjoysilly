import {
  getMySillyDatabase,
  type MySillyDatabaseConnection,
} from "../lib/db";
import type { StoredEntityOptions } from "./entityMetadata";
import {
  importPresetToDatabase,
  type ImportedStoredPreset,
} from "./presetImport";

export interface PresetFileImportItem {
  fileName: string;
  bytes: Uint8Array;
}

export interface PresetFileImportFailure {
  fileName: string;
  message: string;
}

export interface ImportPresetFilesOptions extends Pick<StoredEntityOptions, "now"> {
  database?: MySillyDatabaseConnection;
}

export interface ImportPresetFilesResult {
  imported: ImportedStoredPreset[];
  failed: PresetFileImportFailure[];
}

export async function importPresetFilesToDatabase(
  files: PresetFileImportItem[],
  options: ImportPresetFilesOptions = {},
): Promise<ImportPresetFilesResult> {
  const database = options.database ?? (await getMySillyDatabase());
  const imported: ImportedStoredPreset[] = [];
  const failed: PresetFileImportFailure[] = [];

  for (const file of files) {
    try {
      imported.push(
        await importPresetToDatabase(file.bytes, file.fileName, {
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
