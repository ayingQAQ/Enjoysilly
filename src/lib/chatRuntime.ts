import type { ChatMessageLine } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";
import {
  createChatCompletionRequestBody,
  type OpenAICompatibleChatCompletionRequestBody,
} from "./api";
import { buildChatHistoryText, getChatMessageDisplayText } from "./chatHistory";
import { extractRegexScripts } from "./presetIO";
import {
  buildChatCompletionMessages,
  type ChatCompletionMessage,
  type PromptBuilderInput,
  type PromptMessageSource,
} from "./promptBuilder";
import {
  scanWorldInfo,
  type ScannedWorldInfoEntry,
  type WorldInfoScanInputEntry,
  type WorldInfoScanOptions,
  type WorldInfoScanResult,
} from "./worldInfoScan";

export interface PrepareChatCompletionRequestInput {
  diagnostics?: boolean;
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
  groupMembers?: PromptBuilderInput["groupMembers"];
  groupName?: string;
  speakerCharacterId?: string;
  stream?: boolean;
  requestExtra?: Record<string, unknown>;
}

export interface PreparedChatCompletionRequest {
  messageSources?: PromptMessageSource[];
  chatHistory: string;
  messages: ChatCompletionMessage[];
  requestBody: OpenAICompatibleChatCompletionRequestBody;
  worldInfoScanResult?: WorldInfoScanResult;
}

export async function prepareChatCompletionRequest(
  input: PrepareChatCompletionRequestInput,
): Promise<PreparedChatCompletionRequest> {
  const chatMessages = input.chatMessages ?? [];
  const messageSources: PromptMessageSource[] | undefined = input.diagnostics ? [] : undefined;
  const worldInfoScanResult = createWorldInfoScanResult(input, chatMessages);
  const chatHistory = buildChatHistoryText(chatMessages, {
    maxMessages: input.maxHistoryMessages,
    includeSystemMessages: input.includeSystemMessages,
    atDepthEntries: worldInfoScanResult?.atDepth,
  });
  const messages = await buildChatCompletionMessages({
    messageSources,
    preset: input.preset,
    character: input.character,
    userName: input.userName,
    personaDescription: input.personaDescription,
    chatHistory,
    worldInfoBefore: formatScannedWorldInfo(worldInfoScanResult?.before),
    worldInfoAfter: formatScannedWorldInfo(worldInfoScanResult?.after),
    promptOrderCharacterId: input.promptOrderCharacterId,
    macroContext: input.macroContext,
    groupMembers: input.groupMembers,
    groupName: input.groupName,
    speakerCharacterId: input.speakerCharacterId,
    regexScripts: extractRegexScripts(input.preset),
  });
  const requestBody = createChatCompletionRequestBody({
    model: input.model,
    messages,
    preset: input.preset,
    stream: input.stream,
    extra: input.requestExtra,
  });

  return {
    ...(messageSources ? { messageSources } : {}),
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
    { ...input.worldInfoScanOptions, diagnostics: input.diagnostics || input.worldInfoScanOptions?.diagnostics },
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
