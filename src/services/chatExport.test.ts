import { describe, expect, it } from "vitest";

import { parseSillyTavernChatJsonl } from "../lib/chatIO";
import type { ChatMessageLine } from "../types/chat";
import { createChatJsonlExport, createChatJsonlFileName } from "./chatExport";

function createMessages(): ChatMessageLine[] {
  return [
    {
      name: "User",
      is_user: true,
      send_date: "2026-07-05@12h00m01s",
      mes: "你好",
      swipe_id: 0,
      swipes: ["你好"],
      extra: {
        keep: true,
      },
      unknown_field: "keep me",
    },
    {
      name: "角色",
      send_date: "2026-07-05@12h00m02s",
      mes: "你来了。",
      swipe_id: 0,
      swipes: ["你来了。"],
      swipe_info: [{ finish_reason: "stop" }],
    },
  ];
}

describe("chat export service", () => {
  it("creates a SillyTavern JSONL export artifact without mutating messages", () => {
    const messages = createMessages();
    const before = structuredClone(messages);
    const artifact = createChatJsonlExport({
      messages,
      userName: "User",
      characterName: "角色",
      chatName: "角色/测试:对话",
      now: new Date(2026, 6, 5, 12, 0, 0),
    });
    const decoded = new TextDecoder().decode(artifact.bytes);

    expect(artifact.fileName).toBe("角色_测试_对话.jsonl");
    expect(parseSillyTavernChatJsonl(decoded)).toEqual({
      metadata: {
        user_name: "User",
        character_name: "角色",
        create_date: "2026-07-05@12h00m00s",
      },
      messages: before,
    });
    expect(artifact.chatLog.messages[0]).not.toBe(messages[0]);
    expect(messages).toEqual(before);
  });

  it("creates a fallback file name from character and date", () => {
    expect(
      createChatJsonlFileName({
        characterName: "  角色  ",
        now: new Date(2026, 6, 5, 12, 0, 0),
      }),
    ).toBe("角色 2026-07-05 12h00m00s.jsonl");
  });

  it("uses a safe fallback when name and character are empty", () => {
    expect(createChatJsonlFileName({ now: undefined })).toMatch(/\.jsonl$/);
  });
});
