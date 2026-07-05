import type { ChatMessageLine } from "../types/chat";
import type { UnknownRecord } from "../types/common";
import { getChatMessageDisplayText } from "./chatHistory";

export interface StartChatTurnInput {
  messages: ChatMessageLine[];
  userName: string;
  userText: string;
  assistantName: string;
  now?: Date;
  userExtra?: UnknownRecord;
  assistantExtra?: UnknownRecord;
}

export interface ChatTurnState {
  messages: ChatMessageLine[];
  userMessage: ChatMessageLine;
  assistantMessage: ChatMessageLine;
  userMessageIndex: number;
  assistantMessageIndex: number;
}

export interface UpdateAssistantMessageInput {
  messages: ChatMessageLine[];
  assistantMessageIndex: number;
}

export interface AppendAssistantDeltaInput extends UpdateAssistantMessageInput {
  delta: string;
}

export interface FinalizeAssistantMessageInput
  extends UpdateAssistantMessageInput {
  content: string;
  extra?: UnknownRecord;
}

export class ChatTurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatTurnError";
  }
}

export function startChatTurn(input: StartChatTurnInput): ChatTurnState {
  const timestamp = formatSillyTavernChatDate(input.now);
  const userMessage = createChatMessage({
    name: input.userName,
    content: input.userText,
    timestamp,
    isUser: true,
    extra: input.userExtra,
  });
  const assistantMessage = createChatMessage({
    name: input.assistantName,
    content: "",
    timestamp,
    isUser: false,
    extra: input.assistantExtra,
  });
  const messages = [...input.messages, userMessage, assistantMessage];

  return {
    messages,
    userMessage,
    assistantMessage,
    userMessageIndex: messages.length - 2,
    assistantMessageIndex: messages.length - 1,
  };
}

export function appendAssistantResponseDelta(
  input: AppendAssistantDeltaInput,
): ChatMessageLine[] {
  const message = getAssistantMessageAt(
    input.messages,
    input.assistantMessageIndex,
  );

  return replaceMessageAt(
    input.messages,
    input.assistantMessageIndex,
    updateMessageContent(message, getChatMessageDisplayText(message) + input.delta),
  );
}

export function finalizeAssistantResponse(
  input: FinalizeAssistantMessageInput,
): ChatMessageLine[] {
  const message = getAssistantMessageAt(
    input.messages,
    input.assistantMessageIndex,
  );
  const updatedMessage = updateMessageContent(message, input.content);

  return replaceMessageAt(
    input.messages,
    input.assistantMessageIndex,
    mergeMessageExtra(updatedMessage, input.extra),
  );
}

export function formatSillyTavernChatDate(date = new Date()): string {
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "@",
    pad(date.getHours()),
    "h",
    pad(date.getMinutes()),
    "m",
    pad(date.getSeconds()),
    "s",
  ].join("");
}

function createChatMessage(input: {
  name: string;
  content: string;
  timestamp: string;
  isUser: boolean;
  extra?: UnknownRecord;
}): ChatMessageLine {
  return {
    name: input.name,
    is_user: input.isUser,
    send_date: input.timestamp,
    mes: input.content,
    swipe_id: 0,
    swipes: [input.content],
    ...(input.extra ? { extra: input.extra } : {}),
  };
}

function getAssistantMessageAt(
  messages: ChatMessageLine[],
  index: number,
): ChatMessageLine {
  const message = messages[index];

  if (!message) {
    throw new ChatTurnError(`Assistant message index ${index} does not exist.`);
  }

  if (message.is_user === true || message.is_system === true) {
    throw new ChatTurnError(
      `Message at index ${index} is not an assistant message.`,
    );
  }

  return message;
}

function updateMessageContent(
  message: ChatMessageLine,
  content: string,
): ChatMessageLine {
  const swipeIndex = getValidSwipeIndex(message);
  const swipes = Array.isArray(message.swipes) ? [...message.swipes] : [];
  const targetSwipeIndex = swipeIndex ?? 0;

  swipes[targetSwipeIndex] = content;

  return {
    ...message,
    mes: content,
    swipe_id: targetSwipeIndex,
    swipes,
  };
}

function replaceMessageAt(
  messages: ChatMessageLine[],
  index: number,
  message: ChatMessageLine,
): ChatMessageLine[] {
  return messages.map((currentMessage, currentIndex) =>
    currentIndex === index ? message : currentMessage,
  );
}

function mergeMessageExtra(
  message: ChatMessageLine,
  extra: UnknownRecord | undefined,
): ChatMessageLine {
  if (!extra) {
    return message;
  }

  return {
    ...message,
    extra: {
      ...message.extra,
      ...extra,
    },
  };
}

function getValidSwipeIndex(message: ChatMessageLine): number | undefined {
  if (
    typeof message.swipe_id !== "number" ||
    !Number.isInteger(message.swipe_id) ||
    message.swipe_id < 0 ||
    !Array.isArray(message.swipes) ||
    message.swipe_id >= message.swipes.length
  ) {
    return undefined;
  }

  return message.swipe_id;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
