import { unzip } from "fflate";

import { parseCharacterCardJson } from "../lib/cardIO";
import { parseSillyTavernChatJsonl } from "../lib/chatIO";
import {
  saveCharacter,
  saveChat,
  saveGroup,
  savePreset,
  saveQuickReplySet,
  saveRegexScript,
  saveSetting,
  saveWorldInfo,
  type MySillyDatabaseConnection,
  type StoredCharacter,
  type StoredChat,
  type StoredEntity,
  type StoredGroup,
  type StoredPreset,
  type StoredQuickReplySet,
  type StoredRegexScript,
  type StoredWorldInfo,
} from "../lib/db";
import { parseChatCompletionPresetJson } from "../lib/presetIO";
import { parseQuickReplySetJson } from "../lib/quickReplyIO";
import { parseRegexScriptsJson } from "../lib/regexIO";
import { parseWorldInfoJson } from "../lib/worldInfoIO";
import { createEntityId } from "./entityMetadata";
import type { BackupManifest, BackupManifestFile } from "./backupExport";

export interface BackupRestoreResult {
  manifest: BackupManifest;
  restored: {
    characters: number;
    worlds: number;
    presets: number;
    chats: number;
    regexScripts: number;
    quickReplies: number;
    groups: number;
    settings: number;
  };
  errors: string[];
}

