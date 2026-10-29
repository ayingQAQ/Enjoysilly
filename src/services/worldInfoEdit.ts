import {
  getMySillyDatabase,
  type MySillyDatabaseConnection,
  type StoredWorldInfo,
} from "../lib/db";
import {
  isPortableCharacterBook,
  nativeWorldInfoToPortableBook,
} from "../lib/worldInfoIO";
import type {
  NativeWorldInfoBook,
  NativeWorldInfoEntry,
  PortableWorldInfoEntry,
} from "../types/worldinfo";
import {
  applyNativeEntryDraft,
  applyPortableEntryDraft,
  createNativeEntry,
  createPortableEntry,
} from "./worldInfoEditEntries";
import {
  areWorldInfoStringArraysEqual,
  validateWorldInfoEditDraft,
  type WorldInfoEditDialect,
  type WorldInfoEditDraft,
} from "./worldInfoEditModel";

export {
  createNewWorldInfoEntryDraft,
  createWorldInfoEditDraft,
  validateWorldInfoEditDraft,
} from "./worldInfoEditModel";
export type {
  WorldInfoEditDialect,
  WorldInfoEditDraft,
  WorldInfoEditValidationErrors,
  WorldInfoEntryDraft,
} from "./worldInfoEditModel";

export interface UpdateWorldInfoOptions {
  database?: MySillyDatabaseConnection;
  now?: () => string;
}

export interface UpdatedWorldInfoResult {
  stored: StoredWorldInfo;
  syncedCharacterId?: string;
}

const embeddedBookSuffix = "__character_book";

export function applyWorldInfoEditDraft(
  stored: StoredWorldInfo,
  draft: WorldInfoEditDraft,
  now: () => string = () => new Date().toISOString(),
): StoredWorldInfo {
  const errors = validateWorldInfoEditDraft(draft);

  if (errors.name) throw new Error(errors.name);

  const firstEntryError = Object.values(errors.entries)[0];
  if (firstEntryError?.probability) {
    throw new Error(firstEntryError.probability);
  }

  const storedDialect: WorldInfoEditDialect = isPortableCharacterBook(
    stored.payload,
  )
    ? "portable"
    : "native";

  if (draft.dialect !== storedDialect) {
    throw new Error("世界书方言与原始记录不一致，已停止保存。");
  }

  const payload = structuredClone(stored.payload);
  const orderChanged = hasEntryOrderChanged(stored, draft);
  const nextName = draft.name === stored.name ? stored.name : draft.name.trim();

  if (draft.dialect === "portable" && isPortableCharacterBook(payload)) {
    const originalEntries = stored.payload.entries as PortableWorldInfoEntry[];
    const originalByKey = new Map(
      originalEntries.map((entry, index) => [String(index), entry]),
    );

    payload.entries = draft.entries.map((entry, index) => {
      const original = entry.sourceKey
        ? originalByKey.get(entry.sourceKey)
        : undefined;
      const updated = original
        ? applyPortableEntryDraft(original, entry)
        : createPortableEntry(entry, index, originalEntries);

      if (orderChanged) updated.insertion_order = (index + 1) * 100;
      return updated;
    });

    if (draft.name !== stored.name) payload.name = nextName;
  } else {
    const nativePayload = payload as NativeWorldInfoBook;
    const originalEntries = (stored.payload as NativeWorldInfoBook).entries;
    const nextEntries: Record<string, NativeWorldInfoEntry> = {};
    let nextUid = getNextNativeUid(originalEntries);

    for (const [index, entry] of draft.entries.entries()) {
      const original = entry.sourceKey
        ? originalEntries[entry.sourceKey]
        : undefined;
      const sourceKey = original ? entry.sourceKey! : String(nextUid);
      const updated = original
        ? applyNativeEntryDraft(original, entry)
        : createNativeEntry(entry, nextUid++);

      if (orderChanged) updated.order = (index + 1) * 100;
      nextEntries[sourceKey] = updated;
    }

    nativePayload.entries = nextEntries;

    if (
      draft.name !== stored.name &&
      typeof (nativePayload as Record<string, unknown>).name === "string"
    ) {
      (nativePayload as Record<string, unknown>).name = nextName;
    }
  }

  return {
    ...stored,
    name: nextName,
    updatedAt: now(),
    payload,
  };
}

export async function updateWorldInfoFromDraft(
  worldId: string,
  draft: WorldInfoEditDraft,
  options: UpdateWorldInfoOptions = {},
): Promise<UpdatedWorldInfoResult> {
  const database = options.database ?? (await getMySillyDatabase());
  const transaction = database.transaction(
    ["worlds", "characters"],
    "readwrite",
  );
  const stored = await transaction.objectStore("worlds").get(worldId);
  if (!stored || (draft.baseVersion !== undefined && draft.baseVersion !== JSON.stringify(stored))) {
    await transaction.done;
    throw new Error("世界书已被修改或删除，请保留当前内容并重新打开编辑器。");
  }
  const timestamp = options.now?.() ?? new Date().toISOString();
  const updated = applyWorldInfoEditDraft(stored, draft, () => timestamp);
  const characterId = getEmbeddedCharacterId(worldId);
  let syncedCharacterId: string | undefined;

  await transaction.objectStore("worlds").put(updated);

  if (characterId) {
    const characterStore = transaction.objectStore("characters");
    const character = await characterStore.get(characterId);

    if (character?.payload.data.character_book) {
      const payload = structuredClone(character.payload);
      const portableBook = isPortableCharacterBook(updated.payload)
        ? structuredClone(updated.payload)
        : nativeWorldInfoToPortableBook(updated.payload);

      payload.data.character_book = portableBook;
      await characterStore.put({ ...character, updatedAt: timestamp, payload });
      syncedCharacterId = characterId;
    }
  }

  await transaction.done;
  return { stored: updated, syncedCharacterId };
}

function hasEntryOrderChanged(
  stored: StoredWorldInfo,
  draft: WorldInfoEditDraft,
): boolean {
  const originalIds = isPortableCharacterBook(stored.payload)
    ? stored.payload.entries.map((_, index) => `portable:${index}`)
    : Object.keys(stored.payload.entries).map((key) => `native:${key}`);
  const currentIds = draft.entries
    .filter((entry) => !entry.isNew)
    .map((entry) => entry.draftId);
  const currentIdSet = new Set(currentIds);
  const survivingOriginalIds = originalIds.filter((id) => currentIdSet.has(id));

  return !areWorldInfoStringArraysEqual(survivingOriginalIds, currentIds);
}

function getNextNativeUid(entries: Record<string, NativeWorldInfoEntry>): number {
  return (
    Math.max(
      -1,
      ...Object.entries(entries).map(([key, entry]) =>
        Math.max(Number(key) || 0, entry.uid ?? 0),
      ),
    ) + 1
  );
}

function getEmbeddedCharacterId(worldId: string): string | undefined {
  return worldId.endsWith(embeddedBookSuffix)
    ? worldId.slice(0, -embeddedBookSuffix.length)
    : undefined;
}
