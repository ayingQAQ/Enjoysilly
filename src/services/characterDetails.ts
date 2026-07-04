import {
  getCharacter,
  getMySillyDatabase,
  type MySillyDatabaseConnection,
  type StoredCharacter,
} from "../lib/db";
import type { CharacterCardData } from "../types/character";
import type { PortableWorldInfoEntry } from "../types/worldinfo";

export interface CharacterBookDetailSummary {
  name: string;
  entryCount: number;
  enabledEntryCount: number;
  constantEntryCount: number;
  selectiveEntryCount: number;
  sampleKeys: string[];
  sampleComments: string[];
  entryUnknownFieldNames: string[];
}

export interface CharacterDetailSummary {
  id: string;
  name: string;
  spec: StoredCharacter["payload"]["spec"];
  specVersion: string;
  createdAt: string;
  updatedAt: string;
  hasAvatar: boolean;
  tags: string[];
  creator?: string;
  characterVersion?: string;
  alternateGreetingCount: number;
  groupOnlyGreetingCount: number;
  extensionFieldNames: string[];
  rootUnknownFieldNames: string[];
  dataUnknownFieldNames: string[];
  textPreviews: {
    description: string;
    personality: string;
    scenario: string;
    firstMessage: string;
    messageExample: string;
    creatorNotes: string;
    systemPrompt: string;
    postHistoryInstructions: string;
  };
  embeddedBook?: CharacterBookDetailSummary;
  stored: StoredCharacter;
}

const knownCharacterRootFields = new Set(["spec", "spec_version", "data"]);

const knownCharacterDataFields = new Set([
  "name",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions",
  "alternate_greetings",
  "character_book",
  "tags",
  "creator",
  "character_version",
  "extensions",
  "assets",
  "nickname",
  "creator_notes_multilingual",
  "source",
  "group_only_greetings",
  "creation_date",
  "modification_date",
]);

const knownPortableWorldEntryFields = new Set([
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
  "extensions",
]);

export async function loadCharacterDetailSummary(
  characterId: string,
  database?: MySillyDatabaseConnection,
): Promise<CharacterDetailSummary> {
  const db = database ?? (await getMySillyDatabase());
  const stored = await getCharacter(characterId, db);

  if (!stored) {
    throw new Error(`找不到角色卡：${characterId}`);
  }

  return createCharacterDetailSummary(stored);
}

export function createCharacterDetailSummary(
  stored: StoredCharacter,
): CharacterDetailSummary {
  const card = stored.payload;
  const data = card.data;

  return {
    id: stored.id,
    name: stored.name,
    spec: card.spec,
    specVersion: card.spec_version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    hasAvatar: typeof data.avatar === "string" && data.avatar.trim().length > 0,
    tags: Array.isArray(data.tags) ? [...data.tags] : [],
    creator: data.creator,
    characterVersion: data.character_version,
    alternateGreetingCount: Array.isArray(data.alternate_greetings)
      ? data.alternate_greetings.length
      : 0,
    groupOnlyGreetingCount: Array.isArray(data.group_only_greetings)
      ? data.group_only_greetings.length
      : 0,
    extensionFieldNames: getRecordFieldNames(data.extensions),
    rootUnknownFieldNames: Object.keys(card).filter(
      (key) => !knownCharacterRootFields.has(key),
    ),
    dataUnknownFieldNames: Object.keys(data).filter(
      (key) => !knownCharacterDataFields.has(key),
    ),
    textPreviews: {
      description: createPreview(data.description),
      personality: createPreview(data.personality),
      scenario: createPreview(data.scenario),
      firstMessage: createPreview(data.first_mes),
      messageExample: createPreview(data.mes_example),
      creatorNotes: createPreview(data.creator_notes),
      systemPrompt: createPreview(data.system_prompt),
      postHistoryInstructions: createPreview(data.post_history_instructions),
    },
    embeddedBook: data.character_book
      ? createCharacterBookDetailSummary(data.character_book)
      : undefined,
    stored,
  };
}

function createCharacterBookDetailSummary(
  book: NonNullable<CharacterCardData["character_book"]>,
): CharacterBookDetailSummary {
  const entries = book.entries.filter(isRecord);

  return {
    name: firstNonEmptyText(book.name, "内嵌世界书"),
    entryCount: entries.length,
    enabledEntryCount: entries.filter(isPortableWorldEntryEnabled).length,
    constantEntryCount: entries.filter((entry) => entry.constant === true).length,
    selectiveEntryCount: entries.filter((entry) => entry.selective === true).length,
    sampleKeys: entries.flatMap(getPortableEntryKeys).filter(Boolean).slice(0, 8),
    sampleComments: entries
      .map((entry) => firstNonEmptyText(entry.comment, entry.name))
      .filter(Boolean)
      .slice(0, 6),
    entryUnknownFieldNames: uniqueStrings(
      entries.flatMap((entry) =>
        Object.keys(entry).filter((key) => !knownPortableWorldEntryFields.has(key)),
      ),
    ),
  };
}

function isPortableWorldEntryEnabled(
  entry: Partial<PortableWorldInfoEntry>,
): boolean {
  return entry.enabled !== false;
}

function getPortableEntryKeys(entry: Partial<PortableWorldInfoEntry>): string[] {
  return Array.isArray(entry.keys)
    ? entry.keys.filter((key): key is string => typeof key === "string")
    : [];
}

function getRecordFieldNames(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value) : [];
}

function firstNonEmptyText(...values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim().length > 0)?.trim() ?? "";
}

function createPreview(value: string | undefined, maxLength = 180): string {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
