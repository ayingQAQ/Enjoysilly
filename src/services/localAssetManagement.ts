import {
  getCharacter,
  getMySillyDatabase,
  getPreset,
  listCharacters,
  listChats,
  listGroups,
  listPresets,
  listQuickReplySets,
  listRegexScripts,
  listSettings,
  listWorlds,
  saveRegexScript,
  saveWorldInfo,
  type MySillyDatabaseConnection,
  type StoredCharacter,
  type StoredChat,
  type StoredGroup,
  type StoredPreset,
  type StoredQuickReplySet,
  type StoredRegexScript,
  type StoredSetting,
  type StoredWorldInfo,
} from "../lib/db";
import { extractRegexScripts } from "../lib/presetIO";
import type { CharacterCard } from "../types/character";
import type { UnknownRecord } from "../types/common";
import type { RegexScript } from "../types/preset";
import type { UserPersona } from "../types/settings";
import type {
  NativeWorldInfoEntry,
  PortableWorldInfoEntry,
} from "../types/worldinfo";
import {
  appSettingsKey,
  localProfilesKey,
  normalizeAppSettings,
  normalizeLocalProfiles,
  normalizeUserPersonas,
  userPersonasKey,
} from "./settingsStore";

export type LocalAssetKind =
  | "character"
  | "world"
  | "preset"
  | "regex"
  | "quickReply"
  | "group"
  | "chat"
  | "setting"
  | "persona"
  | "embeddedWorld"
  | "embeddedRegex";

export type LocalAssetStorage = "indexedDB" | "setting" | "embedded";

export interface LocalAssetRef {
  kind: LocalAssetKind;
  id: string;
}

export interface LocalAssetSource {
  type: "stored" | "importedFile" | "setting" | "embedded";
  label: string;
  fileName?: string;
  parent?: LocalAssetRef;
}

export interface LocalAssetRecord {
  ref: LocalAssetRef;
  kind: LocalAssetKind;
  id: string;
  name: string;
  storage: LocalAssetStorage;
  readOnly: boolean;
  createdAt?: string;
  updatedAt?: string;
  source: LocalAssetSource;
  summary: UnknownRecord;
}

export type LocalAssetRelation =
  | "contains"
  | "uses"
  | "boundTo"
  | "default"
  | "references";

export interface LocalAssetLink {
  source: LocalAssetRef;
  target: LocalAssetRef;
  relation: LocalAssetRelation;
  label: string;
  targetExists: boolean;
  blockingOnDelete: boolean;
}

export interface LocalAssetInventory {
  generatedAt: string;
  assets: LocalAssetRecord[];
  links: LocalAssetLink[];
  counts: Partial<Record<LocalAssetKind, number>>;
}

export interface LocalAssetUsageReport {
  asset?: LocalAssetRecord;
  incoming: LocalAssetLink[];
  outgoing: LocalAssetLink[];
  blockingIncoming: LocalAssetLink[];
  canDeleteDirectly: boolean;
  reason: string;
}

interface BuildContext {
  assets: LocalAssetRecord[];
  links: Array<Omit<LocalAssetLink, "targetExists">>;
}

export async function loadLocalAssetInventory(
  database?: MySillyDatabaseConnection,
): Promise<LocalAssetInventory> {
  const db = database ?? (await getMySillyDatabase());
  const [
    characters,
    worlds,
    presets,
    regexScripts,
    quickReplies,
    groups,
    chats,
    settings,
  ] = await Promise.all([
    listCharacters(db),
    listWorlds(db),
    listPresets(db),
    listRegexScripts(db),
    listQuickReplySets(db),
    listGroups(db),
    listChats(db),
    listSettings(db),
  ]);
  const context: BuildContext = { assets: [], links: [] };

  for (const character of characters) addCharacterAssets(context, character);
  for (const world of worlds) addWorldAsset(context, world);
  for (const preset of presets) addPresetAssets(context, preset);
  for (const script of regexScripts) addRegexAsset(context, script);
  for (const set of quickReplies) addQuickReplyAsset(context, set);
  for (const group of groups) addGroupAsset(context, group);
  for (const chat of chats) addChatAsset(context, chat);
  for (const setting of settings) addSettingAssets(context, setting);

  const assetKeys = new Set(context.assets.map((asset) => toAssetKey(asset.ref)));
  const links = context.links.map((link) => ({
    ...link,
    targetExists: assetKeys.has(toAssetKey(link.target)),
  }));

  return {
    generatedAt: new Date().toISOString(),
    assets: sortAssets(context.assets),
    links: sortLinks(links),
    counts: countAssets(context.assets),
  };
}

