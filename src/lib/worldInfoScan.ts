import type { ChatMessageLine } from "../types/chat";
import type {
  NativeWorldInfoEntry,
  PortableWorldInfoEntry,
} from "../types/worldinfo";

export type WorldInfoScanInputEntry =
  | NativeWorldInfoEntry
  | PortableWorldInfoEntry;

export interface WorldInfoScanOptions {
  scanDepth?: number;
  caseSensitive?: boolean;
}

export interface ScannedWorldInfoEntry {
  sourceIndex: number;
  id?: number;
  comment?: string;
  content: string;
  order: number;
  depth?: number;
  matchedKeys: string[];
  reasons: Array<"constant" | "keyword">;
  entry: WorldInfoScanInputEntry;
}

export interface WorldInfoScanResult {
  before: ScannedWorldInfoEntry[];
  after: ScannedWorldInfoEntry[];
  atDepth: ScannedWorldInfoEntry[];
}

type WorldInfoScanBucket = keyof WorldInfoScanResult;

interface NormalizedWorldInfoEntry {
  sourceIndex: number;
  id?: number;
  comment?: string;
  content: string;
  keys: string[];
  enabled: boolean;
  constant: boolean;
  order: number;
  bucket: WorldInfoScanBucket;
  depth?: number;
  scanDepth?: number;
  caseSensitive?: boolean;
  entry: WorldInfoScanInputEntry;
}

const defaultScanDepth = 4;

export function scanWorldInfo(
  entries: WorldInfoScanInputEntry[],
  chatMessages: Array<string | ChatMessageLine>,
  options: WorldInfoScanOptions = {},
): WorldInfoScanResult {
  const normalizedEntries = entries.map(normalizeEntry);
  const activeEntries = normalizedEntries
    .filter((entry) => entry.enabled && entry.content.trim().length > 0)
    .map((entry) => scanEntry(entry, chatMessages, options))
    .filter((entry): entry is ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket } =>
      Boolean(entry),
    )
    .sort(compareScannedEntries);

  return {
    before: activeEntries
      .filter((entry) => entry.bucket === "before")
      .map(stripBucket),
    after: activeEntries
      .filter((entry) => entry.bucket === "after")
      .map(stripBucket),
    atDepth: activeEntries
      .filter((entry) => entry.bucket === "atDepth")
      .map(stripBucket),
  };
}

function scanEntry(
  entry: NormalizedWorldInfoEntry,
  chatMessages: Array<string | ChatMessageLine>,
  options: WorldInfoScanOptions,
): (ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }) | undefined {
  const matchedKeys = entry.keys.filter((key) =>
    matchesKey(key, createScanText(chatMessages, entry, options), entry, options),
  );
  const reasons: ScannedWorldInfoEntry["reasons"] = [];

  if (entry.constant) {
    reasons.push("constant");
  }

  if (matchedKeys.length > 0) {
    reasons.push("keyword");
  }

  if (reasons.length === 0) {
    return undefined;
  }

  return {
    sourceIndex: entry.sourceIndex,
    id: entry.id,
    comment: entry.comment,
    content: entry.content,
    order: entry.order,
    depth: entry.depth,
    matchedKeys,
    reasons,
    entry: entry.entry,
    bucket: entry.bucket,
  };
}

function normalizeEntry(
  entry: WorldInfoScanInputEntry,
  sourceIndex: number,
): NormalizedWorldInfoEntry {
  if (isNativeEntry(entry)) {
    return normalizeNativeEntry(entry, sourceIndex);
  }

  return normalizePortableEntry(entry, sourceIndex);
}

function normalizeNativeEntry(
  entry: NativeWorldInfoEntry,
  sourceIndex: number,
): NormalizedWorldInfoEntry {
  return {
    sourceIndex,
    id: entry.uid,
    comment: firstNonEmptyText(entry.comment, stringFrom(entry.world)),
    content: entry.content,
    keys: normalizeKeys(entry.key),
    enabled: entry.disable !== true,
    constant: entry.constant === true,
    order: numberOrFallback(entry.order, sourceIndex),
    bucket: nativePositionToBucket(entry.position),
    depth: entry.depth,
    scanDepth: nullableNumberToUndefined(entry.scanDepth),
    caseSensitive: nullableBooleanToUndefined(entry.caseSensitive),
    entry,
  };
}

function normalizePortableEntry(
  entry: PortableWorldInfoEntry,
  sourceIndex: number,
): NormalizedWorldInfoEntry {
  const extensions = asRecord(entry.extensions);

  return {
    sourceIndex,
    id: entry.id,
    comment: firstNonEmptyText(entry.comment, entry.name),
    content: entry.content,
    keys: normalizeKeys(entry.keys),
    enabled: entry.enabled !== false,
    constant: entry.constant === true,
    order: numberOrFallback(entry.insertion_order, sourceIndex),
    bucket: portablePositionToBucket(entry.position),
    depth: numberFrom(extensions.depth),
    scanDepth: numberFrom(extensions.scan_depth),
    caseSensitive: entry.case_sensitive ?? booleanFrom(extensions.case_sensitive),
    entry,
  };
}

function createScanText(
  chatMessages: Array<string | ChatMessageLine>,
  entry: NormalizedWorldInfoEntry,
  options: WorldInfoScanOptions,
): string {
  const scanDepth = Math.max(
    0,
    Math.floor(entry.scanDepth ?? options.scanDepth ?? defaultScanDepth),
  );
  const selectedMessages =
    scanDepth === 0 ? [] : chatMessages.slice(Math.max(0, chatMessages.length - scanDepth));

  return selectedMessages.map(messageToText).join("\n");
}

function matchesKey(
  key: string,
  scanText: string,
  entry: NormalizedWorldInfoEntry,
  options: WorldInfoScanOptions,
): boolean {
  if (key.trim().length === 0 || scanText.length === 0) {
    return false;
  }

  const caseSensitive = entry.caseSensitive ?? options.caseSensitive ?? false;

  if (caseSensitive) {
    return scanText.includes(key);
  }

  return scanText.toLocaleLowerCase().includes(key.toLocaleLowerCase());
}

function messageToText(message: string | ChatMessageLine): string {
  return typeof message === "string" ? message : message.mes;
}

function isNativeEntry(
  entry: WorldInfoScanInputEntry,
): entry is NativeWorldInfoEntry {
  return "key" in entry;
}

function nativePositionToBucket(
  position: NativeWorldInfoEntry["position"],
): WorldInfoScanBucket {
  if (position === 1) {
    return "after";
  }

  if (position === 4) {
    return "atDepth";
  }

  return "before";
}

function portablePositionToBucket(
  position: PortableWorldInfoEntry["position"],
): WorldInfoScanBucket {
  return position === "after_char" ? "after" : "before";
}

function normalizeKeys(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((key): key is string => typeof key === "string")
    : [];
}

function compareScannedEntries(
  left: ScannedWorldInfoEntry,
  right: ScannedWorldInfoEntry,
): number {
  return left.order - right.order || left.sourceIndex - right.sourceIndex;
}

function stripBucket<T extends ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }>(
  entry: T,
): ScannedWorldInfoEntry {
  const { bucket: _bucket, ...rest } = entry;
  return rest;
}

function firstNonEmptyText(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0)?.trim();
}

function nullableNumberToUndefined(value: number | null | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function nullableBooleanToUndefined(
  value: boolean | null | undefined,
): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function numberOrFallback(value: unknown, fallback: number): number {
  return numberFrom(value) ?? fallback;
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanFrom(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
