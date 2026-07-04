import {
  extractRegexScripts,
  parseChatCompletionPresetJson,
} from "../lib/presetIO";
import {
  getMySillyDatabase,
  savePreset,
  type MySillyDatabaseConnection,
  type StoredPreset,
} from "../lib/db";
import type { ChatCompletionPreset, RegexScript } from "../types/preset";
import {
  createStoredEntity,
  stripFileExtension,
  type StoredEntityOptions,
} from "./entityMetadata";
import {
  createImportResult,
  regexScriptsDetectedWarning,
  type ImportResult,
  unknownFieldsPreservedWarning,
  unsupportedThirdPartyDataPreservedWarning,
} from "./importResult";

export interface ImportPresetToDatabaseOptions extends StoredEntityOptions {
  database?: MySillyDatabaseConnection;
  name?: string;
}

export interface ImportedStoredPreset {
  preset: ChatCompletionPreset;
  regexScripts: RegexScript[];
  stored: StoredPreset;
  result: ImportResult<StoredPreset, ChatCompletionPreset>;
}

export function createStoredPreset(
  preset: ChatCompletionPreset,
  name: string,
  options: StoredEntityOptions = {},
): StoredPreset {
  return createStoredEntity(preset, name, "preset", options);
}

export async function importPresetToDatabase(
  bytes: Uint8Array,
  fileName: string,
  options: ImportPresetToDatabaseOptions = {},
): Promise<ImportedStoredPreset> {
  const preset = parseChatCompletionPresetJson(new TextDecoder().decode(bytes));
  const stored = createStoredPreset(
    preset,
    options.name ?? stripFileExtension(fileName),
    options,
  );
  const database = options.database ?? (await getMySillyDatabase());
  const regexScripts = extractRegexScripts(preset);

  await savePreset(stored, database);

  return {
    preset,
    regexScripts,
    stored,
    result: createImportResult("preset", fileName, stored, preset, [
      unknownFieldsPreservedWarning(),
      ...(regexScripts.length > 0
        ? [regexScriptsDetectedWarning(regexScripts.length)]
        : []),
      ...(preset.extensions?.tavern_helper || preset.extensions?.SPreset
        ? [unsupportedThirdPartyDataPreservedWarning()]
        : []),
    ]),
  };
}