export function getLocalAssetUsageReport(
  inventory: LocalAssetInventory,
  ref: LocalAssetRef,
): LocalAssetUsageReport {
  const key = toAssetKey(ref);
  const asset = inventory.assets.find((item) => toAssetKey(item.ref) === key);
  const incoming = inventory.links.filter((link) => toAssetKey(link.target) === key);
  const outgoing = inventory.links.filter((link) => toAssetKey(link.source) === key);
  const blockingIncoming = incoming.filter((link) => link.blockingOnDelete);
  const canDeleteDirectly = Boolean(asset && !asset.readOnly && blockingIncoming.length === 0);

  return {
    asset,
    incoming,
    outgoing,
    blockingIncoming,
    canDeleteDirectly,
    reason: createUsageReason(asset, blockingIncoming),
  };
}

export async function analyzeLocalAssetDeletion(
  ref: LocalAssetRef,
  database?: MySillyDatabaseConnection,
): Promise<LocalAssetUsageReport> {
  return getLocalAssetUsageReport(await loadLocalAssetInventory(database), ref);
}

export function toAssetKey(ref: LocalAssetRef): string {
  return `${ref.kind}:${ref.id}`;
}

function addCharacterAssets(context: BuildContext, character: StoredCharacter): void {
  const ref = createRef("character", character.id);
  const data = character.payload.data;
  const embeddedWorldEntries = data.character_book?.entries ?? [];
  const embeddedRegexScripts = extractCharacterRegexScripts(character.payload);

  context.assets.push({
    ref,
    kind: "character",
    id: character.id,
    name: character.name,
    storage: "indexedDB",
    readOnly: false,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    source: character.sourceFileName
      ? {
          type: "importedFile",
          label: "角色卡导入文件",
          fileName: character.sourceFileName,
        }
      : { type: "stored", label: "本地角色卡" },
    summary: {
      spec: character.payload.spec,
      specVersion: character.payload.spec_version,
      sourceFileName: character.sourceFileName,
      hasSourcePng: Boolean(character.sourcePngBytes?.length),
      tagCount: Array.isArray(data.tags) ? data.tags.length : 0,
      embeddedWorldEntryCount: embeddedWorldEntries.length,
      embeddedRegexCount: embeddedRegexScripts.length,
    },
  });

  if (embeddedWorldEntries.length > 0) {
    const embeddedWorldRef = createRef("embeddedWorld", `${character.id}:character_book`);
    context.assets.push({
      ref: embeddedWorldRef,
      kind: "embeddedWorld",
      id: embeddedWorldRef.id,
      name: `${character.name} · 内嵌世界书`,
      storage: "embedded",
      readOnly: true,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
      source: {
        type: "embedded",
        label: "角色卡 character_book",
        parent: ref,
      },
      summary: {
        entryCount: embeddedWorldEntries.length,
        dialect: "portable",
      },
    });
    addLink(context, ref, embeddedWorldRef, "contains", "包含内嵌世界书", false);
  }

  embeddedRegexScripts.forEach((script, index) => {
    const regexRef = createRef("embeddedRegex", `${character.id}:regex:${index}`);
    context.assets.push(createEmbeddedRegexAsset(regexRef, script, {
      name: `${character.name} · ${script.scriptName}`,
      parent: ref,
      label: "角色卡内嵌正则",
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
    }));
    addLink(context, ref, regexRef, "contains", "包含内嵌正则", false);
  });
}

