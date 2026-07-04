import type { ChatCompletionPreset, RegexScript } from "../types/preset";

export class PresetImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresetImportError";
  }
}

export function parseChatCompletionPresetJson(json: string): ChatCompletionPreset {
  const value = JSON.parse(json) as unknown;

  if (!isChatCompletionPreset(value)) {
    throw new PresetImportError(
      "JSON is not a supported SillyTavern Chat Completion preset.",
    );
  }

  return value;
}

export function serializeChatCompletionPresetJson(
  preset: ChatCompletionPreset,
  space: number | undefined = 2,
): string {
  return JSON.stringify(preset, null, space);
}

export function encodeChatCompletionPresetJson(
  preset: ChatCompletionPreset,
  space: number | undefined = 2,
): Uint8Array {
  return new TextEncoder().encode(
    serializeChatCompletionPresetJson(preset, space),
  );
}

export function isChatCompletionPreset(
  value: unknown,
): value is ChatCompletionPreset {
  if (!isRecord(value)) {
    return false;
  }

  return Array.isArray(value.prompts) && Array.isArray(value.prompt_order);
}

export function extractRegexScripts(
  preset: ChatCompletionPreset,
): RegexScript[] {
  const scripts = preset.extensions?.regex_scripts;
  return Array.isArray(scripts) ? scripts : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
