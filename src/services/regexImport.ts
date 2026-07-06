import {
  createStoredEntity,
  stripFileExtension,
} from "./entityMetadata";
import {
  saveRegexScript,
  type MySillyDatabaseConnection,
  type StoredRegexScript,
} from "../lib/db";
import {
  createRegexScriptFileName,
  encodeRegexScriptsJson,
  parseRegexScriptsJson,
} from "../lib/regexIO";
import type { RegexScript } from "../types/preset";

export interface RegexImportResult {
  stored: StoredRegexScript;
  script: RegexScript;
  fileName: string;
}

export function importRegexScript(
  json: string,
  fileName: string,
  options: { characterId?: string } = {},
): RegexImportResult[] {
  const { scripts } = parseRegexScriptsJson(json);

  return scripts.map((script) => {
    const name = script.scriptName ?? stripFileExtension(fileName);
    const stored = createStoredEntity<RegexScript>(
      script,
      name,
      "regex_",
    ) as StoredRegexScript;
    stored.characterId = options.characterId;

    return {
      stored,
      script,
      fileName,
    };
  });
}

export async function importRegexScriptToDatabase(
  json: string,
  fileName: string,
  options: {
    characterId?: string;
    database?: MySillyDatabaseConnection;
  } = {},
): Promise<RegexImportResult[]> {
  const results = importRegexScript(json, fileName, options);

  for (const result of results) {
    await saveRegexScript(result.stored, options.database);
  }

  return results;
}

export function createRegexScriptExport(script: RegexScript): {
  fileName: string;
  bytes: Uint8Array;
} {
  return {
    fileName: createRegexScriptFileName(script),
    bytes: encodeRegexScriptsJson([script]),
  };
}
