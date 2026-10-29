import type { ChatMessageLine } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";
import { contextBudgetLimits, estimateRequestTokens, type ContextBudgetReport } from "./contextBudget";
import { replayTimedWorldInfo } from "./worldInfoTimed";
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
  budget?: ContextBudgetReport;
  messageSources?: PromptMessageSource[];
  chatHistory: string;
  messages: ChatCompletionMessage[];
  requestBody: OpenAICompatibleChatCompletionRequestBody;
  worldInfoScanResult?: WorldInfoScanResult;
}

export async function prepareChatCompletionRequest(
  input: PrepareChatCompletionRequestInput,
): Promise<PreparedChatCompletionRequest> {
  const originalMessages = input.chatMessages ?? [];
  const limits = contextBudgetLimits(input.preset);
  const worldInfoScanResult = createWorldInfoScanResult(input, originalMessages);
  const chatMessages = originalMessages.filter(m => getChatMessageDisplayText(m).trim() && (input.includeSystemMessages || !m.is_system));
  let protectedStart = -1;
  chatMessages.forEach((message, index) => { if (message.is_user) protectedStart = index; });
  if (protectedStart < 0) protectedStart = Math.max(0, chatMessages.length - 1);
  let start = 0;
  const randomValues: number[] = [];
  const random = input.macroContext?.random ?? Math.random;
  const now = input.macroContext?.now ?? new Date();
  while (true) {
    let randomIndex = 0;
    const messageSources: PromptMessageSource[] | undefined = input.diagnostics ? [] : undefined;
    const chatHistory = buildChatHistoryText(chatMessages.slice(start), {
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
      macroContext: { ...input.macroContext, now, random: () => {
        if (randomIndex === randomValues.length) randomValues.push(random());
        return randomValues[randomIndex++];
      } },
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
    // Reserve the same output cap actually sent, including when the preset omits it.
    requestBody.max_tokens = limits.outputReserve;
    const estimatedInputTokens = estimateRequestTokens(requestBody.messages);
    if (estimatedInputTokens > limits.inputLimit) {
      if (start >= protectedStart) throw new Error(`上下文预算超限：必要设定与当前轮约 ${estimatedInputTokens} token，输入预算 ${limits.inputLimit}。请缩短输入/设定或调整预设，原消息未删除。`);
      start = Math.min(protectedStart, start + Math.max(1, Math.ceil((protectedStart - start) / 4)));
      continue;
    }

    return {
      budget: { ...limits, estimatedInputTokens, omittedMessages: start },
      ...(messageSources ? { messageSources } : {}),
      chatHistory,
      messages,
      requestBody,
      worldInfoScanResult,
    };
  }
}

function createWorldInfoScanResult(
  input: PrepareChatCompletionRequestInput,
  chatMessages: ChatMessageLine[],
): WorldInfoScanResult | undefined {
  if (!input.worldInfoEntries) {
    return undefined;
  }

  return replayTimedWorldInfo(
    input.worldInfoEntries,
    chatMessages,
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
