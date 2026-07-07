import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import {
  getCharacter,
  openMySillyDatabase,
  resetDatabaseConnectionForTests,
  saveCharacter,
  saveChat,
  saveGroup,
  savePreset,
  saveQuickReplySet,
  saveRegexScript,
  saveWorldInfo,
  type StoredCharacter,
  type StoredChat,
  type StoredGroup,
  type StoredPreset,
  type StoredQuickReplySet,
  type StoredRegexScript,
  type StoredWorldInfo,
} from "../lib/db";
import type { ChatCompletionPreset, RegexScript } from "../types/preset";
import {
  analyzeLocalAssetDeletion,
  getLocalAssetUsageReport,
  loadLocalAssetInventory,
  toAssetKey,
  type LocalAssetKind,
  type LocalAssetLink,
  type LocalAssetRef,
} from "./localAssetManagement";
import { saveAppSettings, saveUserPersonas } from "./settingsStore";

const testDatabaseNames: string[] = [];
const now = "2026-07-07T12:00:00.000Z";

afterEach(async () => {
  resetDatabaseConnectionForTests();
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_local_assets_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("local asset management", () => {
  it("builds a unified local inventory without mutating stored payloads", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const character = createStoredCharacter();
    const originalCharacter = structuredClone(character);

    await saveCharacter(character, database);
    await saveWorldInfo(createStoredWorld(), database);
    await savePreset(createStoredPreset(), database);
    await saveRegexScript(createStoredRegexScript(), database);
    await saveQuickReplySet(createStoredQuickReplySet(), database);
    await saveGroup(createStoredGroup(), database);
    await saveChat(createStoredChat(), database);
    await saveAppSettings(
      {
        api: { baseUrl: "http://127.0.0.1:8000/v1", apiKey: "", model: "local" },
        defaultPresetId: "preset-1",
        defaultWorldId: "world-1",
        defaultQuickReplySetId: "qr-1",
        theme: "system",
        fontScale: "md",
      },
      { database, now: new Date(now) },
    );
    await saveUserPersonas(
      [
        {
          id: "persona-1",
          name: "玩家",
          description: "测试 persona",
          isDefault: true,
        },
      ],
      { database, now: new Date(now) },
    );

    const inventory = await loadLocalAssetInventory(database);

    expect(inventory.counts).toMatchObject({
      character: 1,
      world: 1,
      preset: 1,
      regex: 1,
      quickReply: 1,
      group: 1,
      chat: 1,
      setting: 2,
      persona: 1,
      embeddedWorld: 1,
      embeddedRegex: 2,
    } satisfies Partial<Record<LocalAssetKind, number>>);
    expect(findAsset(inventory.assets, { kind: "character", id: "char-1" })).toMatchObject({
      name: "红楼梦世界",
      readOnly: false,
      source: {
        type: "importedFile",
        fileName: "红楼.png",
      },
      summary: {
        embeddedWorldEntryCount: 1,
        embeddedRegexCount: 1,
        hasSourcePng: true,
      },
    });
    expect(findAsset(inventory.assets, {
      kind: "embeddedWorld",
      id: "char-1:character_book",
    })).toMatchObject({
      readOnly: true,
      storage: "embedded",
      source: {
        parent: { kind: "character", id: "char-1" },
      },
    });
    expect(findAsset(inventory.assets, {
      kind: "embeddedRegex",
      id: "char-1:regex:0",
    })).toMatchObject({
      name: "红楼梦世界 · 状态栏",
      readOnly: true,
      summary: {
        runOnEdit: true,
        hasFindRegex: true,
      },
    });

    expect(linkKeys(inventory.links)).toEqual(
      expect.arrayContaining([
        "character:char-1->embeddedRegex:char-1:regex:0:contains:true",
        "character:char-1->embeddedWorld:char-1:character_book:contains:true",
        "chat:chat-1->character:char-1:uses:true",
        "chat:chat-1->preset:preset-1:references:true",
        "chat:chat-1->quickReply:qr-1:references:true",
        "chat:chat-1->world:world-1:references:true",
        "group:group-1->character:char-1:uses:true",
        "preset:preset-1->embeddedRegex:preset-1:regex:0:contains:true",
        "regex:regex-1->character:char-1:boundTo:true",
        "setting:appSettings->preset:preset-1:default:true",
        "setting:appSettings->quickReply:qr-1:default:true",
        "setting:appSettings->world:world-1:default:true",
        "setting:userPersonas->persona:persona-1:contains:true",
      ]),
    );
    await expect(getCharacter("char-1", database)).resolves.toEqual(originalCharacter);

    database.close();
  });

  it("reports blocking references before deleting a stored asset", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await saveCharacter(createStoredCharacter(), database);
    await saveRegexScript(createStoredRegexScript(), database);
    await saveGroup(createStoredGroup(), database);
    await saveChat(createStoredChat(), database);

    const report = await analyzeLocalAssetDeletion(
      { kind: "character", id: "char-1" },
      database,
    );

    expect(report.canDeleteDirectly).toBe(false);
    expect(report.reason).toContain("仍被 3 个本地对象引用");
    expect(report.blockingIncoming.map((link) => toAssetKey(link.source)).sort()).toEqual([
      "chat:chat-1",
      "group:group-1",
      "regex:regex-1",
    ]);

    database.close();
  });

  it("treats embedded assets as read-only derived records", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await saveCharacter(createStoredCharacter(), database);

    const inventory = await loadLocalAssetInventory(database);
    const report = getLocalAssetUsageReport(inventory, {
      kind: "embeddedWorld",
      id: "char-1:character_book",
    });

    expect(report.asset?.readOnly).toBe(true);
    expect(report.canDeleteDirectly).toBe(false);
    expect(report.reason).toContain("只读资产");

    database.close();
  });

  it("keeps dangling links visible for broken local bindings", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await saveChat(
      {
        ...createStoredChat(),
        characterId: "missing-character",
      },
      database,
    );

    const inventory = await loadLocalAssetInventory(database);

    expect(inventory.links).toContainEqual(
      expect.objectContaining({
        source: { kind: "chat", id: "chat-1" },
        target: { kind: "character", id: "missing-character" },
        targetExists: false,
      } satisfies Partial<LocalAssetLink>),
    );

    database.close();
  });
});

