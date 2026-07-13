import type { ImportChatToDatabaseOptions } from "../../services/chatImport";
import type { SaveChatSnapshotToDatabaseInput } from "../../services/chatPersistence";
import type { CharacterCard } from "../../types/character";
import type {
  ChatMessageLine,
  ChatMetadataLine,
  SillyTavernChatLog,
} from "../../types/chat";
import {
  defaultCharacterName,
  defaultUserName,
  localCharacterOptionId,
} from "./chatConstants";
import { normalizeName } from "./chatBasics";

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
