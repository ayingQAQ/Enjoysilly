import { describe, expect, it } from "vitest";

import type { ChatMessageLine } from "../types/chat";
import {
  appendAssistantResponseDelta,
  ChatTurnError,
  finalizeAssistantResponse,
  formatSillyTavernChatDate,
  startChatTurn,
} from "./chatTurn";

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

describe("chat turn state helpers", () => {
  it("starts a user turn with ST-compatible user and assistant messages", () => {
    const messages = [
      createMessage({
        extra: {
          keep: true,
        },
      }),
    ];
    const originalMessages = structuredClone(messages);

    const turn = startChatTurn({
      messages,
      userName: "Tester",
      userText: "Tell me about the library.",
      assistantName: "Alice",
      now: new Date(2026, 6, 5, 9, 8, 7),
      userExtra: {
        source: "manual",
      },
    });

    expect(turn.userMessageIndex).toBe(1);
    expect(turn.assistantMessageIndex).toBe(2);
    expect(turn.messages).toEqual([
      messages[0],
      {
        name: "Tester",
        is_user: true,
        send_date: "2026-07-05@09h08m07s",
        mes: "Tell me about the library.",
        swipe_id: 0,
        swipes: ["Tell me about the library."],
        extra: {
          source: "manual",
        },
      },
      {
        name: "Alice",
        is_user: false,
        send_date: "2026-07-05@09h08m07s",
        mes: "",
        swipe_id: 0,
        swipes: [""],
      },
    ]);
    expect(messages).toEqual(originalMessages);
  });

  it("appends streaming assistant deltas to the current swipe", () => {
    const messages = [
      createMessage({
        name: "Tester",
        is_user: true,
        mes: "Hi",
      }),
      createMessage({
        mes: "Hel",
        swipe_id: 1,
        swipes: ["Old response", "Hel"],
      }),
    ];
    const originalMessages = structuredClone(messages);

    const updated = appendAssistantResponseDelta({
      messages,
      assistantMessageIndex: 1,
      delta: "lo",
    });

    expect(updated[1]).toEqual({
      ...messages[1],
      mes: "Hello",
      swipe_id: 1,
      swipes: ["Old response", "Hello"],
    });
    expect(messages).toEqual(originalMessages);
  });

  it("finalizes assistant content and merges extra metadata", () => {
    const messages = [
      createMessage({
        mes: "",
        swipes: [""],
        extra: {
          request_id: "keep",
        },
      }),
    ];

    const updated = finalizeAssistantResponse({
      messages,
      assistantMessageIndex: 0,
      content: "Final answer.",
      extra: {
        finish_reason: "stop",
      },
    });

    expect(updated[0]).toEqual({
      ...messages[0],
      mes: "Final answer.",
      swipe_id: 0,
      swipes: ["Final answer."],
      extra: {
        request_id: "keep",
        finish_reason: "stop",
      },
    });
    expect(messages[0].mes).toBe("");
  });

  it("finalizes assistant content without adding empty extra metadata", () => {
    const messages = [
      createMessage({
        mes: "",
        swipes: [""],
      }),
    ];

    const updated = finalizeAssistantResponse({
      messages,
      assistantMessageIndex: 0,
      content: "Final answer.",
    });

    expect(updated[0]).toEqual({
      ...messages[0],
      mes: "Final answer.",
      swipe_id: 0,
      swipes: ["Final answer."],
    });
    expect(Object.hasOwn(updated[0], "extra")).toBe(false);
  });

  it("normalizes missing swipes while preserving assistant fields", () => {
    const messages = [
      createMessage({
        mes: "Partial",
        swipe_id: undefined,
        swipes: undefined,
        extra: {
          keep: true,
        },
      }),
    ];

    const updated = appendAssistantResponseDelta({
      messages,
      assistantMessageIndex: 0,
      delta: " answer",
    });

    expect(updated[0]).toEqual({
      ...messages[0],
      mes: "Partial answer",
      swipe_id: 0,
      swipes: ["Partial answer"],
    });
  });

  it("rejects user or system messages as assistant update targets", () => {
    expect(() =>
      appendAssistantResponseDelta({
        messages: [createMessage({ is_user: true })],
        assistantMessageIndex: 0,
        delta: "nope",
      }),
    ).toThrow(ChatTurnError);
    expect(() =>
      finalizeAssistantResponse({
        messages: [createMessage({ is_system: true })],
        assistantMessageIndex: 0,
        content: "nope",
      }),
    ).toThrow("not an assistant message");
  });

  it("formats SillyTavern chat timestamps", () => {
    expect(formatSillyTavernChatDate(new Date(2026, 0, 2, 3, 4, 5))).toBe(
      "2026-01-02@03h04m05s",
    );
  });
});
