import { getChatMessageDisplayText } from "./chatHistory";
import type { ChatMessageLine } from "../types/chat";

const cjkPattern = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const latinWordPattern = /[A-Za-z0-9_]+(?:['-][A-Za-z0-9_]+)*/g;

export function estimateTextTokens(text: string): number {
  const normalized = text.trim();

  if (normalized.length === 0) {
    return 0;
  }

  const cjkCharacters = normalized.match(cjkPattern)?.length ?? 0;
  const latinWords = normalized.match(latinWordPattern) ?? [];
  const latinCharacters = latinWords.reduce((sum, word) => sum + word.length, 0);
  const remainingCharacters = Math.max(
    0,
    normalized.replace(cjkPattern, "").replace(latinWordPattern, "").trim()
      .length,
  );

  return Math.max(
    1,
    Math.ceil(cjkCharacters + latinCharacters / 4 + remainingCharacters / 2),
  );
}

export function estimateChatMessagesTokens(messages: ChatMessageLine[]): number {
  return messages.reduce((total, message) => {
    const contentTokens = estimateTextTokens(getChatMessageDisplayText(message));
    const metadataTokens = estimateTextTokens(message.name);

    return total + contentTokens + metadataTokens + 4;
  }, 0);
}