function createStoredCharacter(): StoredCharacter {
  return {
    id: "char-1",
    name: "红楼梦世界",
    createdAt: now,
    updatedAt: now,
    sourceFileName: "红楼.png",
    sourcePngBytes: new Uint8Array([1, 2, 3]),
    payload: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "红楼梦世界",
        tags: ["测试"],
        character_book: {
          name: "内嵌世界书",
          entries: [
            {
              keys: ["大观园"],
              content: "大观园世界书条目",
              enabled: true,
              insertion_order: 10,
              position: "before_char",
            },
          ],
        },
        extensions: {
          regex_scripts: [
            {
              scriptName: "状态栏",
              findRegex: "/状态栏：([\\s\\S]*)/g",
              replaceString: "<status>$1</status>",
              placement: [2],
              runOnEdit: true,
            },
          ],
        },
      },
    },
  };
}

function createStoredWorld(): StoredWorldInfo {
  return {
    id: "world-1",
    name: "独立世界书",
    createdAt: now,
    updatedAt: now,
    payload: {
      entries: {
        "0": {
          key: ["关键词"],
          content: "世界书内容",
          order: 1,
          position: 0,
          disable: false,
          constant: true,
        },
      },
    },
  };
}

function createStoredPreset(): StoredPreset {
  return {
    id: "preset-1",
    name: "测试预设",
    createdAt: now,
    updatedAt: now,
    payload: {
      prompts: [{ identifier: "main", role: "system", content: "你是 {{char}}" }],
      prompt_order: [
        {
          character_id: 100001,
          order: [{ identifier: "main", enabled: true }],
        },
      ],
      extensions: {
        regex_scripts: [
          {
            scriptName: "预设正则",
            findRegex: "/foo/g",
            replaceString: "bar",
          },
        ],
      },
    } satisfies ChatCompletionPreset,
  };
}

function createStoredRegexScript(): StoredRegexScript {
  return {
    id: "regex-1",
    name: "本地正则",
    characterId: "char-1",
    createdAt: now,
    updatedAt: now,
    payload: createRegexScript(),
  };
}

function createRegexScript(): RegexScript {
  return {
    scriptName: "本地正则",
    findRegex: "/hello/g",
    replaceString: "world",
    disabled: false,
  };
}

function createStoredQuickReplySet(): StoredQuickReplySet {
  return {
    id: "qr-1",
    name: "快捷回复",
    createdAt: now,
    updatedAt: now,
    payload: {
      name: "快捷回复",
      version: 2,
      qrList: [
        {
          label: "继续",
          message: "继续",
        },
      ],
    },
  };
}

function createStoredGroup(): StoredGroup {
  return {
    id: "group-1",
    name: "群聊",
    createdAt: now,
    updatedAt: now,
    payload: {
      name: "群聊",
      members: [{ characterId: "char-1", displayName: "林黛玉", enabled: true, order: 0 }],
      speakerStrategy: "listOrder",
    },
  };
}

function createStoredChat(): StoredChat {
  return {
    id: "chat-1",
    name: "对话",
    characterId: "char-1",
    createdAt: now,
    updatedAt: now,
    payload: {
      metadata: {
        user_name: "User",
        character_name: "红楼梦世界",
        create_date: "2026-07-07@12h00m00s",
        chat_metadata: {
          presetId: "preset-1",
          worldIds: ["world-1"],
          quickReplySetIds: ["qr-1"],
          personaId: "persona-1",
        },
      },
      messages: [
        {
          name: "User",
          is_user: true,
          mes: "你好",
        },
      ],
    },
  };
}

function findAsset(
  assets: Awaited<ReturnType<typeof loadLocalAssetInventory>>["assets"],
  ref: LocalAssetRef,
) {
  return assets.find((asset) => toAssetKey(asset.ref) === toAssetKey(ref));
}

function linkKeys(links: LocalAssetLink[]): string[] {
  return links.map(
    (link) =>
      `${toAssetKey(link.source)}->${toAssetKey(link.target)}:${link.relation}:${link.targetExists}`,
  );
}
