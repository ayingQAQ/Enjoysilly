import { isPortableCharacterBook } from "../lib/worldInfoIO";
import type { StoredWorldInfo } from "../lib/db";
import type {
  NativeWorldInfoBook,
  NativeWorldInfoEntry,
  PortableCharacterBook,
  PortableWorldInfoEntry,
} from "../types/worldinfo";

export type WorldInfoEditDialect = "native" | "portable";

export interface WorldInfoEntryDraft {
  draftId: string;
  sourceKey?: string;
  isNew: boolean;
  keys: string[];
  secondaryKeys: string[];
  comment: string;
  content: string;
  enabled: boolean;
  constant: boolean;
  selective: boolean;
  selectiveLogic: number | null;
  order: number | null;
  position: number | null;
  depth: number | null;
  caseSensitive: boolean | null;
  probability: number | null;
  useProbability: boolean;
  vectorized: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  delayUntilRecursion: boolean;
  group: string;
  groupOverride: boolean;
  groupWeight: number | null;
  scanDepth: number | null;
  matchWholeWords: boolean | null;
  useGroupScoring: boolean | null;
  automationId: string;
  role: number | null;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
}

export interface WorldInfoEditDraft {
  baseVersion?: string;
  name: string;
  dialect: WorldInfoEditDialect;
  entries: WorldInfoEntryDraft[];
}

export interface WorldInfoEditValidationErrors {
  name?: string;
  entries: Record<string, { probability?: string }>;
}

export function createWorldInfoEditDraft(
  stored: StoredWorldInfo,
): WorldInfoEditDraft {
  const isPortable = isPortableCharacterBook(stored.payload);
  const dialect: WorldInfoEditDialect = isPortable ? "portable" : "native";
  const entries = isPortable
    ? (stored.payload as PortableCharacterBook).entries.map((entry, index) =>
        portableEntryToDraft(entry, String(index)),
      )
    : Object.entries((stored.payload as NativeWorldInfoBook).entries).map(
        ([sourceKey, entry]) => nativeEntryToDraft(entry, sourceKey),
      );

  return { baseVersion: JSON.stringify(stored), name: stored.name, dialect, entries };
}

export function createNewWorldInfoEntryDraft(
  dialect: WorldInfoEditDialect,
): WorldInfoEntryDraft {
  return {
    draftId: createDraftId(),
    isNew: true,
    keys: [],
    secondaryKeys: [],
    comment: "",
    content: "",
    enabled: true,
    constant: false,
    selective: false,
    selectiveLogic: dialect === "native" ? 0 : null,
    order: null,
    position: 0,
    depth: null,
    caseSensitive: null,
    probability: dialect === "native" ? 100 : null,
    useProbability: false,
    vectorized: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: false,
    group: "",
    groupOverride: false,
    groupWeight: null,
    scanDepth: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: "",
    role: null,
    sticky: null,
    cooldown: null,
    delay: null,
  };
}

export function validateWorldInfoEditDraft(
  draft: WorldInfoEditDraft,
): WorldInfoEditValidationErrors {
  const errors: WorldInfoEditValidationErrors = { entries: {} };

  if (!draft.name.trim()) errors.name = "世界书名称不能为空。";

  for (const entry of draft.entries) {
    if (
      entry.probability !== null &&
      (entry.probability < 0 || entry.probability > 100)
    ) {
      errors.entries[entry.draftId] = {
        probability: "概率必须在 0–100 之间。",
      };
    }
  }

  return errors;
}

export function nativeEntryToDraft(
  entry: NativeWorldInfoEntry,
  sourceKey: string,
): WorldInfoEntryDraft {
  return {
    draftId: `native:${sourceKey}`,
    sourceKey,
    isNew: false,
    keys: [...entry.key],
    secondaryKeys: [...(entry.keysecondary ?? [])],
    comment: entry.comment ?? "",
    content: entry.content,
    enabled: entry.disable !== true,
    constant: entry.constant === true,
    selective: entry.selective === true,
    selectiveLogic: entry.selectiveLogic ?? null,
    order: entry.order ?? null,
    position: entry.position ?? null,
    depth: entry.depth ?? null,
    caseSensitive: entry.caseSensitive ?? null,
    probability: entry.probability ?? null,
    useProbability: entry.useProbability === true,
    vectorized: entry.vectorized === true,
    excludeRecursion: entry.excludeRecursion === true,
    preventRecursion: entry.preventRecursion === true,
    delayUntilRecursion: entry.delayUntilRecursion === true,
    group: entry.group ?? "",
    groupOverride: entry.groupOverride === true,
    groupWeight: entry.groupWeight ?? null,
    scanDepth: entry.scanDepth ?? null,
    matchWholeWords: entry.matchWholeWords ?? null,
    useGroupScoring: entry.useGroupScoring ?? null,
    automationId: entry.automationId ?? "",
    role: entry.role ?? null,
    sticky: entry.sticky ?? null,
    cooldown: entry.cooldown ?? null,
    delay: entry.delay ?? null,
  };
}

export function portableEntryToDraft(
  entry: PortableWorldInfoEntry,
  sourceKey: string,
): WorldInfoEntryDraft {
  const extensions = getRecord(entry.extensions);

  return {
    draftId: `portable:${sourceKey}`,
    sourceKey,
    isNew: false,
    keys: [...entry.keys],
    secondaryKeys: [...(entry.secondary_keys ?? [])],
    comment: entry.comment ?? entry.name ?? "",
    content: entry.content,
    enabled: entry.enabled !== false,
    constant: entry.constant === true,
    selective: entry.selective === true,
    selectiveLogic: numberOrNull(extensions.selectiveLogic),
    order: entry.insertion_order ?? null,
    position: portablePositionToNumber(entry.position, extensions.position),
    depth: numberOrNull(extensions.depth),
    caseSensitive:
      entry.case_sensitive ?? booleanOrNull(extensions.case_sensitive),
    probability: numberOrNull(extensions.probability),
    useProbability: extensions.useProbability === true,
    vectorized: extensions.vectorized === true,
    excludeRecursion: extensions.exclude_recursion === true,
    preventRecursion: extensions.prevent_recursion === true,
    delayUntilRecursion: extensions.delay_until_recursion === true,
    group: stringOrEmpty(extensions.group),
    groupOverride: extensions.group_override === true,
    groupWeight: numberOrNull(extensions.group_weight),
    scanDepth: numberOrNull(extensions.scan_depth),
    matchWholeWords: booleanOrNull(extensions.match_whole_words),
    useGroupScoring: booleanOrNull(extensions.use_group_scoring),
    automationId: stringOrEmpty(extensions.automation_id),
    role: numberOrNull(extensions.role),
    sticky: numberOrNull(extensions.sticky),
    cooldown: numberOrNull(extensions.cooldown),
    delay: numberOrNull(extensions.delay),
  };
}

export function normalizeWorldInfoKeywords(values: string[]): string[] {
  const seen = new Set<string>();

  return values.flatMap((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    return [normalized];
  });
}

export function areWorldInfoStringArraysEqual(
  left: string[],
  right: string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function portablePositionToNumber(
  position: PortableWorldInfoEntry["position"],
  extensionPosition: unknown,
): number | null {
  if (typeof extensionPosition === "number") return extensionPosition;
  if (position === "before_char") return 0;
  if (position === "after_char") return 1;
  return null;
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function createDraftId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `new:${crypto.randomUUID()}`
    : `new:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
