import {
  getMySillyDatabase,
  listCharacters,
  listPresets,
  listWorlds,
  type MySillyDatabaseConnection,
  type StoredCharacter,
  type StoredPreset,
  type StoredWorldInfo,
} from "../lib/db";
import type { PresetPrompt, PromptOrderItem } from "../types/preset";
import type {
  NativeWorldInfoEntry,
  PortableWorldInfoEntry,
} from "../types/worldinfo";

export interface CharacterAssetSummary {
  id: string;
  name: string;
  spec: StoredCharacter["payload"]["spec"];
  specVersion: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  tags: string[];
  avatar?: string;
  worldEntryCount: number;
}

export type WorldInfoDialect = "native" | "portable";

export interface PresetAssetSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  promptCount: number;
  enabledPromptCount: number;
  orderSlotCount: number;
  orderedPromptCount: number;
  enabledOrderedPromptCount: number;
  regexScriptCount: number;
  hasThirdPartyData: boolean;
  samplePromptNames: string[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface WorldInfoAssetSummary {
  id: string;
  name: string;
  dialect: WorldInfoDialect;
  createdAt: string;
  updatedAt: string;
  entryCount: number;
  enabledEntryCount: number;
  constantEntryCount: number;
  sampleKeys: string[];
}

export async function loadCharacterAssetSummaries(
  database?: MySillyDatabaseConnection,
): Promise<CharacterAssetSummary[]> {
  const db = database ?? (await getMySillyDatabase());
  const characters = await listCharacters(db);

  return characters
    .map(toCharacterAssetSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadPresetAssetSummaries(
  database?: MySillyDatabaseConnection,
): Promise<PresetAssetSummary[]> {
  const db = database ?? (await getMySillyDatabase());
  const presets = await listPresets(db);

  return presets
    .map(toPresetAssetSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadWorldInfoAssetSummaries(
  database?: MySillyDatabaseConnection,
): Promise<WorldInfoAssetSummary[]> {
  const db = database ?? (await getMySillyDatabase());
  const worlds = await listWorlds(db);

  return worlds
    .map(toWorldInfoAssetSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function toCharacterAssetSummary(character: StoredCharacter): CharacterAssetSummary {
  const data = character.payload.data;

  return {
    id: character.id,
    name: character.name,
    spec: character.payload.spec,
    specVersion: character.payload.spec_version,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    description: firstNonEmptyText(data.description, data.scenario, data.personality),
    tags: Array.isArray(data.tags) ? data.tags : [],
    avatar: typeof data.avatar === "string" ? data.avatar : undefined,
    worldEntryCount: data.character_book?.entries.length ?? 0,
  };
}

function toPresetAssetSummary(preset: StoredPreset): PresetAssetSummary {
  const promptOrderItems = preset.payload.prompt_order.flatMap(
    (slot) => slot.order,
  );
  const extensions = preset.payload.extensions;

  return {
    id: preset.id,
    name: preset.name,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
    promptCount: preset.payload.prompts.length,
    enabledPromptCount: preset.payload.prompts.filter(isPresetPromptEnabled)
      .length,
    orderSlotCount: preset.payload.prompt_order.length,
    orderedPromptCount: promptOrderItems.length,
    enabledOrderedPromptCount: promptOrderItems.filter(isPromptOrderItemEnabled)
      .length,
    regexScriptCount: Array.isArray(extensions?.regex_scripts)
      ? extensions.regex_scripts.length
      : 0,
    hasThirdPartyData: Boolean(extensions?.tavern_helper || extensions?.SPreset),
    samplePromptNames: preset.payload.prompts
      .map(getPromptDisplayName)
      .filter(Boolean)
      .slice(0, 6),
    temperature: preset.payload.temperature,
    topP: preset.payload.top_p,
    maxTokens: preset.payload.openai_max_tokens,
  };
}

function firstNonEmptyText(...values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim().length > 0)?.trim() ?? "";
}

function toWorldInfoAssetSummary(world: StoredWorldInfo): WorldInfoAssetSummary {
  const entries = getWorldEntries(world).filter(isWorldInfoEntryRecord);
  const dialect: WorldInfoDialect = Array.isArray(world.payload.entries)
    ? "portable"
    : "native";

  return {
    id: world.id,
    name: world.name,
    dialect,
    createdAt: world.createdAt,
    updatedAt: world.updatedAt,
    entryCount: entries.length,
    enabledEntryCount: entries.filter((entry) =>
      isWorldEntryEnabled(entry, dialect),
    ).length,
    constantEntryCount: entries.filter((entry) => entry.constant === true).length,
    sampleKeys: entries.flatMap(getWorldEntryKeys).filter(Boolean).slice(0, 6),
  };
}

function getWorldEntries(
  world: StoredWorldInfo,
) {
  return Array.isArray(world.payload.entries)
    ? world.payload.entries
    : Object.values(world.payload.entries);
}

function isWorldEntryEnabled(
  entry: NativeWorldInfoEntry | PortableWorldInfoEntry,
  dialect: WorldInfoDialect,
): boolean {
  return dialect === "portable" ? entry.enabled !== false : entry.disable !== true;
}

function getWorldEntryKeys(
  entry: NativeWorldInfoEntry | PortableWorldInfoEntry,
): string[] {
  if (Array.isArray(entry.keys)) {
    return entry.keys;
  }

  if (Array.isArray(entry.key)) {
    return entry.key;
  }

  return [];
}

function isWorldInfoEntryRecord(
  value: unknown,
): value is NativeWorldInfoEntry | PortableWorldInfoEntry {
  return typeof value === "object" && value !== null;
}

function isPresetPromptEnabled(prompt: PresetPrompt): boolean {
  return prompt.enabled !== false;
}

function isPromptOrderItemEnabled(orderItem: PromptOrderItem): boolean {
  return orderItem.enabled !== false;
}

function getPromptDisplayName(prompt: PresetPrompt): string {
  return firstNonEmptyText(prompt.name, prompt.identifier);
}
