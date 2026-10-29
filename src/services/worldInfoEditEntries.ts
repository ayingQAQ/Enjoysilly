import type {
  NativeWorldInfoEntry,
  NativeWorldInfoPosition,
  PortableWorldInfoEntry,
} from "../types/worldinfo";
import {
  areWorldInfoStringArraysEqual,
  nativeEntryToDraft,
  normalizeWorldInfoKeywords,
  portableEntryToDraft,
  type WorldInfoEntryDraft,
} from "./worldInfoEditModel";

export function applyNativeEntryDraft(
  original: NativeWorldInfoEntry,
  draft: WorldInfoEntryDraft,
): NativeWorldInfoEntry {
  const updated = structuredClone(original);
  const originalDraft = nativeEntryToDraft(original, draft.sourceKey ?? "");

  assignArray(updated, "key", draft.keys, originalDraft.keys);
  assignArray(
    updated,
    "keysecondary",
    draft.secondaryKeys,
    originalDraft.secondaryKeys,
  );
  assignOptionalString(updated, "comment", draft.comment, originalDraft.comment);
  assignRequiredString(updated, "content", draft.content, originalDraft.content);
  assignBoolean(updated, "disable", !draft.enabled, !originalDraft.enabled);
  assignBoolean(updated, "constant", draft.constant, originalDraft.constant);
  assignBoolean(updated, "selective", draft.selective, originalDraft.selective);
  assignNullableNumber(
    updated,
    "selectiveLogic",
    draft.selectiveLogic,
    originalDraft.selectiveLogic,
  );
  assignNullableNumber(updated, "order", draft.order, originalDraft.order);
  assignNullableNumber(updated, "position", draft.position, originalDraft.position);
  assignNullableNumber(updated, "depth", draft.depth, originalDraft.depth);
  assignNullableBoolean(
    updated,
    "caseSensitive",
    draft.caseSensitive,
    originalDraft.caseSensitive,
  );
  assignNullableNumber(
    updated,
    "probability",
    draft.probability,
    originalDraft.probability,
  );
  assignBoolean(
    updated,
    "useProbability",
    draft.useProbability,
    originalDraft.useProbability,
  );
  assignBoolean(updated, "vectorized", draft.vectorized, originalDraft.vectorized);
  assignBoolean(
    updated,
    "excludeRecursion",
    draft.excludeRecursion,
    originalDraft.excludeRecursion,
  );
  assignBoolean(
    updated,
    "preventRecursion",
    draft.preventRecursion,
    originalDraft.preventRecursion,
  );
  assignBoolean(
    updated,
    "delayUntilRecursion",
    draft.delayUntilRecursion,
    originalDraft.delayUntilRecursion,
  );
  assignOptionalString(updated, "group", draft.group, originalDraft.group);
  assignBoolean(
    updated,
    "groupOverride",
    draft.groupOverride,
    originalDraft.groupOverride,
  );
  assignNullableNumber(
    updated,
    "groupWeight",
    draft.groupWeight,
    originalDraft.groupWeight,
  );
  assignNullableNumber(
    updated,
    "scanDepth",
    draft.scanDepth,
    originalDraft.scanDepth,
  );
  assignNullableBoolean(
    updated,
    "matchWholeWords",
    draft.matchWholeWords,
    originalDraft.matchWholeWords,
  );
  assignNullableBoolean(
    updated,
    "useGroupScoring",
    draft.useGroupScoring,
    originalDraft.useGroupScoring,
  );
  assignOptionalString(
    updated,
    "automationId",
    draft.automationId,
    originalDraft.automationId,
  );
  assignNullableNumber(updated, "role", draft.role, originalDraft.role);
  assignNullableNumber(updated, "sticky", draft.sticky, originalDraft.sticky);
  assignNullableNumber(
    updated,
    "cooldown",
    draft.cooldown,
    originalDraft.cooldown,
  );
  assignNullableNumber(updated, "delay", draft.delay, originalDraft.delay);

  return updated;
}

