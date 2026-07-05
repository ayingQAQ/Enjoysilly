import { describe, expect, it } from "vitest";

import type { ChatCompletionPreset } from "../types/preset";
import {
  createChatCompletionRequestBody,
  createChatCompletionsUrl,
  OpenAICompatibleApiError,
  parseChatCompletionResponse,
  parseChatCompletionStream,
  parseChatCompletionStreamEvent,
  requestChatCompletion,
  type FetchLike,
} from "./api";
import type { ChatCompletionMessage } from "./promptBuilder";

function createPreset(): ChatCompletionPreset {
  return {
    temperature: 0.7,
    top_p: 0.9,
    frequency_penalty: 0.2,
    presence_penalty: 0.3,
    openai_max_tokens: 512,
    stream_openai: true,
    prompts: [],
    prompt_order: [],
    extensions: {
      regex_scripts: [],
      tavern_helper: {
        preserved: true,
      },
    },
  };
}

function createJsonResponse(
  body: unknown,
  options: { ok?: boolean; status?: number; statusText?: string } = {},
): Awaited<ReturnType<FetchLike>> {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? "OK",
    json: async () => body,
  };
}

function createStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

async function collectStreamEvents(
  stream: ReadableStream<Uint8Array>,
): Promise<Array<Awaited<ReturnType<typeof parseChatCompletionStreamEvent>>>> {
  const events: Array<
    Awaited<ReturnType<typeof parseChatCompletionStreamEvent>>
  > = [];

  for await (const event of parseChatCompletionStream(stream)) {
    events.push(event);
  }

  return events;
}

describe("OpenAI-compatible API client", () => {
  it("creates request body from preset sampling fields without mutating sources", () => {
    const preset = createPreset();
    const messages: ChatCompletionMessage[] = [
      {
        role: "system",
        content: "You are Alice.",
      },
    ];
    const originalPreset = structuredClone(preset);
    const originalMessages = structuredClone(messages);

    const body = createChatCompletionRequestBody({
      model: "test-model",
      messages,
      preset,
      stream: false,
      extra: {
        response_format: {
          type: "json_object",
        },
        model: "should-not-override",
      },
    });

    expect(body).toEqual({
      model: "test-model",
      messages,
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.2,
      presence_penalty: 0.3,
      max_tokens: 512,
      stream: false,
      response_format: {
        type: "json_object",
      },
    });

    body.messages[0].content = "Changed";

    expect(messages).toEqual(originalMessages);
    expect(preset).toEqual(originalPreset);
  });

  it("omits undefined optional request body fields", () => {
    const body = createChatCompletionRequestBody({
      model: "test-model",
      messages: [
        {
          role: "user",
          content: "Hello",
        },
      ],
    });

    expect(body).toEqual({
      model: "test-model",
      messages: [
        {
          role: "user",
          content: "Hello",
        },
      ],
    });
    expect("temperature" in body).toBe(false);
    expect("stream" in body).toBe(false);
  });

  it("normalizes base URL to chat completions endpoint", () => {
    expect(createChatCompletionsUrl("https://example.test/v1/")).toBe(
      "https://example.test/v1/chat/completions",
    );
    expect(
      createChatCompletionsUrl(
        "https://example.test/v1/chat/completions/",
      ),
    ).toBe("https://example.test/v1/chat/completions");
  });

  it("requests non-streaming chat completion and parses content", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return createJsonResponse({
        id: "chatcmpl-test",
        model: "test-model",
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "Hello from model.",
            },
          },
        ],
      });
    };
    const body = createChatCompletionRequestBody({
      model: "test-model",
      messages: [
        {
          role: "user",
          content: "Hello",
        },
      ],
    });

    const response = await requestChatCompletion({
      baseUrl: "https://example.test/v1",
      apiKey: "secret",
      body,
      fetchImpl,
    });

    expect(response).toMatchObject({
      content: "Hello from model.",
      finishReason: "stop",
      id: "chatcmpl-test",
      model: "test-model",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe("https://example.test/v1/chat/completions");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer secret",
    });
    expect(JSON.parse(String(calls[0].init.body))).toEqual(body);
  });

  it("does not send authorization header for blank API key", async () => {
    const fetchImpl: FetchLike = async (_input, init) => {
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
      });
      return createJsonResponse({
        choices: [
          {
            message: {
              content: "OK",
            },
          },
        ],
      });
    };

    await requestChatCompletion({
      baseUrl: "https://example.test/v1",
      apiKey: "   ",
      body: createChatCompletionRequestBody({
        model: "test-model",
        messages: [],
      }),
      fetchImpl,
    });
  });

  it("throws typed error for HTTP error responses", async () => {
    const fetchImpl: FetchLike = async () =>
      createJsonResponse(
        {
          error: {
            message: "Invalid API key",
          },
        },
        {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        },
      );

    await expect(
      requestChatCompletion({
        baseUrl: "https://example.test/v1",
        body: createChatCompletionRequestBody({
          model: "test-model",
          messages: [],
        }),
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      name: "OpenAICompatibleApiError",
      status: 401,
      message: "Chat completion request failed (401): Invalid API key",
    });
  });

  it("throws typed error for invalid response shape", () => {
    expect(() => parseChatCompletionResponse({ choices: [] })).toThrow(
      OpenAICompatibleApiError,
    );
    expect(() =>
      parseChatCompletionResponse({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      }),
    ).toThrow("message content must be a string");
  });

  it("parses stream event content and finish reason", () => {
    expect(
      parseChatCompletionStreamEvent(
        'data: {"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}',
      ),
    ).toMatchObject({
      content: "Hel",
      raw: {
        choices: [
          {
            delta: {
              content: "Hel",
            },
            finish_reason: null,
          },
        ],
      },
    });
    expect(
      parseChatCompletionStreamEvent(
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      ),
    ).toMatchObject({
      content: "",
      finishReason: "stop",
    });
  });

  it("skips stream metadata-only events and parses DONE marker", () => {
    expect(
      parseChatCompletionStreamEvent(
        'event: message\ndata: {"choices":[{"delta":{"role":"assistant"}}]}',
      ),
    ).toBeUndefined();
    expect(parseChatCompletionStreamEvent("data: [DONE]")).toEqual({
      content: "",
      done: true,
      raw: "[DONE]",
    });
  });

  it("parses fetch stream chunks across SSE boundaries", async () => {
    const stream = createStream([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
      '\ndata: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    await expect(collectStreamEvents(stream)).resolves.toEqual([
      {
        content: "Hel",
        raw: {
          choices: [
            {
              delta: {
                content: "Hel",
              },
            },
          ],
        },
      },
      {
        content: "lo",
        raw: {
          choices: [
            {
              delta: {
                content: "lo",
              },
            },
          ],
        },
      },
      {
        content: "",
        finishReason: "stop",
        raw: {
          choices: [
            {
              delta: {},
              finish_reason: "stop",
            },
          ],
        },
      },
      {
        content: "",
        done: true,
        raw: "[DONE]",
      },
    ]);
  });

  it("throws typed error for invalid stream event JSON", () => {
    expect(() => parseChatCompletionStreamEvent("data: {broken")).toThrow(
      OpenAICompatibleApiError,
    );
  });
});
