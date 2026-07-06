import type { ChatMessageLine } from "../types/chat";
import type {
  NativeWorldInfoEntry,
  PortableWorldInfoEntry,
} from "../types/worldinfo";

export type WorldInfoScanInputEntry =
  | NativeWorldInfoEntry
  | PortableWorldInfoEntry;

export interface WorldInfoScanEnabledFeatures {
  selective?: boolean;
  probability?: boolean;
  recursion?: boolean;
  tokenBudget?: boolean;
  timedEffects?: boolean;
  groupScoring?: boolean;
}

export interface WorldInfoTimedState {
  stickyUntil?: number;
  cooldownUntil?: number;
  delayedUntil?: number;
  lastTriggeredTurn?: number;
}

export interface WorldInfoScanRuntimeState {
  turnIndex?: number;
  timedByEntryId?: Record<string, WorldInfoTimedState>;
}

export interface WorldInfoScanOptions {
  scanDepth?: number;
  caseSensitive?: boolean;
  mode?: "simple" | "full";
  random?: () => number;
  tokenBudget?: number;
  estimateTokens?: (text: string) => number;
  enabledFeatures?: WorldInfoScanEnabledFeatures;
  runtimeState?: WorldInfoScanRuntimeState;
  recursionDepth?: number;
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
  keysecondary: string[];
  selective: boolean;
  selectiveLogic: number;
  probability?: number;
  useProbability: boolean;
  enabled: boolean;
  constant: boolean;
  order: number;
  bucket: WorldInfoScanBucket;
  depth?: number;
  scanDepth?: number;
  caseSensitive?: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  delayUntilRecursion: boolean;
  entry: WorldInfoScanInputEntry;
}

const defaultScanDepth = 4;

export function scanWorldInfo(
  entries: WorldInfoScanInputEntry[],
  chatMessages: Array<string | ChatMessageLine>,
  options: WorldInfoScanOptions = {},
): WorldInfoScanResult {
  const normalizedEntries = entries.map(normalizeEntry);

  const firstRound = runSingleScan(
    normalizedEntries.filter((e) => !e.delayUntilRecursion),
    chatMessages,
    options,
  );

  if (options.enabledFeatures?.recursion !== true) {
    if (options.enabledFeatures?.tokenBudget === true) {
      return buildScanResult(applyTokenBudget(firstRound, options));
    }

    return buildScanResult(firstRound);
  }

  const depth = Math.max(0, Math.floor(options.recursionDepth ?? 1));
  if (depth === 0) return buildScanResult(firstRound);

  const triggered = new Set<number>();
  let poolContent = "";
  const allResults = [...firstRound];

  for (const r of firstRound) {
    triggered.add(r.sourceIndex);
    const norm = normalizedEntries[r.sourceIndex];
    if (norm && !norm.excludeRecursion) {
      poolContent += (poolContent ? "\n" : "") + r.content;
    }
  }

  for (let round = 0; round < depth; round += 1) {
    if (poolContent.trim().length === 0) break;

    const roundHits = runSingleScan(
      normalizedEntries.filter(
        (e) => !triggered.has(e.sourceIndex) && !e.preventRecursion,
      ),
      [poolContent],
      options,
    );

    if (roundHits.length === 0) break;

    let nextPool = "";

    for (const r of roundHits) {
      triggered.add(r.sourceIndex);
      allResults.push(r);

      const norm = normalizedEntries[r.sourceIndex];
      if (norm && !norm.excludeRecursion) {
        nextPool += (nextPool ? "\n" : "") + r.content;
      }
    }

    poolContent = nextPool;
  }

  if (options.enabledFeatures?.tokenBudget === true) {
    return buildScanResult(applyTokenBudget(allResults, options));
  }

  return buildScanResult(allResults);
}

function runSingleScan(
  candidates: NormalizedWorldInfoEntry[],
  messages: Array<string | ChatMessageLine>,
  options: WorldInfoScanOptions,
): Array<ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }> {
  return candidates
    .filter((entry) => entry.enabled && entry.content.trim().length > 0)
    .map((entry) => scanEntry(entry, messages, options))
    .filter((entry): entry is ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket } =>
      Boolean(entry),
    );
}

function buildScanResult(
  entries: Array<ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }>,
): WorldInfoScanResult {
  const deduped = entries
    .filter((e, i, arr) => arr.findIndex((x) => x.sourceIndex === e.sourceIndex) === i)
    .sort(compareScannedEntries);

  return {
    before: deduped.filter((e) => e.bucket === "before").map(stripBucket),
    after: deduped.filter((e) => e.bucket === "after").map(stripBucket),
    atDepth: deduped.filter((e) => e.bucket === "atDepth").map(stripBucket),
  };
}

