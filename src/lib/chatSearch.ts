import type { ChatMessageLine } from "../types/chat";
import { getChatMessageDisplayText } from "./chatHistory";

/** Literal, case-insensitive search of current swipes, never regex or rendered HTML. */
export function searchChatMessages(messages: ChatMessageLine[], query: string): number[] {
  const needle = query.trim().toLocaleLowerCase();
  const indexes: number[] = [];
  messages.forEach((message, index) => {
    if (!needle || getChatMessageDisplayText(message).toLocaleLowerCase().includes(needle)) indexes.push(index);
  });
  return indexes;
}
