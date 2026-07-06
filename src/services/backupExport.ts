import { zip } from "fflate";

import { encodeCharacterCardJson } from "../lib/cardIO";
import { encodeSillyTavernChatJsonl } from "../lib/chatIO";
import {
  listCharacters,
  listChats,
  listGroups,
  listPresets,
  listQuickReplySets,
  listRegexScripts,
  listSettings,
  listWorlds,
  type MySillyDatabaseConnection,
  type StoredEntity,
} from "../lib/db";
import { encodeChatCompletionPresetJson } from "../lib/presetIO";
import { encodeQuickReplySetJson } from "../lib/quickReplyIO";
import { encodeRegexScriptsJson } from "../lib/regexIO";
import { serializeWorldInfoJson } from "../lib/worldInfoIO";

export type BackupEntityType =
  | "character"
  | "world"
  | "preset"
  | "chat"
  | "regex"
  | "quickReply"
  | "group"
  | "setting";

export interface BackupManifestFile {
  path: string;
  type: BackupEntityType;
  id?: string;
  key?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  characterId?: string;
  groupId?: string;
}

export interface BackupManifest {
  mySillyVersion: string;
  exportedAt: string;
  counts: {
    characters: number;
    worlds: number;
    presets: number;
    chats: number;
    regexScripts: number;
    quickReplies: number;
    groups: number;
    settings: number;
  };
  files: BackupManifestFile[];
}

interface BackupFileEntry {
  path: string;
  bytes: Uint8Array;
}

export async function createBackupZip(
  database?: MySillyDatabaseConnection,
): Promise<Uint8Array> {
  const { entries } = await collectBackupFiles(database);

  return new Promise<Uint8Array>((resolve, reject) => {
    const fileMap: Record<string, Uint8Array> = {};

    for (const entry of entries) {
      fileMap[entry.path] = entry.bytes;
    }

    zip(fileMap, { level: 6 }, (err, data) => {
      if (err) {
        reject(new Error(err.message ?? String(err)));
      } else {
        resolve(data);
      }
    });
  });
}

export async function collectBackupFiles(
  database?: MySillyDatabaseConnection,
): Promise<{ entries: BackupFileEntry[]; manifest: BackupManifest }> {
  const [
    characters,
    worlds,
    presets,
    chats,
    regexScripts,
    quickReplies,
    groups,
    settings,
  ] = await Promise.all([
    listCharacters(database),
    listWorlds(database),
    listPresets(database),
    listChats(database),
    listRegexScripts(database),
    listQuickReplySets(database),
    listGroups(database),
    listSettings(database),
  ]);

  const usedPaths = new Set<string>();
  const entries: BackupFileEntry[] = [];
  const files: BackupManifestFile[] = [];

  function addEntry(path: string, bytes: Uint8Array, file: Omit<BackupManifestFile, "path">): void {
    const unique = createUniquePath(path, usedPaths);
    entries.push({ path: unique, bytes });
    files.push({ ...file, path: unique });
  }

  for (const character of characters) {
    addEntry(
      `characters/${safeFileName(character.name)}.json`,
      encodeCharacterCardJson(character.payload),
      createStoredEntityManifest("character", character),
    );
  }

  for (const world of worlds) {
    addEntry(
      `worlds/${safeFileName(world.name)}.json`,
      new TextEncoder().encode(serializeWorldInfoJson(world.payload)),
      createStoredEntityManifest("world", world),
    );
  }

  for (const preset of presets) {
    addEntry(
      `presets/${safeFileName(preset.name)}.json`,
      encodeChatCompletionPresetJson(preset.payload),
      createStoredEntityManifest("preset", preset),
    );
  }

  for (const chat of chats) {
    addEntry(
      `chats/${safeFileName(chat.name)}.jsonl`,
      encodeSillyTavernChatJsonl(chat.payload),
      {
        ...createStoredEntityManifest("chat", chat),
        characterId: chat.characterId,
        groupId: chat.groupId,
      },
    );
  }

  for (const script of regexScripts) {
    addEntry(
      `regex/${safeFileName(script.name)}.json`,
      encodeRegexScriptsJson([script.payload]),
      {
        ...createStoredEntityManifest("regex", script),
        characterId: script.characterId,
      },
    );
  }

  for (const qr of quickReplies) {
    addEntry(
      `quick-replies/${safeFileName(qr.name)}.json`,
      encodeQuickReplySetJson(qr.payload),
      createStoredEntityManifest("quickReply", qr),
    );
  }

  for (const group of groups) {
    addEntry(
      `groups/${safeFileName(group.name)}.json`,
      new TextEncoder().encode(JSON.stringify(group.payload, null, 2)),
      createStoredEntityManifest("group", group),
    );
  }

  for (const setting of settings) {
    addEntry(
      `settings/${safeFileName(setting.key)}.json`,
      new TextEncoder().encode(JSON.stringify(setting.value, null, 2)),
      {
        type: "setting",
        key: setting.key,
        updatedAt: setting.updatedAt,
      },
    );
  }

  const manifest: BackupManifest = {
    mySillyVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    counts: {
      characters: characters.length,
      worlds: worlds.length,
      presets: presets.length,
      chats: chats.length,
      regexScripts: regexScripts.length,
      quickReplies: quickReplies.length,
      groups: groups.length,
      settings: settings.length,
    },
    files,
  };

  entries.unshift({
    path: "backup.json",
    bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
  });

  return { entries, manifest };
}

function createStoredEntityManifest(
  type: Exclude<BackupEntityType, "setting">,
  stored: StoredEntity<unknown>,
): Omit<BackupManifestFile, "path"> {
  return {
    type,
    id: stored.id,
    name: stored.name,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

function createUniquePath(path: string, usedPaths: Set<string>): string {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const dotIndex = path.lastIndexOf(".");
  const base = dotIndex > -1 ? path.slice(0, dotIndex) : path;
  const extension = dotIndex > -1 ? path.slice(dotIndex) : "";
  let counter = 2;

  while (usedPaths.has(`${base}-${counter}${extension}`)) {
    counter += 1;
  }

  const unique = `${base}-${counter}${extension}`;
  usedPaths.add(unique);
  return unique;
}

function safeFileName(name: string): string {
  const safe = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .trim()
    .slice(0, 80);

  return safe.length > 0 ? safe : "unnamed";
}