function applyTokenBudget(
  entries: Array<ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }>,
  options: WorldInfoScanOptions,
): Array<ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }> {
  const budget = options.tokenBudget;
  const estimate = options.estimateTokens;

  if (budget === undefined || estimate === undefined) return entries;

  const sorted = [...entries].sort(compareScannedEntries);
  const result: Array<ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }> = [];
  let used = 0;

  for (const entry of sorted) {
    const cost = estimate(entry.content);

    if (used + cost > budget) continue;

    result.push(entry);
    used += cost;
  }

  return result;
}

function scanEntry(
  entry: NormalizedWorldInfoEntry,
  chatMessages: Array<string | ChatMessageLine>,
  options: WorldInfoScanOptions,
): (ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }) | undefined {
  const scanText = createScanText(chatMessages, entry, options);
  const matchedKeys = entry.keys.filter((key) =>
    matchesKey(key, scanText, entry, options),
  );
  const reasons: ScannedWorldInfoEntry["reasons"] = [];

  if (entry.constant) {
    reasons.push("constant");
  }

  if (matchedKeys.length > 0) {
    const selectiveEnabled = options.enabledFeatures?.selective === true;

    if (selectiveEnabled && entry.selective && entry.keysecondary.length > 0) {
      const matchedSecondary = entry.keysecondary.filter((key) =>
        matchesKey(key, scanText, entry, options),
      );

      if (!evaluateSelectiveLogic(matchedSecondary.length, entry.keysecondary.length, entry.selectiveLogic)) {
        return undefined;
      }
    }

    reasons.push("keyword");
  }

  if (reasons.length === 0) {
    return undefined;
  }

  if (options.enabledFeatures?.probability === true && !passesProbability(entry, options)) {
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

function evaluateSelectiveLogic(
  matchedCount: number,
  totalCount: number,
  logic: number,
): boolean {
  if (totalCount === 0) return true;

  switch (logic) {
    case 0:
      return matchedCount > 0;
    case 1:
      return matchedCount < totalCount;
    case 2:
      return matchedCount === 0;
    case 3:
      return matchedCount === totalCount;
    default:
      return matchedCount > 0;
  }
}

function passesProbability(
  entry: NormalizedWorldInfoEntry,
  options: WorldInfoScanOptions,
): boolean {
  if (!entry.useProbability || entry.probability === undefined) return true;

  if (entry.probability <= 0) return false;
  if (entry.probability >= 100) return true;

  const random = options.random ?? Math.random;

  return random() * 100 < entry.probability;
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
    keysecondary: normalizeKeys(entry.keysecondary),
    selective: entry.selective === true,
    selectiveLogic: typeof entry.selectiveLogic === "number" ? entry.selectiveLogic : 0,
    enabled: entry.disable !== true,
    constant: entry.constant === true,
    order: numberOrFallback(entry.order, sourceIndex),
    bucket: nativePositionToBucket(entry.position),
    depth: entry.depth,
    scanDepth: nullableNumberToUndefined(entry.scanDepth),
    probability: numberFrom(entry.probability),
    useProbability: entry.useProbability === true,
    caseSensitive: nullableBooleanToUndefined(entry.caseSensitive),
    excludeRecursion: entry.excludeRecursion === true,
    preventRecursion: entry.preventRecursion === true,
    delayUntilRecursion: entry.delayUntilRecursion === true,
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
    keysecondary: normalizeKeys(entry.secondary_keys),
    selective: entry.selective === true,
    selectiveLogic: typeof (extensions.selectiveLogic) === "number"
      ? (extensions.selectiveLogic as number)
      : 0,
    enabled: entry.enabled !== false,
    constant: entry.constant === true,
    order: numberOrFallback(entry.insertion_order, sourceIndex),
    bucket: portablePositionToBucket(entry.position),
    depth: numberFrom(extensions.depth),
    scanDepth: numberFrom(extensions.scan_depth),
    probability: numberFrom(extensions.probability),
    useProbability: booleanFrom(extensions.useProbability) === true,
    caseSensitive: entry.case_sensitive ?? booleanFrom(extensions.case_sensitive),
    excludeRecursion:
      firstBoolean(extensions.exclude_recursion, extensions.excludeRecursion) === true,
    preventRecursion:
      firstBoolean(extensions.prevent_recursion, extensions.preventRecursion) === true,
    delayUntilRecursion:
      firstBoolean(extensions.delay_until_recursion, extensions.delayUntilRecursion) === true,
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

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    const parsed = booleanFrom(value);
    if (parsed !== undefined) return parsed;
  }

  return undefined;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
