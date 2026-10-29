import {
  getMySillyDatabase,
  type MySillyDatabaseConnection,
  type StoredCharacter,
} from "../lib/db";
import { assertValidPngStructure } from "../lib/png";
import type { CharacterCardDataV2, CharacterCardDataV3 } from "../types/character";

export interface CharacterEditDraft {
  baseVersion?: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  messageExample: string;
  creatorNotes: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  alternateGreetings: string[];
  tags: string[];
  creator: string;
  characterVersion: string;
  nickname: string;
  groupOnlyGreetings: string[];
}

export interface CharacterEditValidationErrors {
  name?: string;
}

export interface UpdateCharacterOptions {
  database?: MySillyDatabaseConnection;
  now?: () => string;
  avatarReplacement?: CharacterAvatarReplacement;
}

export interface CharacterAvatarReplacement {
  bytes: Uint8Array;
  fileName: string;
}

export const maxCharacterAvatarPngBytes = 15 * 1024 * 1024;
export const maxCharacterAvatarDimension = 8192;
export const maxCharacterAvatarPixels = 40_000_000;

export function createCharacterEditDraft(
  stored: StoredCharacter,
): CharacterEditDraft {
  const data = stored.payload.data;
  const v3Data: CharacterCardDataV3 | undefined =
    stored.payload.spec === "chara_card_v3"
      ? stored.payload.data
      : undefined;

  return {
    baseVersion: characterEditVersion(stored),
    name: data.name,
    description: data.description ?? "",
    personality: data.personality ?? "",
    scenario: data.scenario ?? "",
    firstMessage: data.first_mes ?? "",
    messageExample: data.mes_example ?? "",
    creatorNotes: data.creator_notes ?? "",
    systemPrompt: data.system_prompt ?? "",
    postHistoryInstructions: data.post_history_instructions ?? "",
    alternateGreetings: [...(data.alternate_greetings ?? [])],
    tags: [...(data.tags ?? [])],
    creator: data.creator ?? "",
    characterVersion: data.character_version ?? "",
    nickname: v3Data?.nickname ?? "",
    groupOnlyGreetings: [...(v3Data?.group_only_greetings ?? [])],
  };
}

export function validateCharacterEditDraft(
  draft: CharacterEditDraft,
): CharacterEditValidationErrors {
  const errors: CharacterEditValidationErrors = {};

  if (!draft.name.trim()) {
    errors.name = "角色名称不能为空。";
  }

  return errors;
}

export function applyCharacterEditDraft(
  stored: StoredCharacter,
  draft: CharacterEditDraft,
  now: () => string = () => new Date().toISOString(),
): StoredCharacter {
  const errors = validateCharacterEditDraft(draft);

  if (errors.name) {
    throw new Error(errors.name);
  }

  const payload = structuredClone(stored.payload);
  const data: CharacterCardDataV2 | CharacterCardDataV3 = payload.data;
  const originalData = stored.payload.data;
  const nextName =
    draft.name === originalData.name ? originalData.name : draft.name.trim();

  data.name = nextName;
  assignChangedText(
    data,
    "description",
    draft.description,
    originalData.description,
  );
  assignChangedText(
    data,
    "personality",
    draft.personality,
    originalData.personality,
  );
  assignChangedText(data, "scenario", draft.scenario, originalData.scenario);
  assignChangedText(data, "first_mes", draft.firstMessage, originalData.first_mes);
  assignChangedText(
    data,
    "mes_example",
    draft.messageExample,
    originalData.mes_example,
  );
  assignChangedText(
    data,
    "creator_notes",
    draft.creatorNotes,
    originalData.creator_notes,
  );
  assignChangedText(
    data,
    "system_prompt",
    draft.systemPrompt,
    originalData.system_prompt,
  );
  assignChangedText(
    data,
    "post_history_instructions",
    draft.postHistoryInstructions,
    originalData.post_history_instructions,
  );
  assignChangedText(data, "creator", draft.creator, originalData.creator);
  assignChangedText(
    data,
    "character_version",
    draft.characterVersion,
    originalData.character_version,
  );

  if (
    !areListsEqual(
      draft.alternateGreetings,
      originalData.alternate_greetings ?? [],
    )
  ) {
    data.alternate_greetings = normalizeGreetings(draft.alternateGreetings);
  }

  if (!areListsEqual(draft.tags, originalData.tags ?? [])) {
    data.tags = normalizeTags(draft.tags);
  }

  if (payload.spec === "chara_card_v3") {
    const originalV3Data: CharacterCardDataV3 =
      stored.payload.spec === "chara_card_v3"
        ? stored.payload.data
        : payload.data;

    assignChangedText(
      payload.data,
      "nickname",
      draft.nickname,
      originalV3Data.nickname,
    );

    if (
      !areListsEqual(
        draft.groupOnlyGreetings,
        originalV3Data.group_only_greetings ?? [],
      )
    ) {
      payload.data.group_only_greetings = normalizeGreetings(
        draft.groupOnlyGreetings,
      );
    }
  }

  return {
    ...stored,
    name: nextName,
    updatedAt: now(),
    payload,
    sourcePngBytes: stored.sourcePngBytes
      ? new Uint8Array(stored.sourcePngBytes)
      : undefined,
  };
}

