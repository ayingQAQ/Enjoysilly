import type { ChatMessageLine } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";
import {
  createChatCompletionRequestBody,
  type OpenAICompatibleChatCompletionRequestBody,
} from "./api";
import { buildChatHistoryText, getChatMessageDisplayText } from "./chatHistory";
import {
  buildChatCompletionMessages,
  type ChatCompletionMessage,
  type PromptBuilderInput,
} from "./promptBuilder";
import {
  scanWorldInfo,
  type ScannedWorldInfoEntry,
  type WorldInfoScanInputEntry,
  type WorldInfoScanOptions,
  type WorldInfoScanResult,
} from "./worldInfoScan";

export interface PrepareChatCompletionRequestInput {
  model: string;
  preset: ChatCompletionPreset;
  character: CharacterCard;
  chatMessages?: ChatMessageLine[];
  userName?: string;
  personaDescription?: string;
  worldInfoEntries?: WorldInfoScanInputEntry[];
  worldInfoScanOptions?: WorldInfoScanOptions;
  maxHistoryMessages?: number;
  includeSystemMessages?: boolean;
  promptOrderCharacterId?: number;
  macroContext?: PromptBuilderInput["macroContext"];
  stream?: boolean;
  requestExtra?: Record<string, unknown>;
}

export interface PreparedChatCompletionRequest {
  chatHistory: string;
  messages: ChatCompletionMessage[];
  requestBody: OpenAICompatibleChatCompletionRequestBody;
  worldInfoScanResult?: WorldInfoScanResult;
}

export function prepareChatCompletionRequest(
  input: PrepareChatCompletionRequestInput,
): PreparedChatCompletionRequest {
  const chatMessages = input.chatMessages ?? [];
  const worldInfoScanResult = createWorldInfoScanResult(input, chatMessages);
  const chatHistory = buildChatHistoryText(chatMessages, {
    maxMessages: input.maxHistoryMessages,
    includeSystemMessages: input.includeSystemMessages,
    atDepthEntries: worldInfoScanResult?.atDepth,
  });
  const messages = buildChatCompletionMessages({
    preset: input.preset,
    character: input.character,
    userName: input.userName,
    personaDescription: input.personaDescription,
    chatHistory,
    worldInfoBefore: formatScannedWorldInfo(worldInfoScanResult?.before),
    worldInfoAfter: formatScannedWorldInfo(worldInfoScanResult?.after),
    promptOrderCharacterId: input.promptOrderCharacterId,
    macroContext: input.macroContext,
  });
  const requestBody = createChatCompletionRequestBody({
    model: input.model,
    messages,
    preset: input.preset,
    stream: input.stream,
    extra: input.requestExtra,
  });

  return {
    chatHistory,
    messages,
    requestBody,
    worldInfoScanResult,
  };
}

function createWorldInfoScanResult(
  input: PrepareChatCompletionRequestInput,
  chatMessages: ChatMessageLine[],
): WorldInfoScanResult | undefined {
  if (!input.worldInfoEntries) {
    return undefined;
  }

  return scanWorldInfo(
    input.worldInfoEntries,
    chatMessages.map(getChatMessageDisplayText),
    input.worldInfoScanOptions,
  );
}

function formatScannedWorldInfo(
  entries: ScannedWorldInfoEntry[] | undefined,
): string | undefined {
  const content = entries
    ?.map((entry) => entry.content.trim())
    .filter((entryContent) => entryContent.length > 0)
    .join("\n\n");

  return content && content.length > 0 ? content : undefined;
}
