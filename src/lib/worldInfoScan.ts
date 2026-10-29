import type { ChatMessageLine } from "../types/chat";
import { timedDurations } from "./worldInfoTimed";
import { worldInfoExecutionNotes, type WorldInfoAttempt, type WorldInfoDiagnostic } from "./worldInfoDiagnostics";
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
  diagnostics?: boolean;
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
  reasons: Array<"constant" | "keyword" | "sticky">;
  entry: WorldInfoScanInputEntry;
}

export interface WorldInfoScanResult {
  runtimeState?: WorldInfoScanRuntimeState;
  diagnostics?: WorldInfoDiagnostic[];
  before: ScannedWorldInfoEntry[];
  after: ScannedWorldInfoEntry[];
  atDepth: ScannedWorldInfoEntry[];
}

type WorldInfoScanBucket = "before" | "after" | "atDepth";

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
  const diagnostics: WorldInfoDiagnostic[] | undefined = options.diagnostics ? normalizedEntries.map(e => ({
    sourceIndex: e.sourceIndex, id: e.id, comment: e.comment, bucket: e.bucket,
    outcome: !e.enabled ? "disabled" : !e.content.trim() ? "empty" : e.delayUntilRecursion ? "recursion-only" : "no-keyword",
    attempts: [], notes: worldInfoExecutionNotes(e.entry, options),
  })) : undefined;
  const finish = (hits: Array<ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }>) => {
    const kept = options.enabledFeatures?.tokenBudget ? applyTokenBudget(hits, options) : hits;
    if (diagnostics) {
      const selected = new Set(kept.map(e => e.sourceIndex));
      for (const hit of hits) diagnostics[hit.sourceIndex].outcome = selected.has(hit.sourceIndex) ? "selected" : "budget";
    }
    const result = buildScanResult(kept);
    if (options.enabledFeatures?.timedEffects) {
      const turn = options.runtimeState?.turnIndex ?? 0;
      const timedByEntryId = { ...options.runtimeState?.timedByEntryId };
      for (const hit of kept) {
        const durations = timedDurations(hit.entry);
        if (!durations.sticky && !durations.cooldown) continue;
        const key = String(hit.sourceIndex);
        const previous = timedByEntryId[key];
        if (previous?.lastTriggeredTurn === turn || (previous?.stickyUntil ?? -1) > turn) continue;
        const stickyUntil = turn + Math.max(1, durations.sticky);
        timedByEntryId[key] = { lastTriggeredTurn: turn, stickyUntil, cooldownUntil: stickyUntil + durations.cooldown };
      }
      result.runtimeState = { turnIndex: turn, timedByEntryId };
    }
    return diagnostics ? { ...result, diagnostics } : result;
  };

  const firstRound = runSingleScan(
    normalizedEntries.filter((e) => !e.delayUntilRecursion || isSticky(e, options)),
    chatMessages,
    options,
    diagnostics,
    0,
  );

  if (options.enabledFeatures?.recursion !== true) {
    return finish(firstRound);
  }

  const depth = Math.max(0, Math.floor(options.recursionDepth ?? 1));
  if (depth === 0) return finish(firstRound);

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
      diagnostics,
      round + 1,
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

  return finish(allResults);
}

function runSingleScan(
  candidates: NormalizedWorldInfoEntry[],
  messages: Array<string | ChatMessageLine>,
  options: WorldInfoScanOptions,
  diagnostics?: WorldInfoDiagnostic[],
  round = 0,
): Array<ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }> {
  return candidates
    .filter((entry) => entry.enabled && entry.content.trim().length > 0)
    .map((entry) => scanEntry(entry, messages, options, diagnostics?.[entry.sourceIndex], round))
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
  diagnostic?: WorldInfoDiagnostic,
  round = 0,
): (ScannedWorldInfoEntry & { bucket: WorldInfoScanBucket }) | undefined {
  const scanText = createScanText(chatMessages, entry, options);
  const matchedKeys = entry.keys.filter((key) =>
    matchesKey(key, scanText, entry, options),
  );
  const reasons: ScannedWorldInfoEntry["reasons"] = [];
  const attempt: WorldInfoAttempt = { round, matchedKeys, matchedSecondary: [], reasons, outcome: "no-keyword" };
  const decide = (outcome: WorldInfoAttempt["outcome"]) => {
    attempt.outcome = outcome;
    if (diagnostic) { diagnostic.outcome = outcome; diagnostic.attempts.push(attempt); }
  };

  const sticky = isSticky(entry, options);
  if (options.enabledFeatures?.timedEffects) {
    const turn = options.runtimeState?.turnIndex ?? 0;
    const state = options.runtimeState?.timedByEntryId?.[String(entry.sourceIndex)];
    if (turn < timedDurations(entry.entry).delay) { decide("delay"); return undefined; }
    if (!sticky && turn < (state?.cooldownUntil ?? -1)) { decide("cooldown"); return undefined; }
    if (sticky) reasons.push("sticky");
  }

  if (entry.constant) {
    reasons.push("constant");
  }

  if (matchedKeys.length > 0) {
    const selectiveEnabled = options.enabledFeatures?.selective === true;

    if (!sticky && selectiveEnabled && entry.selective && entry.keysecondary.length > 0) {
      const matchedSecondary = entry.keysecondary.filter((key) =>
        matchesKey(key, scanText, entry, options),
      );
      attempt.matchedSecondary = matchedSecondary;

      if (!evaluateSelectiveLogic(matchedSecondary.length, entry.keysecondary.length, entry.selectiveLogic)) {
        decide("selective");
        return undefined;
      }
    }

    reasons.push("keyword");
  }

  if (reasons.length === 0) {
    decide("no-keyword");
    return undefined;
  }

  if (!sticky && options.enabledFeatures?.probability === true && !passesProbability(entry, options, attempt)) {
    decide("probability");
    return undefined;
  }

  decide("selected");
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

function isSticky(entry: NormalizedWorldInfoEntry, options: WorldInfoScanOptions): boolean {
  return options.enabledFeatures?.timedEffects === true &&
    (options.runtimeState?.timedByEntryId?.[String(entry.sourceIndex)]?.stickyUntil ?? -1) > (options.runtimeState?.turnIndex ?? 0);
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
  attempt: WorldInfoAttempt,
): boolean {
  if (!entry.useProbability || entry.probability === undefined) return true;

  if (entry.probability <= 0) return false;
  if (entry.probability >= 100) return true;

  const random = options.random ?? Math.random;

  attempt.probabilityRoll = random() * 100;
  return attempt.probabilityRoll < entry.probability;
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
