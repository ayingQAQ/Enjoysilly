import { extractRegexScripts } from "./presetIO";
import {
  getMySillyDatabase,
  listCharacters,
  listChats,
  listPresets,
  listWorlds,
  type MySillyDatabaseConnection,
  type StoredWorldInfo,
} from "./db";

export interface AssetStats {
  characters: number;
  presets: number;
  worlds: number;
  chats: number;
  regexScripts: number;
  worldEntries: number;
}

export async function loadAssetStats(
  database?: MySillyDatabaseConnection,
): Promise<AssetStats> {
  const db = database ?? (await getMySillyDatabase());
  const [characters, presets, worlds, chats] = await Promise.all([
    listCharacters(db),
    listPresets(db),
    listWorlds(db),
    listChats(db),
  ]);

  return {
    characters: characters.length,
    presets: presets.length,
    worlds: worlds.length,
    chats: chats.length,
    regexScripts: presets.reduce(
      (total, preset) => total + extractRegexScripts(preset.payload).length,
      0,
    ),
    worldEntries: worlds.reduce(
      (total, world) => total + countWorldInfoEntries(world),
      0,
    ),
  };
}

function countWorldInfoEntries(world: StoredWorldInfo): number {
  const entries = world.payload.entries;

  return Array.isArray(entries) ? entries.length : Object.keys(entries).length;
}