function addWorldAsset(context: BuildContext, world: StoredWorldInfo): void {
  const entries = getWorldEntries(world);
  const dialect = Array.isArray(world.payload.entries) ? "portable" : "native";
  const enabledEntryCount = entries.filter((entry) =>
    dialect === "portable" ? entry.enabled !== false : entry.disable !== true,
  ).length;

  context.assets.push({
    ref: createRef("world", world.id),
    kind: "world",
    id: world.id,
    name: world.name,
    storage: "indexedDB",
    readOnly: false,
    createdAt: world.createdAt,
    updatedAt: world.updatedAt,
    source: { type: "stored", label: "本地世界书" },
    summary: {
      dialect,
      entryCount: entries.length,
      enabledEntryCount,
      constantEntryCount: entries.filter((entry) => entry.constant === true).length,
    },
  });
}

function addPresetAssets(context: BuildContext, preset: StoredPreset): void {
  const ref = createRef("preset", preset.id);
  const regexScripts = extractRegexScripts(preset.payload);

  context.assets.push({
    ref,
    kind: "preset",
    id: preset.id,
    name: preset.name,
    storage: "indexedDB",
    readOnly: false,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
    source: { type: "stored", label: "本地预设" },
    summary: {
      promptCount: preset.payload.prompts.length,
      orderSlotCount: preset.payload.prompt_order.length,
      regexCount: regexScripts.length,
      hasThirdPartyData: Boolean(
        preset.payload.extensions?.SPreset || preset.payload.extensions?.tavern_helper,
      ),
    },
  });

  regexScripts.forEach((script, index) => {
    const regexRef = createRef("embeddedRegex", `${preset.id}:regex:${index}`);
    context.assets.push(createEmbeddedRegexAsset(regexRef, script, {
      name: `${preset.name} · ${script.scriptName}`,
      parent: ref,
      label: "预设 extensions.regex_scripts",
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    }));
    addLink(context, ref, regexRef, "contains", "包含预设正则", false);
  });
}

function addRegexAsset(context: BuildContext, script: StoredRegexScript): void {
  const ref = createRef("regex", script.id);

  context.assets.push({
    ref,
    kind: "regex",
    id: script.id,
    name: script.name,
    storage: "indexedDB",
    readOnly: false,
    createdAt: script.createdAt,
    updatedAt: script.updatedAt,
    source: { type: "stored", label: "本地正则脚本" },
    summary: createRegexSummary(script.payload),
  });

  if (script.characterId) {
    addLink(
      context,
      ref,
      createRef("character", script.characterId),
      "boundTo",
      "绑定角色",
      true,
    );
  }
}

function addQuickReplyAsset(context: BuildContext, set: StoredQuickReplySet): void {
  context.assets.push({
    ref: createRef("quickReply", set.id),
    kind: "quickReply",
    id: set.id,
    name: set.name,
    storage: "indexedDB",
    readOnly: false,
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
    source: { type: "stored", label: "本地快速回复" },
    summary: {
      itemCount: set.payload.qrList.length,
      enabledItemCount: set.payload.qrList.filter((item) => item.enabled !== false).length,
    },
  });
}

function addGroupAsset(context: BuildContext, group: StoredGroup): void {
  const ref = createRef("group", group.id);

  context.assets.push({
    ref,
    kind: "group",
    id: group.id,
    name: group.name,
    storage: "indexedDB",
    readOnly: false,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    source: { type: "stored", label: "本地群聊" },
    summary: {
      memberCount: group.payload.members.length,
      enabledMemberCount: group.payload.members.filter((member) => member.enabled).length,
      speakerStrategy: group.payload.speakerStrategy,
    },
  });

  group.payload.members.forEach((member) => {
    addLink(
      context,
      ref,
      createRef("character", member.characterId),
      "uses",
      member.displayName ? `群成员：${member.displayName}` : "群成员",
      true,
    );
  });
}

