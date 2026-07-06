import { getChatMessageDisplayText } from "../lib/chatHistory";
import { replaceMacros } from "../lib/macros";
import { formatSillyTavernChatDate } from "../lib/chatTurn";
import type { SaveChatSnapshotToDatabaseInput } from "../services/chatPersistence";
import type { ImportChatToDatabaseOptions } from "../services/chatImport";
import type {
  ChatMessageLine,
  ChatMetadataLine,
  SillyTavernChatLog,
} from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";

export const localCharacterOptionId = "__local_character__";
export const minimalPresetOptionId = "__minimal_preset__";
export const defaultBaseUrl = "https://api.openai.com/v1";
export const defaultModel = "gpt-4.1-mini";
export const defaultUserName = "User";
export const defaultCharacterName = "my_silly 助手";
export const defaultCharacterDescription =
  "你是 my_silly 的本地调试助手。回复应当清晰、简洁，并保持中文交流。";
export const defaultPersonaDescription =
  "用户正在测试 my_silly 的 OpenAI 兼容实时对话链路。";

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

export function getChatArchiveFilterCharacterId(
  selectedCharacterId: string,
): string | undefined {
  return selectedCharacterId === localCharacterOptionId
    ? undefined
    : selectedCharacterId;
}

export function createCharacterGreetingOptions(character: CharacterCard): string[] {
  const data = character.data;

  return [data.first_mes, ...(data.alternate_greetings ?? [])]
    .map((greeting) => greeting?.trim() ?? "")
    .filter((greeting) => greeting.length > 0);
}

export function createGreetingChatMessage(input: {
  character: CharacterCard;
  greetingIndex?: number;
  now?: Date;
  userName: string;
}): ChatMessageLine | null {
  const greetings = createCharacterGreetingOptions(input.character);

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

export function updateChatMessageTextAt(
  messages: ChatMessageLine[],
  messageIndex: number,
  text: string,
): ChatMessageLine[] {
  return messages.map((message, index) =>
    index === messageIndex ? updateChatMessageText(message, text) : message,
  );
}

export function deleteChatMessageAt(
  messages: ChatMessageLine[],
  messageIndex: number,
): ChatMessageLine[] {
  return messages.filter((_, index) => index !== messageIndex);
}

export function selectChatMessageSwipeAt(
  messages: ChatMessageLine[],
  messageIndex: number,
  direction: -1 | 1,
): ChatMessageLine[] {
  return messages.map((message, index) =>
    index === messageIndex ? selectChatMessageSwipe(message, direction) : message,
  );
}

export function getLastAssistantMessageIndex(
  messages: ChatMessageLine[],
): number | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message && message.is_user !== true && message.is_system !== true) {
      return index;
    }
  }

  return undefined;
}

export function createChatDraftStatus(input: {
  hasUnsavedChanges: boolean;
  loadedArchiveName?: string | null;
  messageCount: number;
}): string {
  if (input.messageCount <= 0) {
    return "空白";
  }

  if (input.hasUnsavedChanges) {
    return "未保存更改";
  }

  if (input.loadedArchiveName) {
    return "已保存";
  }

  return "未保存草稿";
}

export function appendQuickReplyToInput(
  currentText: string,
  quickReplyText: string,
): string {
  if (quickReplyText.length === 0) {
    return currentText;
  }

  if (currentText.length === 0 || /\s$/u.test(currentText)) {
    return `${currentText}${quickReplyText}`;
  }

  return `${currentText}\n${quickReplyText}`;
}

export function createChatSaveSnapshotInput(input: {
  activeCharacter: CharacterCard;
  chatMetadata?: ChatMetadataLine;
  messages: ChatMessageLine[];
  selectedCharacterId: string;
  userName: string;
}): SaveChatSnapshotToDatabaseInput {
  const snapshotInput: SaveChatSnapshotToDatabaseInput = {
    messages: input.messages,
    userName: normalizeName(input.userName, defaultUserName),
    characterName: normalizeName(
      input.activeCharacter.data.name,
      defaultCharacterName,
    ),
    characterId:
      input.selectedCharacterId === localCharacterOptionId
        ? undefined
        : input.selectedCharacterId,
  };

  if (input.chatMetadata) {
    snapshotInput.metadata = cloneChatMetadata(input.chatMetadata);
  }

  return snapshotInput;
}

