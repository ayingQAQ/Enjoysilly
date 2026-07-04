import { describe, expect, it } from "vitest";

import {
  encodeSillyTavernChatJsonl,
  parseSillyTavernChatJsonl,
  serializeSillyTavernChatJsonl,
} from "./chatIO";

describe("SillyTavern chat JSONL IO", () => {
  it("parses metadata and message lines", () => {
    const source = [
      JSON.stringify({
        user_name: "见山",
        character_name: "林黛玉",
        create_date: "2026-07-03@23h00m00s",
        chat_metadata: { custom: true },
      }),
      JSON.stringify({
        name: "林黛玉",
        is_user: false,
        send_date: "2026-07-03@23h01m00s",
        mes: "你来了。",
        swipe_id: 0,
        swipes: ["你来了。"],
        extra: { display_text: "keep" },
      }),
    ].join("\n");

    const parsed = parseSillyTavernChatJsonl(source);

    expect(parsed.metadata.character_name).toBe("林黛玉");
    expect(parsed.metadata.chat_metadata).toEqual({ custom: true });
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]).toMatchObject({
      name: "林黛玉",
      mes: "你来了。",
      swipes: ["你来了。"],
    });
  });

  it("serializes JSONL without dropping message extra fields", () => {
    const chatLog = {
      metadata: {
        user_name: "见山",
        character_name: "林黛玉",
        create_date: "2026-07-03@23h00m00s",
        chat_metadata: { custom: true },
      },
      messages: [
        {
          name: "见山",
          is_user: true,
          send_date: "2026-07-03@23h02m00s",
          mes: "我来了。",
          swipe_id: 0,
          swipes: ["我来了。"],
          extra: { custom: "keep" },
        },
      ],
    };

    const serialized = serializeSillyTavernChatJsonl(chatLog);
    const encoded = encodeSillyTavernChatJsonl(chatLog);
    const reparsed = parseSillyTavernChatJsonl(serialized);

    expect(reparsed).toEqual(chatLog);
    expect(new TextDecoder().decode(encoded)).toBe(serialized);
  });

  it("rejects invalid message lines", () => {
    const source = [
      JSON.stringify({ character_name: "林黛玉" }),
      JSON.stringify({ name: "林黛玉" }),
    ].join("\n");

    expect(() => parseSillyTavernChatJsonl(source)).toThrow(
      "Chat message line 2 is invalid.",
    );
  });
});