function addChatAsset(context: BuildContext, chat: StoredChat): void {
  const ref = createRef("chat", chat.id);

  context.assets.push({
    ref,
    kind: "chat",
    id: chat.id,
    name: chat.name,
    storage: "indexedDB",
    readOnly: false,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    source: { type: "stored", label: "本地对话存档" },
    summary: {
      messageCount: chat.payload.messages.length,
      userName: chat.payload.metadata.user_name,
      characterName: chat.payload.metadata.character_name,
      createDate: chat.payload.metadata.create_date,
    },
  });

  if (chat.characterId) {
    addLink(context, ref, createRef("character", chat.characterId), "uses", "对话角色", true);
  }

  if (chat.groupId) {
    addLink(context, ref, createRef("group", chat.groupId), "uses", "群聊存档", true);
  }

  addChatMetadataLinks(context, ref, chat.payload.metadata.chat_metadata);
}

function addSettingAssets(context: BuildContext, setting: StoredSetting): void {
  const ref = createRef("setting", setting.key);

  context.assets.push({
    ref,
    kind: "setting",
    id: setting.key,
    name: setting.key,
    storage: "setting",
    readOnly: false,
    updatedAt: setting.updatedAt,
    source: { type: "setting", label: "本地设置" },
    summary: {
      key: setting.key,
      valueType: Array.isArray(setting.value) ? "array" : typeof setting.value,
    },
  });

  if (setting.key === appSettingsKey) {
    const settings = normalizeAppSettings(setting.value);
    addOptionalDefaultLink(context, ref, "preset", settings.defaultPresetId, "默认预设");
    addOptionalDefaultLink(context, ref, "world", settings.defaultWorldId, "默认世界书");
    addOptionalDefaultLink(
      context,
      ref,
      "quickReply",
      settings.defaultQuickReplySetId,
      "默认快速回复",
    );
  }

  if (setting.key === userPersonasKey) {
    normalizeUserPersonas(setting.value).forEach((persona) => {
      const personaRef = createRef("persona", persona.id);
      context.assets.push(createPersonaAsset(personaRef, persona, setting));
      addLink(context, ref, personaRef, "contains", "包含用户 persona", false);
    });
  }

  if (setting.key === localProfilesKey) {
    addLocalProfileAssets(context, setting);
  }
}

function addLocalProfileAssets(
  context: BuildContext,
  setting: StoredSetting,
): void {
  const profiles = loadLocalProfilesSync(setting.value);

  profiles.forEach((profile) => {
    const profileRef = createRef("setting", `${setting.key}:${profile.id}`);
    context.assets.push({
      ref: profileRef,
      kind: "setting",
      id: profileRef.id,
      name: profile.name,
      storage: "setting",
      readOnly: false,
      updatedAt: setting.updatedAt,
      source: {
        type: "setting",
        label: "本地工作区配置",
        parent: createRef("setting", setting.key),
      },
      summary: {
        profileId: profile.id,
        hasCharacter: Boolean(profile.characterId),
        hasPreset: Boolean(profile.presetId),
        worldCount: profile.worldIds.length,
        regexCount: profile.regexScriptIds.length,
        qrCount: profile.quickReplySetIds.length,
        hasPersona: Boolean(profile.personaId),
      },
    });

    addOptionalDefaultLink(context, profileRef, "character", profile.characterId, "工作区角色");
    addOptionalDefaultLink(context, profileRef, "preset", profile.presetId, "工作区预设");
    profile.worldIds.forEach((id) => {
      addLink(context, profileRef, createRef("world", id), "uses", "工作区世界书", true);
    });
    profile.regexScriptIds.forEach((id) => {
      addLink(context, profileRef, createRef("regex", id), "uses", "工作区正则", true);
    });
    profile.quickReplySetIds.forEach((id) => {
      addLink(context, profileRef, createRef("quickReply", id), "uses", "工作区快速回复", true);
    });
    addOptionalDefaultLink(context, profileRef, "persona", profile.personaId, "工作区 persona");
  });
}

function loadLocalProfilesSync(value: unknown) {
  try {
    return normalizeLocalProfiles(value);
  } catch {
    return [];
  }
}

