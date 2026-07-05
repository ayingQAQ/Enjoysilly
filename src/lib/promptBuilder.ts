import type { ChatMessageLine } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type {
  ChatCompletionPreset,
  PresetPrompt,
  PromptOrderItem,
  PromptRole,
} from "../types/preset";
import { replaceMacros, type MacroReplacementContext } from "./macros";
import {
  scanWorldInfo,
  type WorldInfoScanInputEntry,
  type WorldInfoScanOptions,
  type WorldInfoScanResult,
} from "./worldInfoScan";

export interface ChatCompletionMessage {
  role: PromptRole;
  content: string;
}

export interface PromptBuilderInput {
  preset: ChatCompletionPreset;
  character: CharacterCard;
  userName?: string;
  personaDescription?: string;
  worldInfoBefore?: string;
  worldInfoAfter?: string;
  worldInfoEntries?: WorldInfoScanInputEntry[];
  worldInfoScanMessages?: Array<string | ChatMessageLine>;
  worldInfoScanOptions?: WorldInfoScanOptions;
  chatHistory?: string;
  promptOrderCharacterId?: number;
  macroContext?: Omit<
    MacroReplacementContext,
    "characterName" | "nickname" | "userName"
  >;
}

const defaultPromptOrderCharacterId = 100001;

interface PromptBuilderContext {
  input: PromptBuilderInput;
  worldInfoScanResult?: WorldInfoScanResult;
}

export function buildChatCompletionMessages(
  input: PromptBuilderInput,
): ChatCompletionMessage[] {
  const context = createPromptBuilderContext(input);
  const promptMap = new Map(
    input.preset.prompts.map((prompt) => [prompt.identifier, prompt]),
  );
  const orderedPrompts = selectOrderedPrompts(input, promptMap);

  return orderedPrompts.flatMap((prompt) => {
    const content = createPromptContent(prompt, context);
    const normalizedContent = replacePromptMacros(content, context.input).trim();

    if (normalizedContent.length === 0) {
      return [];
    }

    return [
      {
        role: normalizePromptRole(prompt.role),
        content: normalizedContent,
      },
    ];
  });
}

function createPromptBuilderContext(
  input: PromptBuilderInput,
): PromptBuilderContext {
  return {
    input,
    worldInfoScanResult: createWorldInfoScanResult(input),
  };
}

function createWorldInfoScanResult(
  input: PromptBuilderInput,
): WorldInfoScanResult | undefined {
  if (!input.worldInfoEntries || !input.worldInfoScanMessages) {
    return undefined;
  }

  return scanWorldInfo(
    input.worldInfoEntries,
    input.worldInfoScanMessages,
    input.worldInfoScanOptions,
  );
}

function selectOrderedPrompts(
  input: PromptBuilderInput,
  promptMap: Map<string, PresetPrompt>,
): PresetPrompt[] {
  const slot = selectPromptOrderSlot(input);

  if (!slot) {
    return input.preset.prompts.filter(isPresetPromptEnabled);
  }

  return slot.order
    .filter(isPromptOrderItemEnabled)
    .map((orderItem) => promptMap.get(orderItem.identifier))
    .filter((prompt): prompt is PresetPrompt => Boolean(prompt))
    .filter(isPresetPromptEnabled);
}

function selectPromptOrderSlot(input: PromptBuilderInput) {
  const targetCharacterId =
    input.promptOrderCharacterId ?? defaultPromptOrderCharacterId;
  const targetSlot = input.preset.prompt_order.find(
    (slot) => slot.character_id === targetCharacterId,
  );

  if (targetSlot) {
    return targetSlot;
  }

  return input.preset.prompt_order.find((slot) => slot.order.length > 0);
}

function createPromptContent(
  prompt: PresetPrompt,
  context: PromptBuilderContext,
): string {
  if (prompt.marker === true) {
    return createMarkerContent(prompt.identifier, context);
  }

  return prompt.content ?? "";
}

function createMarkerContent(
  identifier: string,
  context: PromptBuilderContext,
): string {
  const { input } = context;
  const character = input.character.data;

  switch (identifier) {
    case "charDescription":
      return character.description ?? "";
    case "charPersonality":
      return character.personality ?? "";
    case "scenario":
      return character.scenario ?? "";
    case "dialogueExamples":
      return character.mes_example ?? "";
    case "jailbreak":
      return character.post_history_instructions ?? "";
    case "personaDescription":
      return input.personaDescription ?? "";
    case "worldInfoBefore":
      return input.worldInfoBefore ?? formatScannedWorldInfo(context, "before");
    case "worldInfoAfter":
      return input.worldInfoAfter ?? formatScannedWorldInfo(context, "after");
    case "chatHistory":
      return input.chatHistory ?? "";
    default:
      return "";
  }
}

function formatScannedWorldInfo(
  context: PromptBuilderContext,
  bucket: keyof Pick<WorldInfoScanResult, "before" | "after">,
): string {
  return (
    context.worldInfoScanResult?.[bucket]
      .map((entry) => entry.content)
      .filter((content) => content.trim().length > 0)
      .join("\n\n") ?? ""
  );
}

function replacePromptMacros(
  content: string,
  input: PromptBuilderInput,
): string {
  return replaceMacros(content, {
    ...input.macroContext,
    characterName: input.character.data.name,
    nickname: getCharacterNickname(input.character),
    userName: input.userName,
  });
}

function getCharacterNickname(character: CharacterCard): string | undefined {
  const nickname = character.data.nickname;

  return typeof nickname === "string" ? nickname : undefined;
}

function normalizePromptRole(role: PresetPrompt["role"]): PromptRole {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }

  return "system";
}

function isPresetPromptEnabled(prompt: PresetPrompt): boolean {
  return prompt.enabled !== false;
}

function isPromptOrderItemEnabled(orderItem: PromptOrderItem): boolean {
  return orderItem.enabled !== false;
}