export function applyPortableEntryDraft(
  original: PortableWorldInfoEntry,
  draft: WorldInfoEntryDraft,
): PortableWorldInfoEntry {
  const updated = structuredClone(original);
  const originalDraft = portableEntryToDraft(original, draft.sourceKey ?? "");

  assignArray(updated, "keys", draft.keys, originalDraft.keys);
  assignArray(
    updated,
    "secondary_keys",
    draft.secondaryKeys,
    originalDraft.secondaryKeys,
  );
  assignOptionalString(updated, "comment", draft.comment, originalDraft.comment);
  assignRequiredString(updated, "content", draft.content, originalDraft.content);
  assignBoolean(updated, "enabled", draft.enabled, originalDraft.enabled);
  assignBoolean(updated, "constant", draft.constant, originalDraft.constant);
  assignBoolean(updated, "selective", draft.selective, originalDraft.selective);
  assignNullableNumber(
    updated,
    "insertion_order",
    draft.order,
    originalDraft.order,
  );
  assignPortablePosition(updated, draft.position, originalDraft.position);
  assignNullableBoolean(
    updated,
    "case_sensitive",
    draft.caseSensitive,
    originalDraft.caseSensitive,
  );

  const extensions = structuredClone(getRecord(updated.extensions));
  assignExtensionNumber(
    extensions,
    "position",
    draft.position,
    originalDraft.position,
  );
  assignExtensionBoolean(
    extensions,
    "case_sensitive",
    draft.caseSensitive,
    originalDraft.caseSensitive,
  );
  assignExtensionNumber(
    extensions,
    "selectiveLogic",
    draft.selectiveLogic,
    originalDraft.selectiveLogic,
  );
  assignExtensionNumber(extensions, "depth", draft.depth, originalDraft.depth);
  assignExtensionNumber(
    extensions,
    "probability",
    draft.probability,
    originalDraft.probability,
  );
  assignExtensionBoolean(
    extensions,
    "useProbability",
    draft.useProbability,
    originalDraft.useProbability,
  );
  assignExtensionBoolean(
    extensions,
    "vectorized",
    draft.vectorized,
    originalDraft.vectorized,
  );
  assignExtensionBoolean(
    extensions,
    "exclude_recursion",
    draft.excludeRecursion,
    originalDraft.excludeRecursion,
  );
  assignExtensionBoolean(
    extensions,
    "prevent_recursion",
    draft.preventRecursion,
    originalDraft.preventRecursion,
  );
  assignExtensionBoolean(
    extensions,
    "delay_until_recursion",
    draft.delayUntilRecursion,
    originalDraft.delayUntilRecursion,
  );
  assignExtensionString(extensions, "group", draft.group, originalDraft.group);
  assignExtensionBoolean(
    extensions,
    "group_override",
    draft.groupOverride,
    originalDraft.groupOverride,
  );
  assignExtensionNumber(
    extensions,
    "group_weight",
    draft.groupWeight,
    originalDraft.groupWeight,
  );
  assignExtensionNumber(
    extensions,
    "scan_depth",
    draft.scanDepth,
    originalDraft.scanDepth,
  );
  assignExtensionBoolean(
    extensions,
    "match_whole_words",
    draft.matchWholeWords,
    originalDraft.matchWholeWords,
  );
  assignExtensionBoolean(
    extensions,
    "use_group_scoring",
    draft.useGroupScoring,
    originalDraft.useGroupScoring,
  );
  assignExtensionString(
    extensions,
    "automation_id",
    draft.automationId,
    originalDraft.automationId,
  );
  assignExtensionNumber(extensions, "role", draft.role, originalDraft.role);
  assignExtensionNumber(
    extensions,
    "sticky",
    draft.sticky,
    originalDraft.sticky,
  );
  assignExtensionNumber(
    extensions,
    "cooldown",
    draft.cooldown,
    originalDraft.cooldown,
  );
  assignExtensionNumber(extensions, "delay", draft.delay, originalDraft.delay);

  if (Object.keys(extensions).length > 0 || updated.extensions !== undefined) {
    updated.extensions = extensions;
  }

  return updated;
}

