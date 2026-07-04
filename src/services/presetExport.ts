import {
  getMySillyDatabase,
  getPreset,
  type MySillyDatabaseConnection,
  type StoredPreset,
} from "../lib/db";
import { encodeChatCompletionPresetJson } from "../lib/presetIO";
import { createSafeJsonFileName } from "./exportFileName";

export interface PresetJsonExport {
  fileName: string;
  bytes: Uint8Array;
  stored: StoredPreset;
}

export async function createPresetJsonExport(
  presetId: string,
  database?: MySillyDatabaseConnection,
): Promise<PresetJsonExport> {
  const db = database ?? (await getMySillyDatabase());
  const stored = await getPreset(presetId, db);

  if (!stored) {
    throw new Error(`找不到预设：${presetId}`);
  }

  return {
    fileName: createPresetJsonFileName(stored.name),
    bytes: encodeChatCompletionPresetJson(stored.payload),
    stored,
  };
}

export function createPresetJsonFileName(name: string): string {
  return createSafeJsonFileName(name, "preset");
}
