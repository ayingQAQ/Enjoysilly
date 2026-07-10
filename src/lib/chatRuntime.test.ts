import { describe, expect, it } from "vitest";

import type { ChatMessageLine } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";
import type { NativeWorldInfoEntry } from "../types/worldinfo";
import { prepareChatCompletionRequest } from "./chatRuntime";

function createCharacter(): CharacterCard {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: "Alice",
      description: "A careful archivist.",
      personality: "Precise and calm.",
      scenario: "A quiet library.",
    },
  };
}

function createMessage(
  overrides: Partial<ChatMessageLine> = {},
): ChatMessageLine {
  return {
    name: "User",
    is_user: true,
    mes: "Hello",
    ...overrides,
  };
}

function createPreset(
  order: string[] = ["main", "charDescription", "chatHistory"],
): ChatCompletionPreset {
  return {
    temperature: 0.7,
    top_p: 0.9,
    openai_max_tokens: 512,
    stream_openai: true,
    prompts: [
      {
        identifier: "main",
        name: "Main",
        role: "system",
        content: "You are {{char}} talking to {{user}}.",
      },
      {
        identifier: "charDescription",
        role: "system",
        marker: true,
      },
      {
        identifier: "worldInfoBefore",
        role: "system",
        marker: true,
      },
      {
        identifier: "chatHistory",
        role: "user",
        marker: true,
      },
      {
        identifier: "worldInfoAfter",
        role: "system",
        marker: true,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: order.map((identifier) => ({
          identifier,
          enabled: true,
        })),
      },
    ],
  };
}

describe("chat runtime request preparation", () => {
  it("prepares prompt messages and request body without sending requests", async () => {
    const prepared = await prepareChatCompletionRequest({
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      userName: "Tester",
      stream: false,
      requestExtra: {
        response_format: {
          type: "json_object",
        },
      },
      chatMessages: [
        createMessage({ name: "Tester", mes: "Hi Alice." }),
        createMessage({
          name: "Alice",
          is_user: false,
          mes: "Hello.",
        }),
      ],
    });

    expect(prepared.chatHistory).toBe("Tester: Hi Alice.\nAlice: Hello.");
    expect(prepared.messages).toEqual([
      {
        role: "system",
        content: "You are Alice talking to Tester.",
      },
      {
        role: "system",
        content: "A careful archivist.",
      },
      {
        role: "user",
        content: "Tester: Hi Alice.\nAlice: Hello.",
      },
    ]);
    expect(prepared.requestBody).toEqual({
      model: "test-model",
      messages: prepared.messages,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 512,
      stream: false,
      response_format: {
        type: "json_object",
      },
    });

    prepared.requestBody.messages[0].content = "Changed";

    expect(prepared.messages[0].content).toBe(
      "You are Alice talking to Tester.",
    );
  });

  it("passes group context into prompt messages", async () => {
    const prepared = await prepareChatCompletionRequest({
      model: "test-model",
      preset: createPreset(),
      character: createCharacter(),
      userName: "Tester",
      speakerCharacterId: "char-a",
      groupName: "测试群",
      groupMembers: [
        { characterId: "char-a", name: "Alice" },
        { characterId: "char-b", name: "Bob" },
      ],
    });

    expect(prepared.messages[0]).toEqual({
      role: "system",
      content: "[测试群成员：Bob]",
    });
    expect(prepared.requestBody.messages[0]).toEqual(prepared.messages[0]);
  });

  it("scans world info once and injects before, after, and at-depth content", async () => {
    const worldInfoEntries: NativeWorldInfoEntry[] = [
      {
        key: ["dragon"],
        content: "Before lore",
        order: 1,
        position: 0,
      },
      {
        key: ["dragon"],
        content: "After lore",
        order: 2,
        position: 1,
      },
      {
        key: ["dragon"],
        content: "At-depth lore",
        order: 3,
        position: 4,
        depth: 1,
      },
      {
        key: ["dragon"],
        content: "Disabled lore",
        disable: true,
        order: 4,
        position: 0,
      },
    ];
    const prepared = await prepareChatCompletionRequest({
      model: "test-model",
      preset: createPreset([
        "worldInfoBefore",
        "chatHistory",
        "worldInfoAfter",
      ]),
      character: createCharacter(),
      worldInfoEntries,
      chatMessages: [
        createMessage({
          name: "Tester",
          mes: "Plain text",
          swipe_id: 0,
          swipes: ["The dragon wakes."],
        }),
        createMessage({
          name: "Alice",
          is_user: false,
          mes: "I hear wings.",
        }),
      ],
    });

    expect(prepared.worldInfoScanResult).toMatchObject({
      before: [{ content: "Before lore" }],
      after: [{ content: "After lore" }],
      atDepth: [{ content: "At-depth lore" }],
    });
    expect(prepared.chatHistory).toBe(
      "Tester: The dragon wakes.\nAt-depth lore\nAlice: I hear wings.",
    );
    expect(prepared.messages).toEqual([
      {
        role: "system",
        content: "Before lore",
      },
      {
        role: "user",
        content:
          "Tester: The dragon wakes.\nAt-depth lore\nAlice: I hear wings.",
      },
      {
        role: "system",
        content: "After lore",
      },
    ]);
    expect(JSON.stringify(prepared.messages)).not.toContain("Disabled lore");
  });

  it("omits empty world info markers when no entries are provided", async () => {
    const prepared = await prepareChatCompletionRequest({
      model: "test-model",
      preset: createPreset([
        "worldInfoBefore",
        "chatHistory",
        "worldInfoAfter",
      ]),
      character: createCharacter(),
      chatMessages: [createMessage({ name: "Tester", mes: "No lore here." })],
    });

    expect(prepared.worldInfoScanResult).toBeUndefined();
    expect(prepared.messages).toEqual([
      {
        role: "user",
        content: "Tester: No lore here.",
      },
    ]);
  });

  it("does not mutate preset, character, chat messages, or world info entries", async () => {
    const preset = createPreset(["worldInfoBefore", "chatHistory"]);
    const character = createCharacter();
    const chatMessages = [
      createMessage({
        mes: "The library opens.",
      }),
    ];
    const worldInfoEntries: NativeWorldInfoEntry[] = [
      {
        key: ["library"],
        content: "Library lore",
        position: 0,
      },
    ];
    const originalPreset = structuredClone(preset);
    const originalCharacter = structuredClone(character);
    const originalChatMessages = structuredClone(chatMessages);
    const originalWorldInfoEntries = structuredClone(worldInfoEntries);

    await prepareChatCompletionRequest({
      model: "test-model",
      preset,
      character,
      chatMessages,
      worldInfoEntries,
      maxHistoryMessages: 1,
      stream: true,
    });

    expect(preset).toEqual(originalPreset);
    expect(character).toEqual(originalCharacter);
    expect(chatMessages).toEqual(originalChatMessages);
    expect(worldInfoEntries).toEqual(originalWorldInfoEntries);
  });
});
