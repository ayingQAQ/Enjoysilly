import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import {
  getSetting,
  listChats,
  listRegexScripts,
  openMySillyDatabase,
  resetDatabaseConnectionForTests,
  saveChat,
  savePreset,
  saveRegexScript,
  saveSetting,
  type StoredChat,
  type StoredPreset,
  type StoredRegexScript,
} from "../lib/db";
import type { ChatCompletionPreset, RegexScript } from "../types/preset";
import { collectBackupFiles, createBackupZip } from "./backupExport";
import { restoreFromBackupZip } from "./backupImport";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  resetDatabaseConnectionForTests();

  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_backup_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("backup round trip", () => {
  it("creates unique backup paths and records metadata", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await savePreset(createStoredPreset("preset-a", "同名"), database);
    await savePreset(createStoredPreset("preset-b", "同名"), database);
    await saveChat(createStoredChat(), database);
    await saveSetting(
      {
        key: "appSettings",
        value: { theme: "dark" },
        updatedAt: "2026-07-06T00:00:00.000Z",
      },
      database,
    );

    const { entries, manifest } = await collectBackupFiles(database);
    const paths = entries.map((entry) => entry.path);

    expect(paths).toContain("presets/同名.json");
    expect(paths).toContain("presets/同名-2.json");
    expect(paths).toContain("settings/appSettings.json");
    expect(manifest.counts.settings).toBe(1);
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "chats/群聊记录.jsonl",
          type: "chat",
          groupId: "group-1",
        }),
      ]),
    );

    database.close();
  });

  it("restores settings and binding metadata without overwriting existing ids", async () => {
    const source = await openMySillyDatabase(createTestDatabaseName());
    const target = await openMySillyDatabase(createTestDatabaseName());

    await saveChat(createStoredChat(), source);
    await saveRegexScript(createStoredRegexScript(), source);
    await saveSetting(
      {
        key: "appSettings",
        value: { theme: "dark", fontScale: "lg" },
        updatedAt: "2026-07-06T00:00:00.000Z",
      },
      source,
    );

    const zip = await createBackupZip(source);
    const result = await restoreFromBackupZip(zip, target);
    const restoredChats = await listChats(target);
    const restoredRegexScripts = await listRegexScripts(target);

    expect(result.errors).toEqual([]);
    expect(result.restored.chats).toBe(1);
    expect(result.restored.regexScripts).toBe(1);
    expect(result.restored.settings).toBe(1);
    expect(restoredChats[0]).toEqual(
      expect.objectContaining({
        groupId: "group-1",
        characterId: "char-1",
      }),
    );
    expect(restoredChats[0].id).not.toBe("chat-1");
    expect(restoredRegexScripts[0]).toEqual(
      expect.objectContaining({
        characterId: "char-1",
      }),
    );
    await expect(getSetting("appSettings", target)).resolves.toEqual(
      expect.objectContaining({
        value: { theme: "dark", fontScale: "lg" },
      }),
    );

    source.close();
    target.close();
  });
});

function createStoredPreset(id: string, name: string): StoredPreset {
  return {
    id,
    name,
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    payload: createPreset(),
  };
}

function createPreset(): ChatCompletionPreset {
  return {
    prompts: [
      {
        identifier: "main",
        role: "system",
        content: "You are {{char}}.",
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [{ identifier: "main", enabled: true }],
      },
    ],
  };
}

function createStoredChat(): StoredChat {
  return {
    id: "chat-1",
    name: "群聊记录",
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    characterId: "char-1",
    groupId: "group-1",
    payload: {
      metadata: {
        user_name: "User",
        character_name: "Alice",
        create_date: "2026-07-06@00h00m00s",
      },
      messages: [
        {
          name: "User",
          is_user: true,
          mes: "你好",
          send_date: "2026-07-06@00h00m01s",
          swipes: ["你好"],
          swipe_id: 0,
        },
      ],
    },
  };
}

function createStoredRegexScript(): StoredRegexScript {
  return {
    id: "regex-1",
    name: "替换",
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    characterId: "char-1",
    payload: createRegexScript(),
  };
}

function createRegexScript(): RegexScript {
  return {
    scriptName: "替换",
    findRegex: "/foo/g",
    replaceString: "bar",
    disabled: false,
  };
}