function addChatMetadataLinks(
  context: BuildContext,
  source: LocalAssetRef,
  metadata: UnknownRecord | undefined,
): void {
  if (!metadata) return;

  addOptionalReferenceLink(context, source, "preset", readString(metadata.presetId), "对话快照预设");
  addOptionalReferenceLink(context, source, "world", readString(metadata.worldId), "对话快照世界书");
  addStringArray(metadata.worldIds).forEach((id) => {
    addOptionalReferenceLink(context, source, "world", id, "对话快照世界书");
  });
  addOptionalReferenceLink(
    context,
    source,
    "quickReply",
    readString(metadata.quickReplySetId),
    "对话快照快速回复",
  );
  addStringArray(metadata.quickReplySetIds).forEach((id) => {
    addOptionalReferenceLink(context, source, "quickReply", id, "对话快照快速回复");
  });
  addOptionalReferenceLink(context, source, "persona", readString(metadata.personaId), "对话 persona");
}

function addOptionalDefaultLink(
  context: BuildContext,
  source: LocalAssetRef,
  kind: LocalAssetKind,
  id: string | undefined,
  label: string,
): void {
  if (!id) return;

  addLink(context, source, createRef(kind, id), "default", label, true);
}

function addOptionalReferenceLink(
  context: BuildContext,
  source: LocalAssetRef,
  kind: LocalAssetKind,
  id: string | undefined,
  label: string,
): void {
  if (!id) return;

  addLink(context, source, createRef(kind, id), "references", label, false);
}

function createEmbeddedRegexAsset(
  ref: LocalAssetRef,
  script: RegexScript,
  input: {
    name: string;
    label: string;
    parent: LocalAssetRef;
    createdAt?: string;
    updatedAt?: string;
  },
): LocalAssetRecord {
  return {
    ref,
    kind: "embeddedRegex",
    id: ref.id,
    name: input.name,
    storage: "embedded",
    readOnly: true,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    source: {
      type: "embedded",
      label: input.label,
      parent: input.parent,
    },
    summary: createRegexSummary(script),
  };
}

function createPersonaAsset(
  ref: LocalAssetRef,
  persona: UserPersona,
  setting: StoredSetting,
): LocalAssetRecord {
  return {
    ref,
    kind: "persona",
    id: persona.id,
    name: persona.name,
    storage: "setting",
    readOnly: true,
    updatedAt: setting.updatedAt,
    source: {
      type: "setting",
      label: "userPersonas 设置",
      parent: createRef("setting", setting.key),
    },
    summary: {
      isDefault: persona.isDefault === true,
      hasDescription: Boolean(persona.description?.trim()),
    },
  };
}

function createRegexSummary(script: RegexScript): UnknownRecord {
  return {
    scriptName: script.scriptName,
    disabled: script.disabled === true,
    placement: script.placement,
    promptOnly: script.promptOnly === true,
    markdownOnly: script.markdownOnly === true,
    runOnEdit: script.runOnEdit === true,
    minDepth: script.minDepth,
    maxDepth: script.maxDepth,
    hasFindRegex: script.findRegex.trim().length > 0,
    hasReplaceString: Boolean(script.replaceString && script.replaceString.length > 0),
  };
}

function addLink(
  context: BuildContext,
  source: LocalAssetRef,
  target: LocalAssetRef,
  relation: LocalAssetRelation,
  label: string,
  blockingOnDelete: boolean,
): void {
  context.links.push({
    source,
    target,
    relation,
    label,
    blockingOnDelete,
  });
}

function getWorldEntries(
  world: StoredWorldInfo,
): Array<NativeWorldInfoEntry | PortableWorldInfoEntry> {
  return Array.isArray(world.payload.entries)
    ? world.payload.entries.filter(isWorldInfoEntry)
    : Object.values(world.payload.entries).filter(isWorldInfoEntry);
}