export function createChatImportDatabaseOptions(
  selectedCharacterId: string,
): Pick<ImportChatToDatabaseOptions, "characterId"> {
  return {
    characterId:
      selectedCharacterId === localCharacterOptionId
        ? undefined
        : selectedCharacterId,
  };
}

export function createImportedChatScreenState(input: {
  chat: SillyTavernChatLog;
  selectedCharacterId: string;
  storedId: string;
  storedName: string;
}): {
  messages: ChatMessageLine[];
  userName: string;
  characterName?: string;
  metadata: ChatMetadataLine;
  loadedArchiveId: string;
  loadedArchiveName: string;
} {
  const metadata = input.chat.metadata;
  const shouldSyncCharacterName =
    input.selectedCharacterId === localCharacterOptionId;

  return {
    messages: cloneChatMessages(input.chat.messages),
    userName: normalizeName(metadata.user_name, defaultUserName),
    characterName: shouldSyncCharacterName
      ? normalizeName(metadata.character_name, defaultCharacterName)
      : undefined,
    metadata: cloneChatMetadata(metadata),
    loadedArchiveId: input.storedId,
    loadedArchiveName: input.storedName,
  };
}

export function normalizeName(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : fallback;
}

export function getMessageSwipeCount(message: ChatMessageLine): number {
  return Array.isArray(message.swipes) ? message.swipes.length : 0;
}

export function normalizeMessageSwipeIndex(message: ChatMessageLine): number {
  return getValidSwipeIndex(message) ?? 0;
}

export function formatChatSendError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}。请检查 API Base URL、模型名、API Key，以及端点是否允许浏览器 CORS 请求。`;
  }

  return `${String(error)}。请检查 API 配置。`;
}

export function formatChatSaveError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}。保存对话失败，请检查浏览器是否允许 IndexedDB。`;
  }

  return `${String(error)}。保存对话失败。`;
}

export function formatChatExportError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}。导出对话失败，请检查浏览器下载权限。`;
  }

  return `${String(error)}。导出对话失败。`;
}

export function formatChatImportError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}。导入对话失败，请确认文件是 SillyTavern JSONL 格式。`;
  }

  return `${String(error)}。导入对话失败。`;
}

export function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function cloneChatMessages(messages: ChatMessageLine[]): ChatMessageLine[] {
  return structuredClone(messages) as ChatMessageLine[];
}

export function cloneChatMetadata(metadata: ChatMetadataLine): ChatMetadataLine {
  return structuredClone(metadata) as ChatMetadataLine;
}

function getCharacterNickname(character: CharacterCard): string | undefined {
  const nickname = character.data.nickname;

  return typeof nickname === "string" ? nickname : undefined;
}

function updateChatMessageText(
  message: ChatMessageLine,
  text: string,
): ChatMessageLine {
  const swipeIndex = getValidSwipeIndex(message);
  const targetSwipeIndex = swipeIndex ?? 0;
  const swipes = Array.isArray(message.swipes) ? [...message.swipes] : [];

  swipes[targetSwipeIndex] = text;

  return {
    ...message,
    mes: text,
    swipe_id: targetSwipeIndex,
    swipes,
  };
}

function selectChatMessageSwipe(
  message: ChatMessageLine,
  direction: -1 | 1,
): ChatMessageLine {
  const swipeCount = getMessageSwipeCount(message);

  if (swipeCount <= 1 || !Array.isArray(message.swipes)) {
    return message;
  }

  const currentIndex = normalizeMessageSwipeIndex(message);
  const nextIndex = (currentIndex + direction + swipeCount) % swipeCount;
  const nextText = message.swipes[nextIndex] ?? message.mes;

  return {
    ...message,
    mes: nextText,
    swipe_id: nextIndex,
  };
}

function getValidSwipeIndex(message: ChatMessageLine): number | undefined {
  if (
    typeof message.swipe_id !== "number" ||
    !Number.isInteger(message.swipe_id) ||
    message.swipe_id < 0 ||
    !Array.isArray(message.swipes) ||
    message.swipe_id >= message.swipes.length
  ) {
    return undefined;
  }

  return message.swipe_id;
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
