import { formatSillyTavernChatDate } from "../../lib/chatTurn";
import { replaceMacros } from "../../lib/macros";
import type { RegexScriptLike } from "../../lib/regexEngine";
import type { WorldInfoScanInputEntry } from "../../lib/worldInfoScan";
import type { StoredQuickReplySet, StoredWorldInfo } from "../../lib/db";
import type { CharacterCard } from "../../types/character";
import type { ChatMessageLine } from "../../types/chat";
import type { ChatCompletionPreset } from "../../types/preset";
import type { NativeWorldInfoBook, PortableCharacterBook } from "../../types/worldinfo";
import {
  defaultCharacterDescription,
  defaultCharacterName,
  defaultPersonaDescription,
  defaultUserName,
  localCharacterOptionId,
} from "./chatConstants";
import { normalizeName } from "./chatBasics";

export function createLocalChatCharacter(input: {
  name?: string;
  description?: string;
}): CharacterCard {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: normalizeName(input.name, defaultCharacterName),
      description: input.description?.trim() || defaultCharacterDescription,
      first_mes: "",
      extensions: {},
    },
  };
}

export function createMinimalChatPreset(): ChatCompletionPreset {
  return {
    temperature: 0.7,
    top_p: 1,
    openai_max_tokens: 800,
    stream_openai: true,
    prompts: [
      {
        identifier: "main",
        name: "主系统提示",
        role: "system",
        content:
          "你正在扮演 {{char}}，与 {{user}} 进行自然对话。回复应清晰、具体，并遵守角色描述。",
        enabled: true,
      },
      {
        identifier: "personaDescription",
        name: "用户 persona",
        role: "system",
        marker: true,
        enabled: true,
      },
      {
        identifier: "charDescription",
        name: "角色描述",
        role: "system",
        marker: true,
        enabled: true,
      },
      {
        identifier: "chatHistory",
        name: "聊天记录",
        role: "user",
        marker: true,
        enabled: true,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "main", enabled: true },
          { identifier: "personaDescription", enabled: true },
          { identifier: "charDescription", enabled: true },
          { identifier: "chatHistory", enabled: true },
        ],
      },
    ],
  };
}

export function selectChatCharacterPayload(
  importedCharacter: CharacterCard | undefined,
  fallbackCharacter: CharacterCard,
): CharacterCard {
  return importedCharacter ?? fallbackCharacter;
}

export function selectChatPresetPayload(
  importedPreset: ChatCompletionPreset | undefined,
  fallbackPreset: ChatCompletionPreset,
): ChatCompletionPreset {
  return importedPreset ?? fallbackPreset;
}

export function extractCharacterRegexScripts(
  character: CharacterCard,
): RegexScriptLike[] {
  const characterRecord = character as Record<string, unknown>;
  const dataRecord = character.data as Record<string, unknown>;
  const extensionsRecord = toRecord(character.data.extensions);
  const nestedExtensionsRecord = toRecord(extensionsRecord?.extensions);
  const records = [
    ...readRegexScriptArray(extensionsRecord?.regex_scripts),
    ...readRegexScriptArray(nestedExtensionsRecord?.regex_scripts),
    ...readRegexScriptArray(dataRecord.regex_scripts),
    ...readRegexScriptArray(characterRecord.regex_scripts),
  ];

  return records
    .map((record, index) => normalizeCharacterRegexScript(record, index))
    .filter((script): script is RegexScriptLike => script !== null);
}

export function getChatArchiveFilterCharacterId(
  selectedCharacterId: string,
): string | undefined {
  return selectedCharacterId === localCharacterOptionId
    ? undefined
    : selectedCharacterId;
}

export function createCharacterGreetingOptions(
  character: CharacterCard,
  options: { preferGroupOnly?: boolean } = {},
): string[] {
  const data = character.data;
  const groupOnlyGreetings =
    "group_only_greetings" in data && Array.isArray(data.group_only_greetings)
      ? data.group_only_greetings
      : [];
  const defaultGreetings = [data.first_mes, ...(data.alternate_greetings ?? [])];
  const source =
    options.preferGroupOnly && groupOnlyGreetings.length > 0
      ? groupOnlyGreetings
      : defaultGreetings;

  return source
    .map((greeting) => greeting?.trim() ?? "")
    .filter((greeting) => greeting.length > 0);
}