function extractCharacterRegexScripts(character: CharacterCard): RegexScript[] {
  const characterRecord = character as unknown as Record<string, unknown>;
  const dataRecord = character.data as unknown as Record<string, unknown>;
  const extensionsRecord = toRecord(character.data.extensions);
  const nestedExtensionsRecord = toRecord(extensionsRecord?.extensions);
  const records = [
    ...readRegexScriptArray(extensionsRecord?.regex_scripts),
    ...readRegexScriptArray(nestedExtensionsRecord?.regex_scripts),
    ...readRegexScriptArray(dataRecord.regex_scripts),
    ...readRegexScriptArray(characterRecord.regex_scripts),
  ];

  return records
    .map((record, index) => normalizeCharacterRegexScript(record, index))
    .filter((script): script is RegexScript => script !== null);
}

function normalizeCharacterRegexScript(
  record: Record<string, unknown>,
  index: number,
): RegexScript | null {
  const findRegex = firstString(record.findRegex, record.regex);
  const replaceString = firstString(record.replaceString, record.replacement);

  if (!findRegex && !replaceString && typeof record.scriptName !== "string") {
    return null;
  }

  return {
    ...record,
    id: typeof record.id === "string" ? record.id : undefined,
    scriptName:
      firstString(record.scriptName, record.name) ?? `character regex #${index + 1}`,
    findRegex: findRegex ?? "",
    replaceString: replaceString ?? "",
    trimStrings: Array.isArray(record.trimStrings)
      ? record.trimStrings.filter((item): item is string => typeof item === "string")
      : undefined,
    placement: Array.isArray(record.placement)
      ? record.placement.filter((item): item is number => typeof item === "number")
      : undefined,
    disabled:
      record.disabled === true ||
      record.enabled === false ||
      record.isEnabled === false,
    markdownOnly: record.markdownOnly === true,
    promptOnly: record.promptOnly === true,
    runOnEdit: record.runOnEdit === true,
    substituteRegex:
      typeof record.substituteRegex === "number" ? record.substituteRegex : undefined,
    minDepth:
      typeof record.minDepth === "number" || record.minDepth === null
        ? record.minDepth
        : undefined,
    maxDepth:
      typeof record.maxDepth === "number" || record.maxDepth === null
        ? record.maxDepth
        : undefined,
  };
}

function countAssets(assets: LocalAssetRecord[]): Partial<Record<LocalAssetKind, number>> {
  const counts: Partial<Record<LocalAssetKind, number>> = {};

  for (const asset of assets) {
    counts[asset.kind] = (counts[asset.kind] ?? 0) + 1;
  }

  return counts;
}

