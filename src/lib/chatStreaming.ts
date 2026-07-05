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

export type StreamingChatTurnUpdate =
  | StreamingChatTurnStartedUpdate
  | StreamingChatTurnDeltaUpdate
  | StreamingChatTurnFinishedUpdate;

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
