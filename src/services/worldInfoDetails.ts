import {
  getMySillyDatabase,
  getWorldInfo,
  type MySillyDatabaseConnection,
  type StoredWorldInfo,
} from "../lib/db";
import type {
  NativeWorldInfoEntry,
  PortableWorldInfoEntry,
} from "../types/worldinfo";

export type WorldInfoDetailDialect = "native" | "portable";

export interface WorldInfoEntryPreview {
  id: string;
  index: number;
  sourceKey: string;
  dialect: WorldInfoDetailDialect;
  title: string;
  keys: string[];
  secondaryKeys: string[];
  contentPreview: string;
  enabled: boolean;
  constant: boolean;
  selective: boolean;
  order?: number;
  positionLabel: string;
  depth?: number;
  probability?: number;
  useProbability?: boolean;
  caseSensitive?: boolean | null;
  displayIndex?: number;
  extensionFieldNames: string[];
  preservedFieldNames: string[];
}

export interface WorldInfoDetailSummary {
  id: string;
  name: string;
  dialect: WorldInfoDetailDialect;
  createdAt: string;
  updatedAt: string;
  entryCount: number;
  enabledEntryCount: number;
  disabledEntryCount: number;
  constantEntryCount: number;
  selectiveEntryCount: number;
  rootPreservedFieldNames: string[];
  entryPreservedFieldNames: string[];
  entryPreviews: WorldInfoEntryPreview[];
  stored: StoredWorldInfo;
}

const knownNativeBookFields = new Set(["entries"]);
const knownPortableBookFields = new Set(["name", "entries"]);

const knownNativeEntryFields = new Set([
  "uid",
  "key",
  "keysecondary",
  "comment",
  "content",
  "constant",
  "vectorized",
  "selective",
  "selectiveLogic",
  "addMemo",
  "order",
  "position",
  "disable",
  "excludeRecursion",
  "preventRecursion",
  "delayUntilRecursion",
  "probability",
  "useProbability",
  "depth",
  "group",
  "groupOverride",
  "groupWeight",
  "scanDepth",
  "caseSensitive",
  "matchWholeWords",
  "useGroupScoring",
  "automationId",
  "role",
  "sticky",
  "cooldown",
  "delay",
  "displayIndex",
  "characterFilter",
  "world",
]);

const knownPortableEntryFields = new Set([
  "keys",
  "secondary_keys",
  "content",
  "comment",
  "constant",
  "selective",
  "insertion_order",
  "enabled",
  "position",
  "case_sensitive",
  "name",
  "priority",
  "id",
  "display_index",
  "extensions",
]);

interface EntryRecord<TEntry> {
  sourceKey: string;
  entry: Partial<TEntry> & Record<string, unknown>;
}

export async function loadWorldInfoDetailSummary(
  worldId: string,
  database?: MySillyDatabaseConnection,
): Promise<WorldInfoDetailSummary> {
  const db = database ?? (await getMySillyDatabase());
  const stored = await getWorldInfo(worldId, db);

  if (!stored) {
    throw new Error(`找不到世界书：${worldId}`);
  }

  return createWorldInfoDetailSummary(stored);
}

export function createWorldInfoDetailSummary(
  stored: StoredWorldInfo,
): WorldInfoDetailSummary {
  const rawEntries: unknown = stored.payload.entries;
  const isPortable = Array.isArray(rawEntries);
  const dialect: WorldInfoDetailDialect = isPortable ? "portable" : "native";
  const entryPreviews = isPortable
    ? getPortableEntryRecords(rawEntries).map(({ sourceKey, entry }, index) =>
        toPortableEntryPreview(entry, index, sourceKey),
      )
    : getNativeEntryRecords(rawEntries).map(({ sourceKey, entry }, index) =>
        toNativeEntryPreview(entry, index, sourceKey),
      );

  return {
    id: stored.id,
    name: stored.name,
    dialect,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    entryCount: entryPreviews.length,
    enabledEntryCount: entryPreviews.filter((entry) => entry.enabled).length,
    disabledEntryCount: entryPreviews.filter((entry) => !entry.enabled).length,
    constantEntryCount: entryPreviews.filter((entry) => entry.constant).length,
    selectiveEntryCount: entryPreviews.filter((entry) => entry.selective).length,
    rootPreservedFieldNames: Object.keys(stored.payload).filter((key) =>
      dialect === "portable"
        ? !knownPortableBookFields.has(key)
        : !knownNativeBookFields.has(key),
    ),
    entryPreservedFieldNames: uniqueStrings(
      entryPreviews.flatMap((entry) => entry.preservedFieldNames),
    ),
    entryPreviews,
    stored,
  };
}

