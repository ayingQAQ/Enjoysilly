import { getMySillyDatabase, saveWorldInfo } from "../lib/db";
import type {
  MySillyDatabaseConnection,
  StoredCharacter,
  StoredPreset,
  StoredWorldInfo,
} from "../lib/db";
import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";
import type { PortableCharacterBook } from "../types/worldinfo";
import { importCharacterToDatabase, type ImportedStoredCharacter } from "./characterImport";
import {
  createImportResult,
  type ImportResult,
  unknownFieldsPreservedWarning,
} from "./importResult";
import { importPresetToDatabase, type ImportedStoredPreset } from "./presetImport";
import { createStoredWorldInfo } from "./worldInfoImport";

export const bundledSampleFiles = {
  character: {
    fileName: "红楼.png",
    path: `/test-fixtures/${encodeURIComponent("红楼.png")}`,
  },
  preset: {
    fileName: "【DarkSide-小猫之神】v2test.json",
    path: `/test-fixtures/${encodeURIComponent("【DarkSide-小猫之神】v2test.json")}`,
  },
} as const;

export const bundledSampleIds = {
  character: "sample-honglou-character",
  preset: "sample-darkside-preset",
  world: "sample-honglou-world",
} as const;

export type BundledSampleImportResult =
  | ImportResult<StoredCharacter, CharacterCard>
  | ImportResult<StoredPreset, ChatCompletionPreset>
  | ImportResult<StoredWorldInfo, PortableCharacterBook>;

export interface ImportBundledSamplesOptions {
  database?: MySillyDatabaseConnection;
  fetchBytes?: (path: string) => Promise<Uint8Array>;
  now?: () => string;
}

export interface ImportedBundledSampleWorldInfo {
  worldInfo: PortableCharacterBook;
  stored: StoredWorldInfo;
  result: ImportResult<StoredWorldInfo, PortableCharacterBook>;
}

export interface ImportedBundledSamples {
  character: ImportedStoredCharacter;
  preset: ImportedStoredPreset;
  worldInfo?: ImportedBundledSampleWorldInfo;
  results: BundledSampleImportResult[];
}

export async function importBundledSamplesToDatabase(
  options: ImportBundledSamplesOptions = {},
): Promise<ImportedBundledSamples> {
  const database = options.database ?? (await getMySillyDatabase());
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  const [characterBytes, presetBytes] = await Promise.all([
    fetchBytes(bundledSampleFiles.character.path),
    fetchBytes(bundledSampleFiles.preset.path),
  ]);

  const character = await importCharacterToDatabase(
    characterBytes,
    bundledSampleFiles.character.fileName,
    {
      database,
      embeddedWorldInfoId: bundledSampleIds.world,
      id: bundledSampleIds.character,
      now: options.now,
    },
  );
  const preset = await importPresetToDatabase(
    presetBytes,
    bundledSampleFiles.preset.fileName,
    {
      database,
      id: bundledSampleIds.preset,
      now: options.now,
    },
  );

  const results: BundledSampleImportResult[] = [character.result, preset.result];
  const worldInfo = await importEmbeddedCharacterBook(character, database, options.now);

  if (worldInfo) {
    results.push(worldInfo.result);
  }

  return {
    character,
    preset,
    worldInfo,
    results,
  };
}

async function importEmbeddedCharacterBook(
  character: ImportedStoredCharacter,
  database: MySillyDatabaseConnection,
  now?: () => string,
): Promise<ImportedBundledSampleWorldInfo | undefined> {
  const characterBook = character.imported.card.data.character_book;

  if (!characterBook) {
    return undefined;
  }

  const stored = createStoredWorldInfo(
    characterBook,
    `${character.imported.card.data.name} · 内嵌世界书`,
    {
      id: bundledSampleIds.world,
      now,
    },
  );

  await saveWorldInfo(stored, database);

  return {
    worldInfo: characterBook,
    stored,
    result: createImportResult(
      "world",
      bundledSampleFiles.character.fileName,
      stored,
      characterBook,
      [unknownFieldsPreservedWarning()],
    ),
  };
}

async function defaultFetchBytes(path: string): Promise<Uint8Array> {
  if (typeof fetch !== "function") {
    throw new Error("当前运行环境不支持 fetch，无法读取内置样本。");
  }

  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`读取内置样本失败：${path} (${response.status})`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
