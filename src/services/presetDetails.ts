import {
  getMySillyDatabase,
  getPreset,
  type MySillyDatabaseConnection,
  type StoredPreset,
} from "../lib/db";
import { extractRegexScripts } from "../lib/presetIO";
import type {
  PresetPrompt,
  PromptOrderItem,
  RegexScript,
} from "../types/preset";

export interface PresetPromptPreview {
  identifier: string;
  displayName: string;
  role?: string;
  enabled: boolean;
  marker: boolean;
  systemPrompt: boolean;
  contentPreview: string;
  injectionDepth?: number;
  injectionOrder?: number;
  injectionPosition?: number;
  triggerCount: number;
}

export interface PresetOrderSlotPreview {
  characterId: number;
  orderCount: number;
  enabledOrderCount: number;
  sampleIdentifiers: string[];
}

export interface PresetRegexScriptPreview {
  scriptName: string;
  findRegexPreview: string;
  replacePreview: string;
  disabled: boolean;
  promptOnly: boolean;
  markdownOnly: boolean;
  placementCount: number;
  minDepth?: number | null;
  maxDepth?: number | null;
}

export interface PresetDetailSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  promptCount: number;
  enabledPromptCount: number;
  markerPromptCount: number;
  systemPromptCount: number;
  orderSlotCount: number;
  orderedPromptCount: number;
  enabledOrderedPromptCount: number;
  regexScriptCount: number;
  extensionFlags: {
    hasRegexScripts: boolean;
    hasSPreset: boolean;
    hasTavernHelper: boolean;
    hasNestedExtensions: boolean;
  };
  sampling: {
    temperature?: number;
    topP?: number;
    topK?: number;
    minP?: number;
    maxTokens?: number;
    contextTokens?: number;
    stream?: boolean;
  };
  promptPreviews: PresetPromptPreview[];
  orderSlotPreviews: PresetOrderSlotPreview[];
  regexScriptPreviews: PresetRegexScriptPreview[];
  stored: StoredPreset;
}

export async function loadPresetDetailSummary(
  presetId: string,
  database?: MySillyDatabaseConnection,
): Promise<PresetDetailSummary> {
  const db = database ?? (await getMySillyDatabase());
  const stored = await getPreset(presetId, db);

  if (!stored) {
    throw new Error(`找不到预设：${presetId}`);
  }

  return createPresetDetailSummary(stored);
}

export function createPresetDetailSummary(
  stored: StoredPreset,
): PresetDetailSummary {
  const preset = stored.payload;
  const regexScripts = extractRegexScripts(preset);
  const orderItems = preset.prompt_order.flatMap((slot) => slot.order);

  return {
    id: stored.id,
    name: stored.name,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    promptCount: preset.prompts.length,
    enabledPromptCount: preset.prompts.filter(isPresetPromptEnabled).length,
    markerPromptCount: preset.prompts.filter((prompt) => prompt.marker === true)
      .length,
    systemPromptCount: preset.prompts.filter(
      (prompt) => prompt.system_prompt === true,
    ).length,
    orderSlotCount: preset.prompt_order.length,
    orderedPromptCount: orderItems.length,
    enabledOrderedPromptCount: orderItems.filter(isPromptOrderItemEnabled)
      .length,
    regexScriptCount: regexScripts.length,
    extensionFlags: {
      hasRegexScripts: regexScripts.length > 0,
      hasSPreset: preset.extensions?.SPreset !== undefined,
      hasTavernHelper: preset.extensions?.tavern_helper !== undefined,
      hasNestedExtensions: preset.extensions?.extensions !== undefined,
    },
    sampling: {
      temperature: preset.temperature,
      topP: preset.top_p,
      topK: preset.top_k,
      minP: preset.min_p,
      maxTokens: preset.openai_max_tokens,
      contextTokens: preset.openai_max_context,
      stream: preset.stream_openai,
    },
    promptPreviews: preset.prompts.map(toPromptPreview).slice(0, 12),
    orderSlotPreviews: preset.prompt_order.map(toOrderSlotPreview),
    regexScriptPreviews: regexScripts.map(toRegexScriptPreview).slice(0, 12),
    stored,
  };
}

function toPromptPreview(prompt: PresetPrompt): PresetPromptPreview {
  return {
    identifier: prompt.identifier,
    displayName: firstNonEmptyText(prompt.name, prompt.identifier),
    role: prompt.role,
    enabled: isPresetPromptEnabled(prompt),
    marker: prompt.marker === true,
    systemPrompt: prompt.system_prompt === true,
    contentPreview: createPreview(prompt.content ?? ""),
    injectionDepth: prompt.injection_depth,
    injectionOrder: prompt.injection_order,
    injectionPosition: prompt.injection_position,
    triggerCount: Array.isArray(prompt.injection_trigger)
      ? prompt.injection_trigger.length
      : 0,
  };
}

function toOrderSlotPreview(slot: {
  character_id: number;
  order: PromptOrderItem[];
}): PresetOrderSlotPreview {
  return {
    characterId: slot.character_id,
    orderCount: slot.order.length,
    enabledOrderCount: slot.order.filter(isPromptOrderItemEnabled).length,
    sampleIdentifiers: slot.order
      .map((orderItem) => orderItem.identifier)
      .filter(Boolean)
      .slice(0, 8),
  };
}

function toRegexScriptPreview(script: RegexScript): PresetRegexScriptPreview {
  return {
    scriptName: firstNonEmptyText(script.scriptName, "未命名正则"),
    findRegexPreview: createPreview(script.findRegex),
    replacePreview: createPreview(script.replaceString ?? ""),
    disabled: script.disabled === true,
    promptOnly: script.promptOnly === true,
    markdownOnly: script.markdownOnly === true,
    placementCount: Array.isArray(script.placement) ? script.placement.length : 0,
    minDepth: script.minDepth,
    maxDepth: script.maxDepth,
  };
}

function isPresetPromptEnabled(prompt: PresetPrompt): boolean {
  return prompt.enabled !== false;
}

function isPromptOrderItemEnabled(orderItem: PromptOrderItem): boolean {
  return orderItem.enabled !== false;
}

function firstNonEmptyText(...values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim().length > 0)?.trim() ?? "";
}

function createPreview(value: string, maxLength = 140): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}