export function createNativeEntry(
  draft: WorldInfoEntryDraft,
  uid: number,
): NativeWorldInfoEntry {
  const entry: NativeWorldInfoEntry = {
    uid,
    key: normalizeWorldInfoKeywords(draft.keys),
    keysecondary: normalizeWorldInfoKeywords(draft.secondaryKeys),
    comment: draft.comment,
    content: draft.content,
    constant: draft.constant,
    selective: draft.selective,
    selectiveLogic: draft.selectiveLogic ?? 0,
    order: draft.order ?? uid * 100,
    position: (draft.position ?? 0) as NativeWorldInfoPosition,
    disable: !draft.enabled,
    caseSensitive: draft.caseSensitive,
    probability: draft.probability ?? 100,
    useProbability: draft.useProbability,
    vectorized: draft.vectorized,
    excludeRecursion: draft.excludeRecursion,
    preventRecursion: draft.preventRecursion,
    delayUntilRecursion: draft.delayUntilRecursion,
  };

  assignNewOptionalNumber(entry, "depth", draft.depth);
  assignNewOptionalString(entry, "group", draft.group);
  entry.groupOverride = draft.groupOverride;
  assignNewOptionalNumber(entry, "groupWeight", draft.groupWeight);
  assignNewOptionalNumber(entry, "scanDepth", draft.scanDepth);
  assignNewOptionalBoolean(entry, "matchWholeWords", draft.matchWholeWords);
  assignNewOptionalBoolean(entry, "useGroupScoring", draft.useGroupScoring);
  assignNewOptionalString(entry, "automationId", draft.automationId);
  assignNewOptionalNumber(entry, "role", draft.role);
  assignNewOptionalNumber(entry, "sticky", draft.sticky);
  assignNewOptionalNumber(entry, "cooldown", draft.cooldown);
  assignNewOptionalNumber(entry, "delay", draft.delay);

  return entry;
}

export function createPortableEntry(
  draft: WorldInfoEntryDraft,
  index: number,
  existing: PortableWorldInfoEntry[],
): PortableWorldInfoEntry {
  const nextId =
    Math.max(-1, ...existing.map((entry) => entry.id ?? -1)) + index + 1;
  const extensions: Record<string, unknown> = {};

  assignNewExtensionNumber(extensions, "selectiveLogic", draft.selectiveLogic);
  assignNewExtensionNumber(extensions, "position", draft.position);
  assignNewExtensionNumber(extensions, "depth", draft.depth);
  assignNewExtensionNumber(extensions, "probability", draft.probability);
  if (draft.useProbability) extensions.useProbability = true;
  if (draft.vectorized) extensions.vectorized = true;
  if (draft.excludeRecursion) extensions.exclude_recursion = true;
  if (draft.preventRecursion) extensions.prevent_recursion = true;
  if (draft.delayUntilRecursion) extensions.delay_until_recursion = true;
  assignNewExtensionString(extensions, "group", draft.group);
  if (draft.groupOverride) extensions.group_override = true;
  assignNewExtensionNumber(extensions, "group_weight", draft.groupWeight);
  assignNewExtensionNumber(extensions, "scan_depth", draft.scanDepth);
  assignNewExtensionBoolean(
    extensions,
    "match_whole_words",
    draft.matchWholeWords,
  );
  assignNewExtensionBoolean(
    extensions,
    "use_group_scoring",
    draft.useGroupScoring,
  );
  assignNewExtensionString(extensions, "automation_id", draft.automationId);
  assignNewExtensionNumber(extensions, "role", draft.role);
  assignNewExtensionNumber(extensions, "sticky", draft.sticky);
  assignNewExtensionNumber(extensions, "cooldown", draft.cooldown);
  assignNewExtensionNumber(extensions, "delay", draft.delay);

  return {
    id: nextId,
    keys: normalizeWorldInfoKeywords(draft.keys),
    secondary_keys: normalizeWorldInfoKeywords(draft.secondaryKeys),
    comment: draft.comment,
    content: draft.content,
    constant: draft.constant,
    selective: draft.selective,
    insertion_order: draft.order ?? (index + 1) * 100,
    enabled: draft.enabled,
    position: draft.position === 1 ? "after_char" : "before_char",
    case_sensitive: draft.caseSensitive ?? undefined,
    extensions,
  };
}

