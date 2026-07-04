import {
  getMySillyDatabase,
  listPresets,
  type MySillyDatabaseConnection,
  type StoredPreset,
} from "../lib/db";
import { extractRegexScripts } from "../lib/presetIO";
import type { RegexScript } from "../types/preset";

export interface RegexCatalogItem {
  id: string;
  sourcePresetId: string;
  sourcePresetName: string;
  sourcePresetUpdatedAt: string;
  scriptIndex: number;
  scriptId?: string;
  scriptName: string;
  disabled: boolean;
  placement: number[];
  placementLabels: string[];
  promptOnly: boolean;
  markdownOnly: boolean;
  runOnEdit: boolean;
  substituteRegex?: number;
  minDepth?: number | null;
  maxDepth?: number | null;
  trimStringCount: number;
  findRegex: string;
  findRegexPreview: string;
  replaceString: string;
  replaceStringPreview: string;
  unknownFieldNames: string[];
}

export interface RegexCatalogSummary {
  totalPresetCount: number;
  presetWithRegexCount: number;
  scriptCount: number;
  enabledScriptCount: number;
  disabledScriptCount: number;
  runOnEditCount: number;
  promptOnlyCount: number;
  markdownOnlyCount: number;
  items: RegexCatalogItem[];
}

const knownRegexScriptFields = new Set([
  "id",
  "scriptName",
  "findRegex",
  "replaceString",
  "trimStrings",
  "placement",
  "disabled",
  "markdownOnly",
  "promptOnly",
  "runOnEdit",
  "substituteRegex",
  "minDepth",
  "maxDepth",
]);

export async function loadRegexCatalogSummary(
  database?: MySillyDatabaseConnection,
): Promise<RegexCatalogSummary> {
  const db = database ?? (await getMySillyDatabase());
  const presets = await listPresets(db);

  return createRegexCatalogSummary(presets);
}

export function createRegexCatalogSummary(
  presets: StoredPreset[],
): RegexCatalogSummary {
  const sortedPresets = [...presets].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const items = sortedPresets.flatMap(toRegexCatalogItems);

  return {
    totalPresetCount: presets.length,
    presetWithRegexCount: sortedPresets.filter(
      (preset) => getRegexScriptRecords(preset).length > 0,
    ).length,
    scriptCount: items.length,
    enabledScriptCount: items.filter((item) => !item.disabled).length,
    disabledScriptCount: items.filter((item) => item.disabled).length,
    runOnEditCount: items.filter((item) => item.runOnEdit).length,
    promptOnlyCount: items.filter((item) => item.promptOnly).length,
    markdownOnlyCount: items.filter((item) => item.markdownOnly).length,
    items,
  };
}

function toRegexCatalogItems(preset: StoredPreset): RegexCatalogItem[] {
  return getRegexScriptRecords(preset).map((script, scriptIndex) =>
    toRegexCatalogItem(preset, script, scriptIndex),
  );
}

function getRegexScriptRecords(
  preset: StoredPreset,
): Array<Partial<RegexScript> & Record<string, unknown>> {
  return extractRegexScripts(preset.payload).filter(isRecord);
}

function toRegexCatalogItem(
  preset: StoredPreset,
  script: Partial<RegexScript> & Record<string, unknown>,
  scriptIndex: number,
): RegexCatalogItem {
  const placement = Array.isArray(script.placement)
    ? script.placement.filter((value): value is number => typeof value === "number")
    : [];
  const findRegex = typeof script.findRegex === "string" ? script.findRegex : "";
  const replaceString =
    typeof script.replaceString === "string" ? script.replaceString : "";

  return {
    id: `${preset.id}:regex:${scriptIndex}`,
    sourcePresetId: preset.id,
    sourcePresetName: preset.name,
    sourcePresetUpdatedAt: preset.updatedAt,
    scriptIndex,
    scriptId: typeof script.id === "string" ? script.id : undefined,
    scriptName: firstNonEmptyText(
      typeof script.scriptName === "string" ? script.scriptName : undefined,
      `未命名正则 #${scriptIndex + 1}`,
    ),
    disabled: script.disabled === true,
    placement,
    placementLabels: placement.map(formatPlacementValue),
    promptOnly: script.promptOnly === true,
    markdownOnly: script.markdownOnly === true,
    runOnEdit: script.runOnEdit === true,
    substituteRegex:
      typeof script.substituteRegex === "number" ? script.substituteRegex : undefined,
    minDepth: script.minDepth,
    maxDepth: script.maxDepth,
    trimStringCount: Array.isArray(script.trimStrings)
      ? script.trimStrings.length
      : 0,
    findRegex,
    findRegexPreview: createPreview(findRegex),
    replaceString,
    replaceStringPreview: createPreview(replaceString),
    unknownFieldNames: Object.keys(script).filter(
      (key) => !knownRegexScriptFields.has(key),
    ),
  };
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

function formatPlacementValue(value: number): string {
  return `placement:${value}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
