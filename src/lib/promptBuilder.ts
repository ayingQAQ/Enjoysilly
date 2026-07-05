import type { CharacterCard } from "../types/character";
import type {
  ChatCompletionPreset,
  PresetPrompt,
  PromptOrderItem,
  PromptRole,
} from "../types/preset";
import { replaceMacros, type MacroReplacementContext } from "./macros";

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
  chatHistory?: string;
  promptOrderCharacterId?: number;
  macroContext?: Omit<
    MacroReplacementContext,
    "characterName" | "nickname" | "userName"
  >;
}

const defaultPromptOrderCharacterId = 100001;

export function buildChatCompletionMessages(
  input: PromptBuilderInput,
): ChatCompletionMessage[] {
  const promptMap = new Map(
    input.preset.prompts.map((prompt) => [prompt.identifier, prompt]),
  );
  const orderedPrompts = selectOrderedPrompts(input, promptMap);

  return orderedPrompts.flatMap((prompt) => {
    const content = createPromptContent(prompt, input);
    const normalizedContent = replacePromptMacros(content, input).trim();

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
  input: PromptBuilderInput,
): string {
  if (prompt.marker === true) {
    return createMarkerContent(prompt.identifier, input);
  }

  return prompt.content ?? "";
}

function createMarkerContent(
  identifier: string,
  input: PromptBuilderInput,
): string {
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
      return input.worldInfoBefore ?? "";
    case "worldInfoAfter":
      return input.worldInfoAfter ?? "";
    case "chatHistory":
      return input.chatHistory ?? "";
    default:
      return "";
  }
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