export async function restoreFromBackupZip(
  zipBytes: Uint8Array,
  database?: MySillyDatabaseConnection,
): Promise<BackupRestoreResult> {
  const files = await unzipBackup(zipBytes);

  const manifestEntry = files["backup.json"];
  if (!manifestEntry) {
    throw new Error("备份文件缺少 backup.json，可能不是 my_silly 备份。");
  }

  const manifest = parseBackupManifest(manifestEntry);
  const manifestFiles = new Map(manifest.files.map((file) => [file.path, file]));
  const errors: string[] = [];
  const restored: BackupRestoreResult["restored"] = {
    characters: 0,
    worlds: 0,
    presets: 0,
    chats: 0,
    regexScripts: 0,
    quickReplies: 0,
    groups: 0,
    settings: 0,
  };

  for (const [path, bytes] of Object.entries(files)) {
    if (path === "backup.json") continue;

    try {
      const restoredEntry = await restoreFileEntry(
        path,
        bytes,
        manifestFiles.get(path),
        database,
      );

      if (restoredEntry) {
        restored[restoredEntry.type] += restoredEntry.count;
      }
    } catch (err: unknown) {
      errors.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { manifest, restored, errors };
}

function parseBackupManifest(bytes: Uint8Array): BackupManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch (err: unknown) {
    throw new Error(`backup.json 不是有效 JSON：${err instanceof Error ? err.message : String(err)}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("backup.json 格式无效。");
  }

  const manifest = parsed as BackupManifest;

  return {
    ...manifest,
    files: Array.isArray(manifest.files) ? manifest.files : [],
    counts: {
      characters: manifest.counts?.characters ?? 0,
      worlds: manifest.counts?.worlds ?? 0,
      presets: manifest.counts?.presets ?? 0,
      chats: manifest.counts?.chats ?? 0,
      regexScripts: manifest.counts?.regexScripts ?? 0,
      quickReplies: manifest.counts?.quickReplies ?? 0,
      groups: manifest.counts?.groups ?? 0,
      settings: manifest.counts?.settings ?? 0,
    },
  };
}

function unzipBackup(zipBytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(zipBytes, (err, data) => {
      if (err) {
        reject(new Error(err.message ?? String(err)));
      } else {
        resolve(data);
      }
    });
  });
}

async function restoreFileEntry(
  path: string,
  bytes: Uint8Array,
  manifestFile: BackupManifestFile | undefined,
  database?: MySillyDatabaseConnection,
): Promise<{ type: keyof BackupRestoreResult["restored"]; count: number } | undefined> {
  const text = new TextDecoder().decode(bytes);

  if (path.startsWith("characters/")) {
    const card = parseCharacterCardJson(text);
    const stored = createStoredBackupEntity(
      card,
      card.data.name || stripBackupPath(path, "characters/", ".json"),
      "char_",
      manifestFile,
    ) as StoredCharacter;
    await saveCharacter(stored, database);
    return { type: "characters", count: 1 };
  }

  if (path.startsWith("worlds/")) {
    const worldInfo = parseWorldInfoJson(text);
    const stored = createStoredBackupEntity(
      worldInfo,
      stripBackupPath(path, "worlds/", ".json"),
      "world_",
      manifestFile,
    ) as StoredWorldInfo;
    await saveWorldInfo(stored, database);
    return { type: "worlds", count: 1 };
  }

  if (path.startsWith("presets/")) {
    const preset = parseChatCompletionPresetJson(text);
    const stored = createStoredBackupEntity(
      preset,
      stripBackupPath(path, "presets/", ".json"),
      "preset_",
      manifestFile,
    ) as StoredPreset;
    await savePreset(stored, database);
    return { type: "presets", count: 1 };
  }

  if (path.startsWith("chats/")) {
    const chat = parseSillyTavernChatJsonl(text);
    const stored = {
      ...createStoredBackupEntity(
        chat,
        stripBackupPath(path, "chats/", ".jsonl"),
        "chat_",
        manifestFile,
      ),
      characterId: manifestFile?.characterId,
      groupId: manifestFile?.groupId,
    } as StoredChat;
    await saveChat(stored, database);
    return { type: "chats", count: 1 };
  }

  if (path.startsWith("regex/")) {
    const { scripts } = parseRegexScriptsJson(text);

    for (const script of scripts) {
      const stored = {
        ...createStoredBackupEntity(
          script,
          script.scriptName,
          "regex_",
          manifestFile,
        ),
        characterId: manifestFile?.characterId,
      } as StoredRegexScript;
      await saveRegexScript(stored, database);
    }

    return scripts.length > 0 ? { type: "regexScripts", count: scripts.length } : undefined;
  }

  if (path.startsWith("quick-replies/")) {
    const qrSet = parseQuickReplySetJson(text);
    const stored = createStoredBackupEntity(
      qrSet,
      qrSet.name,
      "qr_",
      manifestFile,
    ) as StoredQuickReplySet;
    await saveQuickReplySet(stored, database);
    return { type: "quickReplies", count: 1 };
  }

  if (path.startsWith("groups/")) {
    const groupConfig = JSON.parse(text);
    const stored = createStoredBackupEntity(
      groupConfig,
      stripBackupPath(path, "groups/", ".json"),
      "group_",
      manifestFile,
    ) as StoredGroup;
    await saveGroup(stored, database);
    return { type: "groups", count: 1 };
  }

  if (path.startsWith("settings/")) {
    const key = manifestFile?.key ?? stripBackupPath(path, "settings/", ".json");
    const value = JSON.parse(text);
    await saveSetting(
      {
        key,
        value,
        updatedAt: manifestFile?.updatedAt ?? new Date().toISOString(),
      },
      database,
    );
    return { type: "settings", count: 1 };
  }

  return undefined;
}

function createStoredBackupEntity<TPayload>(
  payload: TPayload,
  fallbackName: string,
  idPrefix: string,
  manifestFile: BackupManifestFile | undefined,
): StoredEntity<TPayload> {
  const now = new Date().toISOString();

  return {
    id: createEntityId(idPrefix),
    name: normalizeName(manifestFile?.name ?? fallbackName),
    createdAt: manifestFile?.createdAt ?? now,
    updatedAt: manifestFile?.updatedAt ?? now,
    payload,
  };
}

function stripBackupPath(path: string, prefix: string, extension: string): string {
  return path.replace(prefix, "").replace(new RegExp(`${escapeRegExp(extension)}$`), "");
}

function normalizeName(value: string): string {
  const normalized = value.trim();

  return normalized.length > 0 ? normalized : "未命名";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
