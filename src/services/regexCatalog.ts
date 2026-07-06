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

export type RegexCatalogStatusFilter = "all" | "enabled" | "disabled";
export type RegexCatalogFlagFilter =
  | "all"
  | "runOnEdit"
  | "promptOnly"
  | "markdownOnly";

export interface RegexCatalogFilterOptions {
  query?: string;
  status?: RegexCatalogStatusFilter;
  flag?: RegexCatalogFlagFilter;
  placement?: number | "all";
}

export interface RegexCatalogFilterSummaryInput extends RegexCatalogFilterOptions {
  shownCount: number;
  totalCount: number;
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

const regexPlacementLabels = new Map<number, string>([
  [0, "0 · Markdown 显示（已废弃）"],
  [1, "1 · 用户输入"],
  [2, "2 · AI 输出"],
  [3, "3 · 斜杠命令"],
  [4, "4 · sendAs（legacy）"],
  [5, "5 · 世界书"],
  [6, "6 · 推理块"],
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

export function filterRegexCatalogItems(
  items: RegexCatalogItem[],
  options: RegexCatalogFilterOptions = {},
): RegexCatalogItem[] {
  const query = options.query?.trim().toLocaleLowerCase() ?? "";
  const status = options.status ?? "all";
  const flag = options.flag ?? "all";
  const placement = options.placement ?? "all";

  return items.filter((item) => {
    if (status === "enabled" && item.disabled) {
      return false;
    }

    if (status === "disabled" && !item.disabled) {
      return false;
    }

    if (flag === "runOnEdit" && !item.runOnEdit) {
      return false;
    }

    if (flag === "promptOnly" && !item.promptOnly) {
      return false;
    }

    if (flag === "markdownOnly" && !item.markdownOnly) {
      return false;
    }

    if (
      typeof placement === "number" &&
      !item.placement.includes(placement)
    ) {
      return false;
    }

    if (!query) {
      return true;
    }

    return createSearchText(item).includes(query);
  });
}

export function hasRegexCatalogFilters(
  options: RegexCatalogFilterOptions = {},
): boolean {
  return (
    (options.query?.trim().length ?? 0) > 0 ||
    (options.status ?? "all") !== "all" ||
    (options.flag ?? "all") !== "all" ||
    (options.placement ?? "all") !== "all"
  );
}

export function createRegexCatalogFilterSummary(
  input: RegexCatalogFilterSummaryInput,
): string {
  if (!hasRegexCatalogFilters(input)) {
    return `当前显示全部 ${input.totalCount} 条正则脚本。`;
  }

  return `当前显示 ${input.shownCount} / ${input.totalCount} 条正则脚本。`;
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

function createSearchText(item: RegexCatalogItem): string {
  return [
    item.scriptName,
    item.sourcePresetName,
    item.scriptId,
    item.findRegex,
    item.replaceString,
    ...item.placementLabels,
    ...item.unknownFieldNames,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .toLocaleLowerCase();
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
  return regexPlacementLabels.get(value) ?? `${value} · 未知 placement`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
