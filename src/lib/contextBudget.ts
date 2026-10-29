import type { ChatCompletionPreset } from "../types/preset";
import type { ChatCompletionMessage } from "./promptBuilder";
import { estimateTextTokens } from "./tokenEstimate";

export interface ContextBudgetReport {
  contextLimit: number; outputReserve: number; inputLimit: number;
  estimatedInputTokens: number; omittedMessages: number;
}
export function contextBudgetLimits(preset: ChatCompletionPreset) {
  const contextLimit = positiveInteger(preset.openai_max_context ?? 8192);
  const outputReserve = positiveInteger(preset.openai_max_tokens ?? 1024);
  if (outputReserve >= contextLimit) throw new Error("上下文预算不足：输出预留必须小于上下文上限，请调整预设。");
  return { contextLimit, outputReserve, inputLimit: contextLimit - outputReserve };
}
function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error("上下文预算参数必须是正整数，请检查预设。");
  return value;
}
export function estimateRequestTokens(messages: ChatCompletionMessage[]): number {
  return 3 + messages.reduce((sum, message) => sum + 4 + estimateTextTokens(message.content), 0);
}
