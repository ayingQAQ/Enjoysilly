import type { PreserveUnknownFields, UnknownRecord } from "./common";

export type PromptRole = "system" | "user" | "assistant";

export interface PresetPrompt extends PreserveUnknownFields {
  identifier: string;
  name?: string;
  role?: PromptRole | string;
  content?: string;
  system_prompt?: boolean;
  marker?: boolean;
  injection_depth?: number;
  injection_order?: number;
  injection_position?: number;
  injection_trigger?: string[];
  forbid_overrides?: boolean;
  enabled?: boolean;
}

export interface PromptOrderItem extends PreserveUnknownFields {
  identifier: string;
  enabled: boolean;
}

export interface PromptOrderSlot extends PreserveUnknownFields {
  character_id: number;
  order: PromptOrderItem[];
}

export interface RegexScript extends PreserveUnknownFields {
  id?: string;
  scriptName: string;
  findRegex: string;
  replaceString?: string;
  trimStrings?: string[];
  placement?: number[];
  disabled?: boolean;
  markdownOnly?: boolean;
  promptOnly?: boolean;
  runOnEdit?: boolean;
  substituteRegex?: number;
  minDepth?: number | null;
  maxDepth?: number | null;
}

export interface ChatCompletionPresetExtensions extends PreserveUnknownFields {
  regex_scripts?: RegexScript[];
  SPreset?: unknown;
  extensions?: unknown;
  tavern_helper?: unknown;
}

export interface ChatCompletionPreset extends PreserveUnknownFields {
  temperature?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  top_p?: number;
  top_k?: number;
  top_a?: number;
  min_p?: number;
  repetition_penalty?: number;
  max_context_unlocked?: boolean;
  tool_reasoning_mode?: string;
  openai_max_context?: number;
  openai_max_tokens?: number;
  names_behavior?: number;
  send_if_empty?: string;
  impersonation_prompt?: string;
  new_chat_prompt?: string;
  new_group_chat_prompt?: string;
  new_example_chat_prompt?: string;
  continue_nudge_prompt?: string;
  bias_preset_selected?: string;
  wi_format?: string;
  scenario_format?: string;
  personality_format?: string;
  group_nudge_prompt?: string;
  stream_openai?: boolean;
  prompts: PresetPrompt[];
  prompt_order: PromptOrderSlot[];
  assistant_prefill?: string;
  assistant_impersonation?: string;
  use_sysprompt?: boolean;
  squash_system_messages?: boolean;
  media_inlining?: boolean;
  inline_image_quality?: string;
  continue_prefill?: string;
  continue_postfix?: string;
  function_calling?: boolean;
  tool_call_recurse_limit?: number;
  show_thoughts?: boolean;
  reasoning_effort?: string;
  verbosity?: string;
  enable_web_search?: boolean;
  seed?: number;
  n?: number;
  request_images?: boolean;
  request_image_aspect_ratio?: string;
  request_image_resolution?: string;
  extensions?: ChatCompletionPresetExtensions & UnknownRecord;
}