export async function updateCharacterFromDraft(
  characterId: string,
  draft: CharacterEditDraft,
  options: UpdateCharacterOptions = {},
): Promise<StoredCharacter> {
  const database = options.database ?? (await getMySillyDatabase());
  if (options.avatarReplacement) validateCharacterAvatarPng(options.avatarReplacement.bytes);
  const transaction = database.transaction("characters", "readwrite");
  const stored = await transaction.store.get(characterId);

  if (!stored) {
    await transaction.done;
    throw new Error(`Character card not found: ${characterId}`);
  }
  if (draft.baseVersion !== undefined && draft.baseVersion !== characterEditVersion(stored)) {
    await transaction.done;
    throw new Error("角色卡已被修改，请保留当前内容并重新打开编辑器。");
  }

  const updated = applyCharacterEditDraft(stored, draft, options.now);

  if (options.avatarReplacement) {
    validateCharacterAvatarPng(options.avatarReplacement.bytes);
    updated.sourcePngBytes = new Uint8Array(options.avatarReplacement.bytes);
    updated.sourceFileName = options.avatarReplacement.fileName;
  }

  await transaction.store.put(updated);
  await transaction.done;

  return updated;
}

function characterEditVersion(stored: StoredCharacter): string {
  return JSON.stringify([stored.updatedAt, stored.name, stored.payload, stored.sourceFileName]);
}

export function validateCharacterAvatarPng(bytes: Uint8Array): void {
  if (bytes.byteLength > maxCharacterAvatarPngBytes) {
    throw new Error("头像 PNG 不能超过 15 MB。");
  }

  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  if (
    bytes.length < 24 ||
    !signature.every((byte, index) => bytes[index] === byte) ||
    readUint32(bytes, 8) !== 13 ||
    String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR"
  ) {
    throw new Error("请选择有效的 PNG 图片。");
  }

  try {
    assertValidPngStructure(bytes);
  } catch {
    throw new Error("PNG 文件结构不完整或已损坏。");
  }

  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);

  if (
    width === 0 ||
    height === 0 ||
    width > maxCharacterAvatarDimension ||
    height > maxCharacterAvatarDimension ||
    width * height > maxCharacterAvatarPixels
  ) {
    throw new Error("头像尺寸无效或过大，最长边不能超过 8192 像素。");
  }
}

function normalizeTags(values: string[]): string[] {
  const seen = new Set<string>();

  return values.flatMap((value) => {
    const normalized = value.trim();

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function normalizeGreetings(values: string[]): string[] {
  return values.filter((value) => value.trim().length > 0);
}

function assignChangedText(
  data: CharacterCardDataV2 | CharacterCardDataV3,
  field:
    | "description"
    | "personality"
    | "scenario"
    | "first_mes"
    | "mes_example"
    | "creator_notes"
    | "system_prompt"
    | "post_history_instructions"
    | "creator"
    | "character_version"
    | "nickname",
  nextValue: string,
  originalValue: string | undefined,
): void {
  if (nextValue !== (originalValue ?? "")) {
    data[field] = nextValue;
  }
}

function areListsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3])
  );
}
