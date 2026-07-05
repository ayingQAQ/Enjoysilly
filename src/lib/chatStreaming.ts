import type { ChatMessageLine } from "../types/chat";
import type { UnknownRecord } from "../types/common";
import {
  requestChatCompletionStream,
  type ChatCompletionStreamEvent,
  type StreamFetchLike,
} from "./api";
import {
  prepareChatCompletionRequest,
  type PreparedChatCompletionRequest,
  type PrepareChatCompletionRequestInput,
} from "./chatRuntime";
import { getChatMessageDisplayText } from "./chatHistory";
import {
  appendAssistantResponseDelta,
  finalizeAssistantResponse,
  startChatTurn,
  type ChatTurnState,
} from "./chatTurn";

export interface RunStreamingChatTurnInput
  extends Omit<
    PrepareChatCompletionRequestInput,
    "chatMessages" | "stream" | "userName"
  > {
  messages: ChatMessageLine[];
  userName: string;
  userText: string;
  assistantName?: string;
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: StreamFetchLike;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  now?: Date;
  userExtra?: UnknownRecord;
  assistantExtra?: UnknownRecord;
}

export interface RunStreamingChatRerollInput
  extends Omit<
    PrepareChatCompletionRequestInput,
    "chatMessages" | "stream" | "userName"
  > {
  assistantMessageIndex: number;
  messages: ChatMessageLine[];
  userName: string;
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: StreamFetchLike;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface RunStreamingChatContinueInput
  extends Omit<
    PrepareChatCompletionRequestInput,
    "chatMessages" | "stream" | "userName"
  > {
  assistantMessageIndex: number;
  messages: ChatMessageLine[];
  userName: string;
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: StreamFetchLike;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type StreamingChatTurnUpdate =
  | StreamingChatTurnStartedUpdate
  | StreamingChatTurnDeltaUpdate
  | StreamingChatTurnFinishedUpdate;

export type StreamingChatRerollUpdate =
  | StreamingChatRerollStartedUpdate
  | StreamingChatRerollDeltaUpdate
  | StreamingChatRerollFinishedUpdate;

export type StreamingChatContinueUpdate =
  | StreamingChatContinueStartedUpdate
  | StreamingChatContinueDeltaUpdate
  | StreamingChatContinueFinishedUpdate;

export interface StreamingChatTurnStartedUpdate {
  kind: "started";
  messages: ChatMessageLine[];
  turn: ChatTurnState;
  prepared: PreparedChatCompletionRequest;
}

export interface StreamingChatTurnDeltaUpdate {
  kind: "delta";
  delta: string;
  content: string;
  messages: ChatMessageLine[];
  event: ChatCompletionStreamEvent;
}

export interface StreamingChatTurnFinishedUpdate {
  kind: "finished";
  content: string;
  finishReason?: string;
  messages: ChatMessageLine[];
}

export interface StreamingChatRerollStartedUpdate {
  kind: "started";
  assistantMessageIndex: number;
  messages: ChatMessageLine[];
  prepared: PreparedChatCompletionRequest;
}

export interface StreamingChatRerollDeltaUpdate {
  kind: "delta";
  assistantMessageIndex: number;
  delta: string;
  content: string;
  messages: ChatMessageLine[];
  event: ChatCompletionStreamEvent;
}

export interface StreamingChatRerollFinishedUpdate {
  kind: "finished";
  assistantMessageIndex: number;
  content: string;
  finishReason?: string;
  messages: ChatMessageLine[];
}

export interface StreamingChatContinueStartedUpdate {
  kind: "started";
  assistantMessageIndex: number;
  baseContent: string;
  messages: ChatMessageLine[];
  prepared: PreparedChatCompletionRequest;
}

export interface StreamingChatContinueDeltaUpdate {
  kind: "delta";
  assistantMessageIndex: number;
  baseContent: string;
  delta: string;
  continuation: string;
  messages: ChatMessageLine[];
  event: ChatCompletionStreamEvent;
}

export interface StreamingChatContinueFinishedUpdate {
  kind: "finished";
  assistantMessageIndex: number;
  baseContent: string;
  continuation: string;
  finishReason?: string;
  messages: ChatMessageLine[];
}

export async function* runStreamingChatTurn(
  input: RunStreamingChatTurnInput,
): AsyncGenerator<StreamingChatTurnUpdate> {
  const turn = startChatTurn({
    messages: input.messages,
    userName: input.userName,
    userText: input.userText,
    assistantName: input.assistantName ?? input.character.data.name,
    now: input.now,
    userExtra: input.userExtra,
    assistantExtra: input.assistantExtra,
  });
  const prepared = prepareChatCompletionRequest({
    ...input,
    chatMessages: turn.messages,
    stream: true,
  });
  let messages = turn.messages;
  let content = "";
  let finishReason: string | undefined;

  yield {
    kind: "started",
    messages,
    turn,
    prepared,
  };

  for await (const event of requestChatCompletionStream({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    body: prepared.requestBody,
    fetchImpl: input.fetchImpl,
    headers: input.headers,
    signal: input.signal,
  })) {
    if (event.finishReason) {
      finishReason = event.finishReason;
    }

    if (event.content.length === 0) {
      continue;
    }

    content += event.content;
    messages = appendAssistantResponseDelta({
      messages,
      assistantMessageIndex: turn.assistantMessageIndex,
      delta: event.content,
    });

    yield {
      kind: "delta",
      delta: event.content,
      content,
      messages,
      event,
    };
  }

  messages = finalizeAssistantResponse({
    messages,
    assistantMessageIndex: turn.assistantMessageIndex,
    content,
    extra: finishReason ? { finish_reason: finishReason } : undefined,
  });

  yield {
    kind: "finished",
    content,
    finishReason,
    messages,
  };
}

export async function* runStreamingChatReroll(
  input: RunStreamingChatRerollInput,
): AsyncGenerator<StreamingChatRerollUpdate> {
  const targetMessage = getRerollTargetMessage(
    input.messages,
    input.assistantMessageIndex,
  );
  const prepared = prepareChatCompletionRequest({
    ...input,
    chatMessages: input.messages.slice(0, input.assistantMessageIndex),
    stream: true,
  });
  const rerollState = createRerollMessageState(
    input.messages,
    input.assistantMessageIndex,
    targetMessage,
  );
  let messages = rerollState.messages;
  let content = "";
  let finishReason: string | undefined;

  yield {
    kind: "started",
    assistantMessageIndex: input.assistantMessageIndex,
    messages,
    prepared,
  };

  for await (const event of requestChatCompletionStream({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    body: prepared.requestBody,
    fetchImpl: input.fetchImpl,
    headers: input.headers,
    signal: input.signal,
  })) {
    if (event.finishReason) {
      finishReason = event.finishReason;
    }

    if (event.content.length === 0) {
      continue;
    }

    content += event.content;
    messages = updateRerollMessageContent(
      messages,
      input.assistantMessageIndex,
      content,
    );

    yield {
      kind: "delta",
      assistantMessageIndex: input.assistantMessageIndex,
      delta: event.content,
      content,
      messages,
      event,
    };
  }

  messages = updateRerollMessageContent(
    messages,
    input.assistantMessageIndex,
    content,
    finishReason ? { finish_reason: finishReason } : undefined,
  );

  yield {
    kind: "finished",
    assistantMessageIndex: input.assistantMessageIndex,
    content,
    finishReason,
    messages,
  };
}

export async function* runStreamingChatContinue(
  input: RunStreamingChatContinueInput,
): AsyncGenerator<StreamingChatContinueUpdate> {
  const targetMessage = getRerollTargetMessage(
    input.messages,
    input.assistantMessageIndex,
  );
  const baseContent = getChatMessageDisplayText(targetMessage);
  const prepared = prepareChatCompletionRequest({
    ...input,
    chatMessages: input.messages,
    stream: true,
  });
  let messages = input.messages.map((message) => ({ ...message }));
  let continuation = "";
  let finishReason: string | undefined;

  yield {
    kind: "started",
    assistantMessageIndex: input.assistantMessageIndex,
    baseContent,
    messages,
    prepared,
  };

  for await (const event of requestChatCompletionStream({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    body: prepared.requestBody,
    fetchImpl: input.fetchImpl,
    headers: input.headers,
    signal: input.signal,
  })) {
    if (event.finishReason) {
      finishReason = event.finishReason;
    }

    if (event.content.length === 0) {
      continue;
    }

    continuation += event.content;
    messages = updateRerollMessageContent(
      messages,
      input.assistantMessageIndex,
      baseContent + continuation,
    );

    yield {
      kind: "delta",
      assistantMessageIndex: input.assistantMessageIndex,
      baseContent,
      delta: event.content,
      continuation,
      messages,
      event,
    };
  }

  messages = updateRerollMessageContent(
    messages,
    input.assistantMessageIndex,
    baseContent + continuation,
    finishReason ? { finish_reason: finishReason } : undefined,
  );

  yield {
    kind: "finished",
    assistantMessageIndex: input.assistantMessageIndex,
    baseContent,
    continuation,
    finishReason,
    messages,
  };
}

function getRerollTargetMessage(
  messages: ChatMessageLine[],
  assistantMessageIndex: number,
): ChatMessageLine {
  const targetMessage = messages[assistantMessageIndex];

  if (!targetMessage) {
    throw new Error(`Assistant message index ${assistantMessageIndex} does not exist.`);
  }

  if (targetMessage.is_user === true || targetMessage.is_system === true) {
    throw new Error(`Message at index ${assistantMessageIndex} is not an assistant message.`);
  }

  return targetMessage;
}

function createRerollMessageState(
  messages: ChatMessageLine[],
  assistantMessageIndex: number,
  targetMessage: ChatMessageLine,
): { messages: ChatMessageLine[] } {
  const existingSwipes = Array.isArray(targetMessage.swipes)
    ? [...targetMessage.swipes]
    : [getChatMessageDisplayText(targetMessage)];
  const nextSwipeIndex = existingSwipes.length;
  const rerollMessage: ChatMessageLine = {
    ...targetMessage,
    mes: "",
    swipe_id: nextSwipeIndex,
    swipes: [...existingSwipes, ""],
  };

  return {
    messages: replaceMessageAt(messages, assistantMessageIndex, rerollMessage),
  };
}

function updateRerollMessageContent(
  messages: ChatMessageLine[],
  assistantMessageIndex: number,
  content: string,
  extra?: UnknownRecord,
): ChatMessageLine[] {
  const targetMessage = getRerollTargetMessage(messages, assistantMessageIndex);
  const swipes = Array.isArray(targetMessage.swipes)
    ? [...targetMessage.swipes]
    : [getChatMessageDisplayText(targetMessage)];
  const swipeIndex =
    typeof targetMessage.swipe_id === "number" &&
    Number.isInteger(targetMessage.swipe_id) &&
    targetMessage.swipe_id >= 0
      ? targetMessage.swipe_id
      : Math.max(0, swipes.length - 1);

  swipes[swipeIndex] = content;

  const updatedMessage: ChatMessageLine = {
    ...targetMessage,
    mes: content,
    swipe_id: swipeIndex,
    swipes,
    ...(extra
      ? {
          extra: {
            ...targetMessage.extra,
            ...extra,
          },
        }
      : {}),
  };

  return replaceMessageAt(messages, assistantMessageIndex, updatedMessage);
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
