import "fake-indexeddb/auto";

import { deleteDB, openDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import {
  deleteChat,
  deleteCharacter,
  deletePreset,
  deleteQuickReplySet,
  deleteRegexScript,
  deleteWorldInfo,
  getChat,
  getCharacter,
  getPreset,
  getQuickReplySet,
  getRegexScript,
  getSetting,
  getWorldInfo,
  listChatsByCharacterId,
  listPresets,
  listQuickReplySets,
  listRegexScripts,
  listRegexScriptsByCharacterId,
  listWorlds,
  openMySillyDatabase,
  resetDatabaseConnectionForTests,
  saveChat,
  saveCharacter,
  savePreset,
  saveQuickReplySet,
  saveRegexScript,
  saveSetting,
  saveWorldInfo,
} from "./db";
import type {
  StoredCharacter,
  StoredChat,
  StoredPreset,
  StoredQuickReplySet,
  StoredRegexScript,
  StoredWorldInfo,
} from "./db";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  resetDatabaseConnectionForTests();

  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_test_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("IndexedDB schema", () => {
  it("creates the planned object stores", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    expect(Array.from(database.objectStoreNames)).toEqual([
      "characters",
      "chats",
      "presets",
      "quickReplies",
      "regexScripts",
      "settings",
      "worlds",
    ]);

    database.close();
  });

  it("saves, reads, and deletes character records", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-07-03T15:00:00.000Z";
    const character: StoredCharacter = {
      id: "char-1",
      name: "测试角色",
      createdAt: now,
      updatedAt: now,
      payload: {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: {
          name: "测试角色",
          avatar: "keep",
          extensions: { custom: true },
        },
      },
    };

    await saveCharacter(character, database);
    await expect(getCharacter("char-1", database)).resolves.toEqual(character);

    await deleteCharacter("char-1", database);
    await expect(getCharacter("char-1", database)).resolves.toBeUndefined();

    database.close();
  });

  it("saves and reads settings by key", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const setting = {
      key: "api",
      value: {
        baseUrl: "http://localhost:11434/v1",
        model: "local-model",
      },
      updatedAt: "2026-07-03T15:00:00.000Z",
    };

    await saveSetting(setting, database);

    await expect(getSetting("api", database)).resolves.toEqual(setting);

    database.close();
  });

  it("saves, lists, and deletes presets", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-07-03T15:00:00.000Z";
    const preset: StoredPreset = {
      id: "preset-1",
      name: "测试预设",
      createdAt: now,
      updatedAt: now,
      payload: {
        prompts: [],
        prompt_order: [],
        extensions: {
          tavern_helper: { keep: true },
        },
      },
    };

    await savePreset(preset, database);

    await expect(getPreset("preset-1", database)).resolves.toEqual(preset);
    await expect(listPresets(database)).resolves.toEqual([preset]);

    await deletePreset("preset-1", database);
    await expect(getPreset("preset-1", database)).resolves.toBeUndefined();

    database.close();
  });

  it("saves, lists, and deletes world info records", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-07-03T15:00:00.000Z";
    const worldInfo: StoredWorldInfo = {
      id: "world-1",
      name: "测试世界书",
      createdAt: now,
      updatedAt: now,
      payload: {
        entries: [
          {
            keys: ["潇湘馆"],
            content: "林黛玉居所。",
            enabled: true,
          },
        ],
      },
    };

    await saveWorldInfo(worldInfo, database);

    await expect(getWorldInfo("world-1", database)).resolves.toEqual(worldInfo);
    await expect(listWorlds(database)).resolves.toEqual([worldInfo]);

    await deleteWorldInfo("world-1", database);
    await expect(getWorldInfo("world-1", database)).resolves.toBeUndefined();

    database.close();
  });

  it("saves, indexes, and deletes chat records", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-07-03T15:00:00.000Z";
    const chat: StoredChat = {
      id: "chat-1",
      name: "测试对话",
      characterId: "char-1",
      createdAt: now,
      updatedAt: now,
      payload: {
        metadata: {
          character_name: "林黛玉",
        },
        messages: [
          {
            name: "林黛玉",
            mes: "你来了。",
          },
        ],
      },
    };

    await saveChat(chat, database);

    await expect(getChat("chat-1", database)).resolves.toEqual(chat);
    await expect(listChatsByCharacterId("char-1", database)).resolves.toEqual([
      chat,
    ]);

    await deleteChat("chat-1", database);
    await expect(getChat("chat-1", database)).resolves.toBeUndefined();

    database.close();
  });

  it("deletes world info without cascading to other stores", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-07-04T14:30:00.000Z";

    await saveCharacter(
      {
        id: "char-linked",
        name: "关联角色",
        createdAt: now,
        updatedAt: now,
        payload: {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: {
            name: "关联角色",
          },
        },
      },
      database,
    );
    await saveWorldInfo(
      {
        id: "world-linked",
        name: "待删世界书",
        createdAt: now,
        updatedAt: now,
        payload: {
          entries: [],
        },
      },
      database,
    );
    await savePreset(
      {
        id: "preset-linked",
        name: "关联预设",
        createdAt: now,
        updatedAt: now,
        payload: {
          prompts: [],
          prompt_order: [],
        },
      },
      database,
    );
    await saveChat(
      {
        id: "chat-linked",
        name: "关联对话",
        characterId: "char-linked",
        createdAt: now,
        updatedAt: now,
        payload: {
          metadata: {},
          messages: [],
        },
      },
      database,
    );

    await deleteWorldInfo("world-linked", database);

    await expect(getWorldInfo("world-linked", database)).resolves.toBeUndefined();
    await expect(getCharacter("char-linked", database)).resolves.toBeDefined();
    await expect(getPreset("preset-linked", database)).resolves.toBeDefined();
    await expect(getChat("chat-linked", database)).resolves.toBeDefined();

    database.close();
  });

  it("deletes preset without cascading to other stores", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-07-04T16:10:00.000Z";

    await saveCharacter(
      {
        id: "char-linked",
        name: "关联角色",
        createdAt: now,
        updatedAt: now,
        payload: {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: {
            name: "关联角色",
          },
        },
      },
      database,
    );
    await saveWorldInfo(
      {
        id: "world-linked",
        name: "关联世界书",
        createdAt: now,
        updatedAt: now,
        payload: {
          entries: [],
        },
      },
      database,
    );
    await savePreset(
      {
        id: "preset-linked",
        name: "待删预设",
        createdAt: now,
        updatedAt: now,
        payload: {
          prompts: [],
          prompt_order: [],
        },
      },
      database,
    );
    await saveChat(
      {
        id: "chat-linked",
        name: "关联对话",
        characterId: "char-linked",
        createdAt: now,
        updatedAt: now,
        payload: {
          metadata: {},
          messages: [],
        },
      },
      database,
    );
    await saveSetting(
      {
        key: "api",
        value: {
          baseUrl: "http://localhost:11434/v1",
        },
        updatedAt: now,
      },
      database,
    );

    await deletePreset("preset-linked", database);

    await expect(getPreset("preset-linked", database)).resolves.toBeUndefined();
    await expect(getCharacter("char-linked", database)).resolves.toBeDefined();
    await expect(getWorldInfo("world-linked", database)).resolves.toBeDefined();
    await expect(getChat("chat-linked", database)).resolves.toBeDefined();
    await expect(getSetting("api", database)).resolves.toBeDefined();

    database.close();
  });

  it("saves, lists by character, and deletes regex script records", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-07-06T15:00:00.000Z";
    const script: StoredRegexScript = {
      id: "regex-1",
      name: "测试正则",
      createdAt: now,
      updatedAt: now,
      characterId: "char-1",
      payload: {
        id: "s1",
        scriptName: "测试正则",
        findRegex: "hello",
        replaceString: "world",
        placement: [1, 2],
        disabled: false,
      },
    };

    await saveRegexScript(script, database);

    await expect(getRegexScript("regex-1", database)).resolves.toEqual(script);
    await expect(listRegexScripts(database)).resolves.toEqual([script]);
    await expect(listRegexScriptsByCharacterId("char-1", database)).resolves.toEqual([script]);
    await expect(listRegexScriptsByCharacterId("char-other", database)).resolves.toEqual([]);

    await deleteRegexScript("regex-1", database);
    await expect(getRegexScript("regex-1", database)).resolves.toBeUndefined();

    database.close();
  });

  it("upgrades an existing v1 database without deleting stored data", async () => {
    const databaseName = createTestDatabaseName();
    const now = "2026-07-06T16:00:00.000Z";
    const v1Database = await openDB(databaseName, 1, {
      upgrade(database) {
        const characterStore = database.createObjectStore("characters", {
          keyPath: "id",
        });
        characterStore.createIndex("by-name", "name");
        characterStore.createIndex("by-updatedAt", "updatedAt");
        database.createObjectStore("settings", { keyPath: "key" });
      },
    });

    await v1Database.put("characters", {
      id: "char-v1",
      name: "旧库角色",
      createdAt: now,
      updatedAt: now,
      payload: {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: {
          name: "旧库角色",
        },
      },
    });
    v1Database.close();

    const upgradedDatabase = await openMySillyDatabase(databaseName);

    expect(Array.from(upgradedDatabase.objectStoreNames)).toContain(
      "regexScripts",
    );

    expect(Array.from(upgradedDatabase.objectStoreNames)).toContain(
      "quickReplies",
    );
    await expect(getCharacter("char-v1", upgradedDatabase)).resolves.toEqual(
      expect.objectContaining({
        id: "char-v1",
        name: "旧库角色",
      }),
    );

    upgradedDatabase.close();
  });

  it("upgrades an existing v2 database to v3 without deleting regex data", async () => {
    const databaseName = createTestDatabaseName();
    const now = "2026-07-06T16:30:00.000Z";
    const v2Database = await openDB(databaseName, 2, {
      upgrade(database) {
        const characterStore = database.createObjectStore("characters", {
          keyPath: "id",
        });
        characterStore.createIndex("by-name", "name");
        characterStore.createIndex("by-updatedAt", "updatedAt");
        const regexStore = database.createObjectStore("regexScripts", {
          keyPath: "id",
        });
        regexStore.createIndex("by-name", "name");
        regexStore.createIndex("by-characterId", "characterId");
        regexStore.createIndex("by-updatedAt", "updatedAt");
      },
    });

    await v2Database.put("regexScripts", {
      id: "regex-v2",
      name: "旧库正则",
      createdAt: now,
      updatedAt: now,
      payload: {
        scriptName: "旧库正则",
        findRegex: "hello",
        replaceString: "world",
      },
    });
    v2Database.close();

    const upgradedDatabase = await openMySillyDatabase(databaseName);

    expect(Array.from(upgradedDatabase.objectStoreNames)).toContain(
      "quickReplies",
    );
    await expect(getRegexScript("regex-v2", upgradedDatabase)).resolves.toEqual(
      expect.objectContaining({
        id: "regex-v2",
        name: "旧库正则",
      }),
    );

    upgradedDatabase.close();
  });

  it("saves, lists, and deletes quick reply sets", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-07-06T16:00:00.000Z";
    const qrSet: StoredQuickReplySet = {
      id: "qr-1",
      name: "测试快捷回复",
      createdAt: now,
      updatedAt: now,
      payload: {
        name: "测试集",
        version: 2,
        qrList: [
          { label: "打招呼", message: "你好！" },
          { label: "再见", message: "拜拜", isAuto: true },
        ],
      },
    };

    await saveQuickReplySet(qrSet, database);

    await expect(getQuickReplySet("qr-1", database)).resolves.toEqual(qrSet);
    await expect(listQuickReplySets(database)).resolves.toEqual([qrSet]);

    await deleteQuickReplySet("qr-1", database);
    await expect(getQuickReplySet("qr-1", database)).resolves.toBeUndefined();

    database.close();
  });
});