function sortAssets(assets: LocalAssetRecord[]): LocalAssetRecord[] {
  return [...assets].sort((a, b) => {
    const timeCompare = (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    return timeCompare !== 0 ? timeCompare : toAssetKey(a.ref).localeCompare(toAssetKey(b.ref));
  });
}

function sortLinks(links: LocalAssetLink[]): LocalAssetLink[] {
  return [...links].sort((a, b) => {
    const sourceCompare = toAssetKey(a.source).localeCompare(toAssetKey(b.source));
    return sourceCompare !== 0
      ? sourceCompare
      : toAssetKey(a.target).localeCompare(toAssetKey(b.target));
  });
}

function createUsageReason(
  asset: LocalAssetRecord | undefined,
  blockingIncoming: LocalAssetLink[],
): string {
  if (!asset) {
    return "找不到该本地资产。";
  }

  if (asset.readOnly) {
    return "这是从原始 payload 派生出来的只读资产，不能单独删除。";
  }

  if (blockingIncoming.length > 0) {
    return `该资产仍被 ${blockingIncoming.length} 个本地对象引用，删除前需要处理引用关系。`;
  }

  return "没有发现阻塞删除的本地引用。";
}

function createRef(kind: LocalAssetKind, id: string): LocalAssetRef {
  return { kind, id };
}

function isWorldInfoEntry(value: unknown): value is NativeWorldInfoEntry | PortableWorldInfoEntry {
  return typeof value === "object" && value !== null;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function readRegexScriptArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null,
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function addStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

// ─── 复制为本地资产 ────────────────────────────────────────────────

export interface CopyEmbeddedWorldResult {
  ok: boolean;
  worldId?: string;
  entryCount: number;
  error?: string;
}

export interface CopyEmbeddedRegexResult {
  ok: boolean;
  regexIds: string[];
  count: number;
  error?: string;
}

/**
 * 将角色卡内嵌的 character_book 复制为独立世界书。
 * 不修改原始角色卡 payload。
 */
export async function copyEmbeddedWorldToLibrary(
  characterId: string,
  options: {
    database?: MySillyDatabaseConnection;
    now?: Date;
  } = {},
): Promise<CopyEmbeddedWorldResult> {
  const db = options.database ?? (await getMySillyDatabase());
  const character = await getCharacter(characterId, db);

  if (!character) {
    return { ok: false, entryCount: 0, error: "找不到角色卡。" };
  }

  const embeddedBook = character.payload.data.character_book;

  if (!embeddedBook || !embeddedBook.entries || embeddedBook.entries.length === 0) {
    return { ok: false, entryCount: 0, error: "该角色卡没有内嵌世界书。" };
  }

  const now = (options.now ?? new Date()).toISOString();
  const nowDate = new Date(now);

  const id = generateStableAssetId("world", characterId, "character_book");
  const name = `${character.name} · 内嵌世界书（本地副本）`;
  const stored = await saveWorldInfo(
    {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      payload: {
        ...embeddedBook,
        name: embeddedBook.name ?? name,
      },
    } satisfies StoredWorldInfo,
    db,
  );

  return {
    ok: true,
    worldId: stored,
    entryCount: embeddedBook.entries.length,
  };
}

/**
 * 将角色卡或预设的内嵌正则脚本复制为独立正则。
 * 不修改原始 payload。
 */
export async function copyEmbeddedRegexScriptsToLibrary(
  characterId: string,
  options: {
    database?: MySillyDatabaseConnection;
    now?: Date;
    presetId?: string;
  } = {},
): Promise<CopyEmbeddedRegexResult> {
  const db = options.database ?? (await getMySillyDatabase());
  const now = (options.now ?? new Date()).toISOString();
  const regexIds: string[] = [];
  const errors: string[] = [];

  // 从角色卡提取
  const character = await getCharacter(characterId, db);
  if (character) {
    const scripts = extractCharacterRegexScripts(character.payload);

    for (const script of scripts) {
      try {
        const id = generateStableAssetId(
          "regex",
          characterId,
          `char_${script.scriptName}`,
        );
        await saveRegexScript(
          {
            id,
            name: script.scriptName ?? `${character.name} 内嵌正则`,
            characterId,
            createdAt: now,
            updatedAt: now,
            payload: {
              ...script,
              id,
            },
          } satisfies StoredRegexScript,
          db,
        );
        regexIds.push(id);
      } catch (err) {
        errors.push(`保存 ${script.scriptName} 失败: ${String(err)}`);
      }
    }
  }

  // 从预设提取
  if (options.presetId) {
    const preset = await getPreset(options.presetId, db);
    if (preset) {
      const scripts = extractRegexScripts(preset.payload);

      for (const script of scripts) {
        try {
          const id = generateStableAssetId(
            "regex",
            options.presetId,
            `preset_${script.scriptName ?? "regex"}`,
          );
          await saveRegexScript(
            {
              id,
              name: script.scriptName ?? `${preset.name} 内嵌正则`,
              characterId,
              createdAt: now,
              updatedAt: now,
              payload: {
                ...script,
                id,
              },
            } satisfies StoredRegexScript,
            db,
          );
          regexIds.push(id);
        } catch (err) {
          errors.push(`保存 ${script.scriptName} 失败: ${String(err)}`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    regexIds,
    count: regexIds.length,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

function generateStableAssetId(
  kind: string,
  parentId: string,
  suffix: string,
): string {
  const raw = `${kind}_${parentId}_${suffix}`
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 200);

  return raw;
}
