import {
  getMySillyDatabase,
  type MySillyDatabaseConnection,
} from "../lib/db";
import type { StoredEntityOptions } from "./entityMetadata";
import {
  importWorldInfoToDatabase,
  type ImportedStoredWorldInfo,
} from "./worldInfoImport";

export interface WorldInfoFileImportItem {
  fileName: string;
  bytes: Uint8Array;
}

export interface WorldInfoFileImportFailure {
  fileName: string;
  message: string;
}

export interface ImportWorldInfoFilesOptions
  extends Pick<StoredEntityOptions, "now"> {
  database?: MySillyDatabaseConnection;
}

export interface ImportWorldInfoFilesResult {
  imported: ImportedStoredWorldInfo[];
  failed: WorldInfoFileImportFailure[];
}

export async function importWorldInfoFilesToDatabase(
  files: WorldInfoFileImportItem[],
  options: ImportWorldInfoFilesOptions = {},
): Promise<ImportWorldInfoFilesResult> {
  const database = options.database ?? (await getMySillyDatabase());
  const imported: ImportedStoredWorldInfo[] = [];
  const failed: WorldInfoFileImportFailure[] = [];

  for (const file of files) {
    try {
      imported.push(
        await importWorldInfoToDatabase(file.bytes, file.fileName, {
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
