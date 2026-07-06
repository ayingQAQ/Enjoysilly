import { describe, expect, it } from "vitest";

import type { ChatMessageLine } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";
import type { StreamFetchLike } from "./api";
import {
  runStreamingChatContinue,
  runStreamingChatReroll,
  runStreamingChatTurn,
} from "./chatStreaming";

function createCharacter(): CharacterCard {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: "Alice",
      description: "A careful archivist.",
    },
  };
}

function createPreset(): ChatCompletionPreset {
  return {
    temperature: 0.7,
    prompts: [
      {
        identifier: "main",
        role: "system",
        content: "You are {{char}} talking to {{user}}.",
      },
      {
        identifier: "chatHistory",
        role: "user",
        marker: true,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          {
            identifier: "main",
            enabled: true,
          },
          {
            identifier: "chatHistory",
            enabled: true,
          },
        ],
      },
    ],
  };
}

function createMessage(
  overrides: Partial<ChatMessageLine> = {},
): ChatMessageLine {
  return {
    name: "Alice",
    is_user: false,
    send_date: "2026-07-05@09h00m00s",
    mes: "Hello.",
    swipe_id: 0,
    swipes: ["Hello."],
    ...overrides,
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

async function collectStreamingTurn(
  input: Parameters<typeof runStreamingChatTurn>[0],
) {
  const updates = [];

  for await (const update of runStreamingChatTurn(input)) {
    updates.push(update);
  }

  return updates;
}

async function collectStreamingReroll(
  input: Parameters<typeof runStreamingChatReroll>[0],
) {
  const updates = [];

  for await (const update of runStreamingChatReroll(input)) {
    updates.push(update);
  }

  return updates;
}

async function collectStreamingContinue(
  input: Parameters<typeof runStreamingChatContinue>[0],
) {
  const updates = [];

  for await (const update of runStreamingChatContinue(input)) {
    updates.push(update);
  }

  return updates;
}

describe("streaming chat turn runner", () => {
  it("runs a streaming turn and yields started, delta, and finished updates", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: StreamFetchLike = async (input, init) => {
      calls.push({ input, init });

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => undefined,
        body: createStream([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
          "data: [DONE]\n\n",
        ]),
      };
    };
    const existingMessages = [
      createMessage({
        name: "Tester",
        is_user: true,
        mes: "Hi.",
        swipes: ["Hi."],
      }),
      createMessage({
        name: "Alice",
        is_user: false,
        mes: "Hello.",
      }),
    ];
    const originalMessages = structuredClone(existingMessages);

    const updates = await collectStreamingTurn({
      baseUrl: "https://example.test/v1",
      apiKey: "secret",
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      messages: existingMessages,
      userName: "Tester",
      userText: "Tell me more.",
      fetchImpl,
      now: new Date(2026, 6, 5, 9, 8, 7),
    });

    expect(updates.map((update) => update.kind)).toEqual([
      "started",
      "delta",
      "delta",
      "finished",
    ]);
    expect(updates[0]).toMatchObject({
      kind: "started",
      messages: [
        existingMessages[0],
        existingMessages[1],
        {
          name: "Tester",
          is_user: true,
          send_date: "2026-07-05@09h08m07s",
          mes: "Tell me more.",
          swipe_id: 0,
          swipes: ["Tell me more."],
        },
        {
          name: "Alice",
          is_user: false,
          send_date: "2026-07-05@09h08m07s",
          mes: "",
          swipe_id: 0,
          swipes: [""],
        },
      ],
    });
    expect(updates[1]).toMatchObject({
      kind: "delta",
      delta: "Hel",
      content: "Hel",
    });
    expect(updates[2]).toMatchObject({
      kind: "delta",
      delta: "lo",
      content: "Hello",
    });
    expect(updates[3]).toMatchObject({
      kind: "finished",
      content: "Hello",
      finishReason: "stop",
    });
    expect(updates[3].messages.at(-1)).toMatchObject({
      name: "Alice",
      mes: "Hello",
      swipe_id: 0,
      swipes: ["Hello"],
      extra: {
        finish_reason: "stop",
      },
    });
    expect(existingMessages).toEqual(originalMessages);
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe("https://example.test/v1/chat/completions");
    expect(calls[0].init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer secret",
    });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      model: "test-model",
      stream: true,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are Alice talking to Tester.",
        },
        {
          role: "user",
          content:
            "Tester: Hi.\nAlice: Hello.\nTester: Tell me more.",
        },
      ],
    });
  });

  it("uses explicit assistant name and custom headers", async () => {
    const fetchImpl: StreamFetchLike = async (_input, init) => {
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        "X-Provider": "test",
      });

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => undefined,
        body: createStream(["data: [DONE]\n\n"]),
      };
    };

    const updates = await collectStreamingTurn({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      messages: [],
      userName: "Tester",
      userText: "Hi.",
      assistantName: "Narrator",
      headers: {
        "X-Provider": "test",
      },
      fetchImpl,
    });

    expect(updates[0].messages.at(-1)).toMatchObject({
      name: "Narrator",
      is_user: false,
    });
    expect(updates.at(-1)).toMatchObject({
      kind: "finished",
      content: "",
    });
  });

  it("propagates streaming API errors after yielding the optimistic turn", async () => {
    const fetchImpl: StreamFetchLike = async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        error: {
          message: "Invalid key",
        },
      }),
      body: null,
    });
    const updates = [];

    await expect(async () => {
      for await (const update of runStreamingChatTurn({
        baseUrl: "https://example.test/v1",
        model: "test-model",
        preset: createPreset(),
        character: createCharacter(),
        messages: [],
        userName: "Tester",
        userText: "Hi.",
        fetchImpl,
      })) {
        updates.push(update);
      }
    }).rejects.toMatchObject({
      status: 401,
      message: "Chat completion request failed (401): Invalid key",
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      kind: "started",
    });
  });

  it("rerolls an assistant message by appending a new swipe", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: StreamFetchLike = async (input, init) => {
      calls.push({ input, init });

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => undefined,
        body: createStream([
          'data: {"choices":[{"delta":{"content":"New"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" answer"}}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
          "data: [DONE]\n\n",
        ]),
      };
    };
    const messages: ChatMessageLine[] = [
      createMessage({
        name: "Tester",
        is_user: true,
        mes: "Question?",
        swipes: ["Question?"],
      }),
      createMessage({
        name: "Alice",
        is_user: false,
        mes: "Old answer.",
        swipe_id: 0,
        swipes: ["Old answer."],
        extra: {
          keep: true,
        },
      }),
    ];
    const originalMessages = structuredClone(messages);

    const updates = await collectStreamingReroll({
      assistantMessageIndex: 1,
      baseUrl: "https://example.test/v1",
      apiKey: "secret",
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      messages,
      userName: "Tester",
      fetchImpl,
    });

    expect(updates.map((update) => update.kind)).toEqual([
      "started",
      "delta",
      "delta",
      "finished",
    ]);
    expect(updates[0]).toMatchObject({
      kind: "started",
      assistantMessageIndex: 1,
      messages: [
        messages[0],
        {
          name: "Alice",
          mes: "",
          swipe_id: 1,
          swipes: ["Old answer.", ""],
          extra: {
            keep: true,
          },
        },
      ],
    });
    expect(updates.at(-1)).toMatchObject({
      kind: "finished",
      content: "New answer",
      finishReason: "stop",
      messages: [
        messages[0],
        {
          name: "Alice",
          mes: "New answer",
          swipe_id: 1,
          swipes: ["Old answer.", "New answer"],
          extra: {
            keep: true,
            finish_reason: "stop",
          },
        },
      ],
    });
    expect(messages).toEqual(originalMessages);
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      messages: [
        {
          role: "system",
          content: "You are Alice talking to Tester.",
        },
        {
          role: "user",
          content: "Tester: Question?",
        },
      ],
    });
    expect(String(calls[0].init.body)).not.toContain("Old answer.");
  });

  it("rejects reroll targets that are not assistant messages", async () => {
    await expect(async () => {
      for await (const _update of runStreamingChatReroll({
        assistantMessageIndex: 0,
        baseUrl: "https://example.test/v1",
        model: "test-model",
        preset: createPreset(),
        character: createCharacter(),
        messages: [
          createMessage({
            name: "Tester",
            is_user: true,
          }),
        ],
        userName: "Tester",
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => undefined,
          body: createStream(["data: [DONE]\n\n"]),
        }),
      })) {
        // Exhaust the generator.
      }
    }).rejects.toThrow("Message at index 0 is not an assistant message.");
  });

  it("applies placement=1 regex to user input before the turn", async () => {
    const fetchImpl: StreamFetchLike = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => undefined,
      body: createStream([
        'data: {"choices":[{"delta":{"content":"Ok"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    });

    const updates = await collectStreamingTurn({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      messages: [],
      userName: "Tester",
      userText: "say hello world",
      fetchImpl,
      regexScripts: [
        { findRegex: "hello world", replaceString: "hi there" },
      ],
    });

    expect(updates[0].messages.at(-2)).toMatchObject({
      name: "Tester",
      mes: "say hi there",
      swipes: ["say hi there"],
    });
  });

  it("applies placement=2 regex to AI output after streaming turn finalization", async () => {
    const fetchImpl: StreamFetchLike = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => undefined,
      body: createStream([
        'data: {"choices":[{"delta":{"content":"Hello!"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    });

    const updates = await collectStreamingTurn({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      messages: [],
      userName: "Tester",
      userText: "Hi.",
      fetchImpl,
      regexScripts: [
        { findRegex: "Hello!", replaceString: "Greetings!" },
      ],
    });

    expect(updates.at(-1)?.messages.at(-1)).toMatchObject({
      name: "Alice",
      mes: "Greetings!",
      swipes: ["Greetings!"],
    });
  });

  it("applies placement=2 regex to rerolled content", async () => {
    const fetchImpl: StreamFetchLike = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => undefined,
      body: createStream([
        'data: {"choices":[{"delta":{"content":"Fresh reply"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    });
    const messages: ChatMessageLine[] = [
      createMessage({ name: "Tester", is_user: true, mes: "Q.", swipes: ["Q."] }),
      createMessage({ name: "Alice", is_user: false, mes: "Old.", swipes: ["Old."] }),
    ];

    const updates = await collectStreamingReroll({
      assistantMessageIndex: 1,
      baseUrl: "https://example.test/v1",
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      messages,
      userName: "Tester",
      fetchImpl,
      regexScripts: [
        { findRegex: "Fresh reply", replaceString: "Processed reply" },
      ],
    });

    expect(updates.at(-1)?.messages[1]).toMatchObject({
      mes: "Processed reply",
      swipes: ["Old.", "Processed reply"],
    });
  });

  it("applies placement=2 regex to continued content", async () => {
    const fetchImpl: StreamFetchLike = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => undefined,
      body: createStream([
        'data: {"choices":[{"delta":{"content":" extra"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    });
    const messages: ChatMessageLine[] = [
      createMessage({ name: "Tester", is_user: true, mes: "Q.", swipes: ["Q."] }),
      createMessage({ name: "Alice", is_user: false, mes: "Base", swipes: ["Base"] }),
    ];

    const updates = await collectStreamingContinue({
      assistantMessageIndex: 1,
      baseUrl: "https://example.test/v1",
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      messages,
      userName: "Tester",
      fetchImpl,
      regexScripts: [
        { findRegex: "extra", replaceString: "appendix" },
      ],
    });

    expect(updates.at(-1)?.messages[1]).toMatchObject({
      mes: "Base appendix",
      swipes: ["Base appendix"],
    });
  });

  it("skips disabled regex scripts during streaming", async () => {
    const fetchImpl: StreamFetchLike = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => undefined,
      body: createStream([
        'data: {"choices":[{"delta":{"content":"Hello!"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    });

    const updates = await collectStreamingTurn({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      messages: [],
      userName: "Tester",
      userText: "Hi.",
      fetchImpl,
      regexScripts: [
        { findRegex: "Hello!", replaceString: "X", disabled: true },
      ],
    });

    expect(updates.at(-1)?.messages.at(-1)).toMatchObject({
      name: "Alice",
      mes: "Hello!",
    });
  });

  it("continues an assistant message by appending to the selected swipe", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: StreamFetchLike = async (input, init) => {
      calls.push({ input, init });

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => undefined,
        body: createStream([
          'data: {"choices":[{"delta":{"content":" plus"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" more"}}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
          "data: [DONE]\n\n",
        ]),
      };
    };
    const messages: ChatMessageLine[] = [
      createMessage({
        name: "Tester",
        is_user: true,
        mes: "Question?",
        swipes: ["Question?"],
      }),
      createMessage({
        name: "Alice",
        is_user: false,
        mes: "Base answer",
        swipe_id: 0,
        swipes: ["Base answer"],
        extra: { keep: true },
      }),
    ];
    const originalMessages = structuredClone(messages);

    const updates = await collectStreamingContinue({
      assistantMessageIndex: 1,
      baseUrl: "https://example.test/v1",
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      messages,
      userName: "Tester",
      fetchImpl,
    });

    expect(updates.at(-1)).toMatchObject({
      kind: "finished",
      baseContent: "Base answer",
      continuation: " plus more",
      finishReason: "stop",
    });
    expect(updates.at(-1)?.messages[1]).toMatchObject({
      name: "Alice",
      mes: "Base answer plus more",
      swipes: ["Base answer plus more"],
    });
    expect(messages).toEqual(originalMessages);
  });
});