function assignArray<T extends object, K extends keyof T>(
  target: T,
  key: K,
  next: string[],
  original: string[],
): void {
  if (!areWorldInfoStringArraysEqual(next, original)) {
    target[key] = normalizeWorldInfoKeywords(next) as T[K];
  }
}

function assignRequiredString<T extends object, K extends keyof T>(
  target: T,
  key: K,
  next: string,
  original: string,
): void {
  if (next !== original) target[key] = next as T[K];
}

function assignOptionalString<T extends object, K extends keyof T>(
  target: T,
  key: K,
  next: string,
  original: string,
): void {
  if (next !== original) {
    if (next) target[key] = next as T[K];
    else delete target[key];
  }
}

function assignBoolean<T extends object, K extends keyof T>(
  target: T,
  key: K,
  next: boolean,
  original: boolean,
): void {
  if (next !== original) target[key] = next as T[K];
}

function assignNullableNumber<T extends object, K extends keyof T>(
  target: T,
  key: K,
  next: number | null,
  original: number | null,
): void {
  if (next !== original) {
    if (next === null) delete target[key];
    else target[key] = next as T[K];
  }
}

function assignNullableBoolean<T extends object, K extends keyof T>(
  target: T,
  key: K,
  next: boolean | null,
  original: boolean | null,
): void {
  if (next !== original) {
    if (next === null) delete target[key];
    else target[key] = next as T[K];
  }
}

function assignPortablePosition(
  target: PortableWorldInfoEntry,
  next: number | null,
  original: number | null,
): void {
  if (next !== original) {
    if (next === null) delete target.position;
    else target.position = next === 1 ? "after_char" : "before_char";
  }
}

function assignNewOptionalNumber<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: number | null,
): void {
  if (value !== null) target[key] = value as T[K];
}

function assignNewOptionalBoolean<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: boolean | null,
): void {
  if (value !== null) target[key] = value as T[K];
}

function assignNewOptionalString<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: string,
): void {
  if (value) target[key] = value as T[K];
}

function assignNewExtensionNumber(
  target: Record<string, unknown>,
  key: string,
  value: number | null,
): void {
  if (value !== null) target[key] = value;
}

function assignNewExtensionBoolean(
  target: Record<string, unknown>,
  key: string,
  value: boolean | null,
): void {
  if (value !== null) target[key] = value;
}

function assignNewExtensionString(
  target: Record<string, unknown>,
  key: string,
  value: string,
): void {
  if (value) target[key] = value;
}

function assignExtensionNumber(
  target: Record<string, unknown>,
  key: string,
  next: number | null,
  original: number | null,
): void {
  if (next !== original) {
    if (next === null) delete target[key];
    else target[key] = next;
  }
}

function assignExtensionBoolean(
  target: Record<string, unknown>,
  key: string,
  next: boolean | null,
  original: boolean | null,
): void {
  if (next !== original) {
    if (next === null) delete target[key];
    else target[key] = next;
  }
}

function assignExtensionString(
  target: Record<string, unknown>,
  key: string,
  next: string,
  original: string,
): void {
  if (next !== original) {
    if (next) target[key] = next;
    else delete target[key];
  }
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
