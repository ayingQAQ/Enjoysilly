import type { ChatCompletionPreset } from "../types/preset";
import type { ChatCompletionMessage } from "./promptBuilder";

export interface OpenAICompatibleChatCompletionRequestBody {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface CreateChatCompletionRequestBodyInput {
  model: string;
  messages: ChatCompletionMessage[];
  preset?: ChatCompletionPreset;
  stream?: boolean;
  extra?: Record<string, unknown>;
}

export interface ChatCompletionResponse {
  content: string;
  finishReason?: string;
  id?: string;
  model?: string;
  raw: unknown;
}

export interface ChatCompletionStreamEvent {
  content: string;
  finishReason?: string;
  done?: boolean;
  raw: unknown;
}

export interface RequestChatCompletionInput {
  baseUrl: string;
  apiKey?: string;
  body: OpenAICompatibleChatCompletionRequestBody;
  fetchImpl?: FetchLike;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface RequestChatCompletionStreamInput {
  baseUrl: string;
  apiKey?: string;
  body: OpenAICompatibleChatCompletionRequestBody;
  fetchImpl?: StreamFetchLike;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "statusText" | "json">>;

export type StreamFetchLike = (
  input: string,
  init: RequestInit,
) => Promise<
  Pick<Response, "ok" | "status" | "statusText" | "json" | "body">
>;

export class OpenAICompatibleApiError extends Error {
  status?: number;
  responseBody?: unknown;

  constructor(
    message: string,
    options: { status?: number; responseBody?: unknown } = {},
  ) {
    super(message);
    this.name = "OpenAICompatibleApiError";
    this.status = options.status;
    this.responseBody = options.responseBody;
  }
}

export function createChatCompletionRequestBody(
  input: CreateChatCompletionRequestBodyInput,
): OpenAICompatibleChatCompletionRequestBody {
  const preset = input.preset;
  const body: OpenAICompatibleChatCompletionRequestBody = pruneUndefined({
    ...input.extra,
    model: input.model,
    messages: input.messages.map((message) => ({ ...message })),
    temperature: preset?.temperature,
    top_p: preset?.top_p,
    frequency_penalty: preset?.frequency_penalty,
    presence_penalty: preset?.presence_penalty,
    max_tokens: preset?.openai_max_tokens,
    stream: input.stream ?? preset?.stream_openai,
  });

  return body;
}

export function createChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");

  if (normalized.length === 0) {
    throw new OpenAICompatibleApiError("API base URL is required.");
  }

  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  return `${normalized}/chat/completions`;
}

export async function requestChatCompletion(
  input: RequestChatCompletionInput,
): Promise<ChatCompletionResponse> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new OpenAICompatibleApiError("Fetch API is not available.");
  }

  const response = await fetchImpl(createChatCompletionsUrl(input.baseUrl), {
    method: "POST",
    headers: createRequestHeaders(input),
    body: JSON.stringify(input.body),
    signal: input.signal,
  });
  const responseBody = await readJsonResponse(response);

  if (!response.ok) {
    throw createApiErrorFromResponse(response, responseBody);
  }

  return parseChatCompletionResponse(responseBody);
}

export async function* requestChatCompletionStream(
  input: RequestChatCompletionStreamInput,
): AsyncGenerator<ChatCompletionStreamEvent> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new OpenAICompatibleApiError("Fetch API is not available.");
  }

  const response = await fetchImpl(createChatCompletionsUrl(input.baseUrl), {
    method: "POST",
    headers: createRequestHeaders(input),
    body: JSON.stringify({
      ...input.body,
      stream: true,
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const responseBody = await readJsonResponse(response);
    throw createApiErrorFromResponse(response, responseBody);
  }

  if (!response.body) {
    throw new OpenAICompatibleApiError(
      "Chat completion stream response does not contain a body.",
    );
  }

  yield* parseChatCompletionStream(response.body);
}

export function parseChatCompletionResponse(
  value: unknown,
): ChatCompletionResponse {
  if (!isRecord(value)) {
    throw new OpenAICompatibleApiError(
      "Chat completion response must be an object.",
      { responseBody: value },
    );
  }

  const choices = value.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenAICompatibleApiError(
      "Chat completion response does not contain choices.",
      { responseBody: value },
    );
  }

  const firstChoice = choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new OpenAICompatibleApiError(
      "Chat completion response choice does not contain a message.",
      { responseBody: value },
    );
  }

  const content = firstChoice.message.content;
  if (typeof content !== "string") {
    throw new OpenAICompatibleApiError(
      "Chat completion response message content must be a string.",
      { responseBody: value },
    );
  }

  return {
    content,
    finishReason:
      typeof firstChoice.finish_reason === "string"
        ? firstChoice.finish_reason
        : undefined,
    id: typeof value.id === "string" ? value.id : undefined,
    model: typeof value.model === "string" ? value.model : undefined,
    raw: value,
  };
}

