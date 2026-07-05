import { describe, expect, it } from "vitest";

import type { ChatMessageLine } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";
import type { ScannedWorldInfoEntry } from "./worldInfoScan";
import {
  buildChatHistorySegments,
  buildChatHistoryText,
  getChatMessageDisplayText,
} from "./chatHistory";
import { buildChatCompletionMessages } from "./promptBuilder";

function createMessage(
  overrides: Partial<ChatMessageLine> = {},
): ChatMessageLine {
  return {
    name: "角色",
    is_user: false,
    mes: "默认消息",
    ...overrides,
  };
}

function createAtDepthEntry(
  overrides: Partial<ScannedWorldInfoEntry> = {},
): ScannedWorldInfoEntry {
  return {
    sourceIndex: 0,
    content: "世界书内容",
    order: 0,
    matchedKeys: [],
    reasons: ["keyword"],
    entry: {
      key: ["世界"],
      content: "世界书内容",
      position: 4,
    },
    ...overrides,
  };
}

function createPreset(): ChatCompletionPreset {
  return {
    prompts: [
      {
        identifier: "chatHistory",
        role: "user",
        marker: true,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [{ identifier: "chatHistory", enabled: true }],
      },
    ],
  };
}

function createCharacter(): CharacterCard {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: "角色",
    },
  };
}

describe("chat history builder", () => {
  it("uses current swipe content when available", () => {
    const message = createMessage({
      mes: "旧显示",
      swipe_id: 1,
      swipes: ["第一版", "第二版"],
    });

    expect(getChatMessageDisplayText(message)).toBe("第二版");
  });

  it("formats recent non-system messages without mutating payload", () => {
    const messages = [
      createMessage({
        name: "系统",
        is_system: true,
        mes: "内部提示",
      }),
      createMessage({
        name: "用户",
        is_user: true,
        mes: "你好",
      }),
      createMessage({
        name: "角色",
        is_user: false,
        mes: "你来了。",
        swipe_id: 0,
        swipes: ["你来了。"],
      }),
    ];
    const originalMessages = structuredClone(messages);

    expect(buildChatHistoryText(messages, { maxMessages: 2 })).toBe(
      "用户: 你好\n角色: 你来了。",
    );
    expect(messages).toEqual(originalMessages);
  });

  it("can include system messages when requested", () => {
    const messages = [
      createMessage({
        name: "系统",
        is_system: true,
        mes: "系统消息",
      }),
    ];

    expect(
      buildChatHistoryText(messages, { includeSystemMessages: true }),
    ).toBe("系统: 系统消息");
    expect(buildChatHistoryText(messages)).toBe("");
  });

  it("inserts at-depth world info into chat history segments", () => {
    const messages = [
      createMessage({ name: "用户", mes: "第一句" }),
      createMessage({ name: "角色", mes: "第二句" }),
      createMessage({ name: "用户", mes: "第三句" }),
    ];

    const segments = buildChatHistorySegments(messages, {
      atDepthEntries: [
        createAtDepthEntry({
          content: "深度 1",
          depth: 1,
          order: 20,
          sourceIndex: 1,
        }),
        createAtDepthEntry({
          content: "深度 0",
          depth: 0,
          order: 10,
          sourceIndex: 0,
        }),
      ],
    });

    expect(segments.map((segment) => segment.content)).toEqual([
      "第一句",
      "第二句",
      "深度 1",
      "第三句",
      "深度 0",
    ]);
    expect(buildChatHistoryText(messages, {
      atDepthEntries: [
        createAtDepthEntry({
          content: "深度 1",
          depth: 1,
        }),
      ],
    })).toBe("用户: 第一句\n角色: 第二句\n深度 1\n用户: 第三句");
  });

  it("feeds prompt builder chatHistory marker", () => {
    const chatHistory = buildChatHistoryText([
      createMessage({ name: "用户", is_user: true, mes: "你好" }),
      createMessage({ name: "角色", is_user: false, mes: "我在。" }),
    ]);

    const messages = buildChatCompletionMessages({
      preset: createPreset(),
      character: createCharacter(),
      chatHistory,
    });

    expect(messages).toEqual([
      {
        role: "user",
        content: "用户: 你好\n角色: 我在。",
      },
    ]);
  });
});
