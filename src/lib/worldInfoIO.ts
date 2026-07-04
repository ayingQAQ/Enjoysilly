import type {
  NativeWorldInfoBook,
  NativeWorldInfoEntry,
  NativeWorldInfoPosition,
  PortableCharacterBook,
  PortableWorldInfoEntry,
  PortableWorldInfoPosition,
} from "../types/worldinfo";

type EntryExtensions = Record<string, unknown>;

const portableToNativePosition: Record<
  PortableWorldInfoPosition,
  NativeWorldInfoPosition
> = {
  before_char: 0,
  after_char: 1,
};

const nativeToPortablePosition: Record<number, PortableWorldInfoPosition> = {
  0: "before_char",
  1: "after_char",
};

export function portableBookToNativeWorldInfo(
  book: PortableCharacterBook,
): NativeWorldInfoBook {
  const { entries, ...bookRest } = book;
  const nativeEntries = entries.reduce<Record<string, NativeWorldInfoEntry>>(
    (accumulator, entry, index) => {
      const nativeEntry = portableEntryToNative(entry, index);
      accumulator[String(nativeEntry.uid ?? index)] = nativeEntry;
      return accumulator;
    },
    {},
  );

  return {
    ...bookRest,
    entries: nativeEntries,
  };
}

export function nativeWorldInfoToPortableBook(
  worldInfo: NativeWorldInfoBook,
): PortableCharacterBook {
  const { entries, ...bookRest } = worldInfo;
  const portableEntries = Object.entries(entries)
    .sort(([leftKey, leftEntry], [rightKey, rightEntry]) => {
      const leftOrder = leftEntry.order ?? Number(leftKey);
      const rightOrder = rightEntry.order ?? Number(rightKey);
      return leftOrder - rightOrder;
    })
    .map(([, entry]) => nativeEntryToPortable(entry));

  return {
    ...bookRest,
    entries: portableEntries,
  };
}

export function parseWorldInfoJson(
  json: string,
): NativeWorldInfoBook | PortableCharacterBook {
  const value = JSON.parse(json) as unknown;

  if (isNativeWorldInfoBook(value) || isPortableCharacterBook(value)) {
    return value;
  }

  throw new Error("JSON is not a supported world info file.");
}

export function serializeWorldInfoJson(
  worldInfo: NativeWorldInfoBook | PortableCharacterBook,
  space: number | undefined = 2,
): string {
  return JSON.stringify(worldInfo, null, space);
}

export function isNativeWorldInfoBook(
  value: unknown,
): value is NativeWorldInfoBook {
  return (
    isRecord(value) &&
    isRecord(value.entries) &&
    !Array.isArray(value.entries)
  );
}

export function isPortableCharacterBook(
  value: unknown,
): value is PortableCharacterBook {
  return isRecord(value) && Array.isArray(value.entries);
}

export function portableEntryToNative(
  entry: PortableWorldInfoEntry,
  fallbackUid = 0,
): NativeWorldInfoEntry {
  const {
    keys,
    secondary_keys,
    insertion_order,
    enabled,
    case_sensitive,
    id,
    display_index,
    position,
    extensions,
    ...rest
  } = entry;
  const ext = asRecord(extensions);

  return pruneUndefined({
    ...rest,
    uid: id ?? fallbackNumber(ext.id, fallbackUid),
    key: keys,
    keysecondary: secondary_keys,
    order: insertion_order ?? numberFrom(ext.order),
    disable: enabled === undefined ? booleanFrom(ext.disable) : !enabled,
    caseSensitive: case_sensitive ?? booleanFrom(ext.case_sensitive),
    position: mapPortablePosition(position) ?? nativePositionFrom(ext.position),
    displayIndex: display_index ?? numberFrom(ext.displayIndex),
    selectiveLogic: numberFrom(ext.selectiveLogic),
    vectorized: booleanFrom(ext.vectorized),
    matchWholeWords: booleanFrom(ext.match_whole_words),
    probability: numberFrom(ext.probability),
    useProbability: booleanFrom(ext.useProbability),
    sticky: numberFrom(ext.sticky),
    cooldown: numberFrom(ext.cooldown),
    delay: numberFrom(ext.delay),
    excludeRecursion: booleanFrom(ext.exclude_recursion),
    preventRecursion: booleanFrom(ext.prevent_recursion),
    delayUntilRecursion: booleanFrom(ext.delay_until_recursion),
    group: stringFrom(ext.group),
    groupOverride: booleanFrom(ext.group_override),
    groupWeight: numberFrom(ext.group_weight),
    useGroupScoring: booleanFrom(ext.use_group_scoring),
    scanDepth: numberFrom(ext.scan_depth),
    automationId: stringFrom(ext.automation_id),
    role: numberFrom(ext.role),
  });
}

export function nativeEntryToPortable(
  entry: NativeWorldInfoEntry,
): PortableWorldInfoEntry {
  const {
    key,
    keysecondary,
    order,
    disable,
    caseSensitive,
    uid,
    position,
    displayIndex,
    selectiveLogic,
    vectorized,
    matchWholeWords,
    probability,
    useProbability,
    sticky,
    cooldown,
    delay,
    excludeRecursion,
    preventRecursion,
    delayUntilRecursion,
    group,
    groupOverride,
    groupWeight,
    useGroupScoring,
    scanDepth,
    automationId,
    role,
    ...rest
  } = entry;
  const portablePosition = mapNativePosition(position);
  const extensions = pruneUndefined({
    selectiveLogic,
    position,
    role,
    match_whole_words: matchWholeWords,
    probability,
    useProbability,
    sticky,
    cooldown,
    delay,
    exclude_recursion: excludeRecursion,
    prevent_recursion: preventRecursion,
    delay_until_recursion: delayUntilRecursion,
    group,
    group_override: groupOverride,
    group_weight: groupWeight,
    use_group_scoring: useGroupScoring,
    scan_depth: scanDepth,
    case_sensitive: caseSensitive,
    automation_id: automationId,
    vectorized,
  });

  return pruneUndefined({
    ...rest,
    keys: key,
    secondary_keys: keysecondary,
    insertion_order: order,
    enabled: disable === undefined ? undefined : !disable,
    case_sensitive: caseSensitive ?? undefined,
    id: uid,
    display_index: displayIndex,
    position: portablePosition,
    extensions,
  });
}

function mapPortablePosition(
  position: PortableWorldInfoPosition | undefined,
): NativeWorldInfoPosition | undefined {
  return position === undefined ? undefined : portableToNativePosition[position];
}

function mapNativePosition(
  position: NativeWorldInfoPosition | undefined,
): PortableWorldInfoPosition | undefined {
  if (position === undefined) {
    return undefined;
  }

  return nativeToPortablePosition[position] ?? "before_char";
}

function asRecord(value: unknown): EntryExtensions {
  return typeof value === "object" && value !== null
    ? (value as EntryExtensions)
    : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function booleanFrom(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nativePositionFrom(value: unknown): NativeWorldInfoPosition | undefined {
  const numberValue = numberFrom(value);

  return numberValue !== undefined && numberValue >= 0 && numberValue <= 7
    ? (numberValue as NativeWorldInfoPosition)
    : undefined;
}

function fallbackNumber(value: unknown, fallback: number): number {
  return numberFrom(value) ?? fallback;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