export async function* parseChatCompletionStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatCompletionStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const result = await reader.read();

      if (result.done) {
        buffer += decoder.decode();
        break;
      }

      buffer += normalizeSseText(
        decoder.decode(result.value, { stream: true }),
      );
      const processed = parseCompletedSseEvents(buffer);
      buffer = processed.remainder;

      for (const eventText of processed.events) {
        const event = parseChatCompletionStreamEvent(eventText);

        if (event) {
          yield event;
        }
      }
    }

    const trailingEventText = buffer.trim();
    if (trailingEventText.length > 0) {
      const event = parseChatCompletionStreamEvent(trailingEventText);

      if (event) {
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function parseChatCompletionStreamEvent(
  eventText: string,
): ChatCompletionStreamEvent | undefined {
  const data = extractSseData(eventText);

  if (!data) {
    return undefined;
  }

  if (data.trim() === "[DONE]") {
    return {
      content: "",
      done: true,
      raw: "[DONE]",
    };
  }

  const value = parseSseJsonData(data);

  if (!isRecord(value)) {
    throw new OpenAICompatibleApiError(
      "Chat completion stream event must be an object.",
      { responseBody: value },
    );
  }

  const choices = value.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenAICompatibleApiError(
      "Chat completion stream event does not contain choices.",
      { responseBody: value },
    );
  }

  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) {
    throw new OpenAICompatibleApiError(
      "Chat completion stream choice must be an object.",
      { responseBody: value },
    );
  }

  const delta = firstChoice.delta;
  const content =
    isRecord(delta) && typeof delta.content === "string" ? delta.content : "";
  const finishReason =
    typeof firstChoice.finish_reason === "string"
      ? firstChoice.finish_reason
      : undefined;

  if (content.length === 0 && !finishReason) {
    return undefined;
  }

  return {
    content,
    finishReason,
    raw: value,
  };
}

function createRequestHeaders(
  input: Pick<RequestChatCompletionInput, "apiKey" | "headers">,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...input.headers,
  };
  const apiKey = input.apiKey?.trim();

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function readJsonResponse(
  response: Pick<Response, "json">,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function createApiErrorFromResponse(
  response: Pick<Response, "status" | "statusText">,
  responseBody: unknown,
): OpenAICompatibleApiError {
  const message = getErrorMessage(responseBody) ?? response.statusText;
  return new OpenAICompatibleApiError(
    `Chat completion request failed (${response.status}): ${message}`,
    {
      status: response.status,
      responseBody,
    },
  );
}

function getErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.error === "string") {
    return value.error;
  }

  if (isRecord(value.error) && typeof value.error.message === "string") {
    return value.error.message;
  }

  if (typeof value.message === "string") {
    return value.message;
  }

  return undefined;
}

function normalizeSseText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseCompletedSseEvents(buffer: string): {
  events: string[];
  remainder: string;
} {
  const events: string[] = [];
  let remainder = buffer;
  let separatorIndex = remainder.indexOf("\n\n");

  while (separatorIndex >= 0) {
    events.push(remainder.slice(0, separatorIndex));
    remainder = remainder.slice(separatorIndex + 2);
    separatorIndex = remainder.indexOf("\n\n");
  }

  return { events, remainder };
}

function extractSseData(eventText: string): string | undefined {
  const dataLines = normalizeSseText(eventText)
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => {
      const value = line.slice("data:".length);
      return value.startsWith(" ") ? value.slice(1) : value;
    });

  if (dataLines.length === 0) {
    return undefined;
  }

  return dataLines.join("\n");
}

function parseSseJsonData(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    throw new OpenAICompatibleApiError(
      "Chat completion stream event contains invalid JSON.",
      { responseBody: data },
    );
  }
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