function getPortableEntryRecords(
  entries: unknown[],
): Array<EntryRecord<PortableWorldInfoEntry>> {
  return entries.flatMap((entry, index) =>
    isRecord(entry) ? [{ sourceKey: String(index), entry }] : [],
  );
}

function getNativeEntryRecords(
  entries: unknown,
): Array<EntryRecord<NativeWorldInfoEntry>> {
  return isRecord(entries)
    ? Object.entries(entries).flatMap(([sourceKey, entry]) =>
        isRecord(entry) ? [{ sourceKey, entry }] : [],
      )
    : [];
}

function toPortableEntryPreview(
  entry: Partial<PortableWorldInfoEntry> & Record<string, unknown>,
  index: number,
  sourceKey: string,
): WorldInfoEntryPreview {
  const keys = getStringArray(entry.keys);
  const secondaryKeys = getStringArray(entry.secondary_keys);
  const title = firstNonEmptyText(entry.comment, entry.name, keys[0], `条目 ${index + 1}`);

  return {
    id: String(entry.id ?? sourceKey),
    index,
    sourceKey,
    dialect: "portable",
    title,
    keys,
    secondaryKeys,
    contentPreview: createPreview(entry.content),
    enabled: entry.enabled !== false,
    constant: entry.constant === true,
    selective: entry.selective === true,
    order: numberFrom(entry.insertion_order),
    positionLabel: formatPortablePosition(entry.position),
    caseSensitive:
      typeof entry.case_sensitive === "boolean" ? entry.case_sensitive : undefined,
    displayIndex: numberFrom(entry.display_index),
    extensionFieldNames: getRecordFieldNames(entry.extensions),
    preservedFieldNames: Object.keys(entry).filter(
      (key) => !knownPortableEntryFields.has(key),
    ),
  };
}

function toNativeEntryPreview(
  entry: Partial<NativeWorldInfoEntry> & Record<string, unknown>,
  index: number,
  sourceKey: string,
): WorldInfoEntryPreview {
  const keys = getStringArray(entry.key);
  const secondaryKeys = getStringArray(entry.keysecondary);
  const title = firstNonEmptyText(entry.comment, keys[0], `条目 ${index + 1}`);

  return {
    id: String(entry.uid ?? sourceKey),
    index,
    sourceKey,
    dialect: "native",
    title,
    keys,
    secondaryKeys,
    contentPreview: createPreview(entry.content),
    enabled: entry.disable !== true,
    constant: entry.constant === true,
    selective: entry.selective === true,
    order: numberFrom(entry.order),
    positionLabel: formatNativePosition(entry.position),
    depth: numberFrom(entry.depth),
    probability: numberFrom(entry.probability),
    useProbability:
      typeof entry.useProbability === "boolean" ? entry.useProbability : undefined,
    caseSensitive:
      typeof entry.caseSensitive === "boolean" ? entry.caseSensitive : undefined,
    displayIndex: numberFrom(entry.displayIndex),
    extensionFieldNames: [],
    preservedFieldNames: Object.keys(entry).filter(
      (key) => !knownNativeEntryFields.has(key),
    ),
  };
}

function createPreview(value: unknown, maxLength = 180): string {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function formatPortablePosition(value: unknown): string {
  if (value === "before_char") {
    return "before_char";
  }

  if (value === "after_char") {
    return "after_char";
  }

  return "未设";
}

function formatNativePosition(value: unknown): string {
  const position = numberFrom(value);

  switch (position) {
    case 0:
      return "before(0)";
    case 1:
      return "after(1)";
    case 2:
      return "ANTop(2)";
    case 3:
      return "ANBottom(3)";
    case 4:
      return "atDepth(4)";
    case 5:
      return "EMTop(5)";
    case 6:
      return "EMBottom(6)";
    case 7:
      return "outlet(7)";
    default:
      return "未设";
  }
}

function firstNonEmptyText(...values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim().length > 0)?.trim() ?? "";
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function getRecordFieldNames(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value) : [];
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