export function createGreetingChatMessage(input: {
  character: CharacterCard;
  greetingIndex?: number;
  preferGroupOnly?: boolean;
  now?: Date;
  userName: string;
}): ChatMessageLine | null {
  const greetings = createCharacterGreetingOptions(input.character, {
    preferGroupOnly: input.preferGroupOnly,
  });

  if (greetings.length === 0) {
    return null;
  }

  const characterName = normalizeName(
    input.character.data.name,
    defaultCharacterName,
  );
  const selectedIndex = normalizeGreetingIndex(input.greetingIndex, greetings);
  const swipes = greetings.map((greeting) =>
    replaceMacros(greeting, {
      characterName,
      nickname: getCharacterNickname(input.character),
      userName: normalizeName(input.userName, defaultUserName),
      now: input.now,
    }),
  );

  return {
    name: characterName,
    is_user: false,
    send_date: formatSillyTavernChatDate(input.now),
    mes: swipes[selectedIndex] ?? swipes[0] ?? "",
    swipe_id: selectedIndex,
    swipes,
  };
}


function getCharacterNickname(character: CharacterCard): string | undefined {
  const nickname = character.data.nickname;

  return typeof nickname === "string" ? nickname : undefined;
}

export function extractWorldInfoEntries(
  worldPayload: NativeWorldInfoBook | PortableCharacterBook,
): WorldInfoScanInputEntry[] {
  if (Array.isArray(worldPayload.entries)) {
    return worldPayload.entries;
  }

  return Object.values(worldPayload.entries);
}

export function resolveDefaultWorldInfoEntries(
  defaultWorldId: string | undefined,
  worldInfo: StoredWorldInfo | null,
): WorldInfoScanInputEntry[] | undefined {
  if (!defaultWorldId || !worldInfo) return undefined;

  const entries = extractWorldInfoEntries(worldInfo.payload);

  return entries.length > 0 ? entries : undefined;
}

export function selectVisibleQuickReplySets(
  allSets: StoredQuickReplySet[],
  defaultQuickReplySetId: string | undefined,
): StoredQuickReplySet[] {
  if (!defaultQuickReplySetId) return allSets;

  const defaultSet = allSets.find((set) => set.id === defaultQuickReplySetId);

  return defaultSet ? [defaultSet] : allSets;
}


function normalizeGreetingIndex(
  greetingIndex: number | undefined,
  greetings: string[],
): number {
  if (
    typeof greetingIndex !== "number" ||
    !Number.isInteger(greetingIndex) ||
    greetingIndex < 0 ||
    greetingIndex >= greetings.length
  ) {
    return 0;
  }

  return greetingIndex;
}

function readRegexScriptArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null,
  );
}

function normalizeCharacterRegexScript(
  record: Record<string, unknown>,
  index: number,
): RegexScriptLike | null {
  const findRegex = firstString(record.findRegex, record.regex);
  const replaceString = firstString(record.replaceString, record.replacement);

  if (!findRegex && !replaceString && typeof record.scriptName !== "string") {
    return null;
  }

  return {
    ...record,
    id: typeof record.id === "string" ? record.id : undefined,
    scriptName:
      firstString(record.scriptName, record.name) ?? `character regex #${index + 1}`,
    findRegex: findRegex ?? "",
    replaceString: replaceString ?? "",
    trimStrings: Array.isArray(record.trimStrings)
      ? record.trimStrings.filter((item): item is string => typeof item === "string")
      : undefined,
    placement: Array.isArray(record.placement)
      ? record.placement.filter((item): item is number => typeof item === "number")
      : undefined,
    disabled:
      record.disabled === true ||
      record.enabled === false ||
      record.isEnabled === false,
    markdownOnly: record.markdownOnly === true,
    promptOnly: record.promptOnly === true,
    runOnEdit: record.runOnEdit === true,
    substituteRegex:
      typeof record.substituteRegex === "number" ? record.substituteRegex : undefined,
    minDepth:
      typeof record.minDepth === "number" || record.minDepth === null
        ? record.minDepth
        : undefined,
    maxDepth:
      typeof record.maxDepth === "number" || record.maxDepth === null
        ? record.maxDepth
        : undefined,
  };
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}
