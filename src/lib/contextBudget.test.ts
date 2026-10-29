import { describe, expect, it } from "vitest";
import { prepareChatCompletionRequest } from "./chatRuntime";
import { runStreamingChatTurn } from "./chatStreaming";
import type { ChatMessageLine } from "../types/chat";

const message = (mes: string, is_user = true): ChatMessageLine => ({ name: is_user ? "U" : "C", mes, is_user, send_date: "date" });
const base = () => ({ model: "test", character: { spec: "chara_card_v2" as const, spec_version: "2.0", data: { name: "C", description: "必要设定" } },
  preset: { openai_max_context: 100, openai_max_tokens: 20, prompts: [{ identifier: "charDescription", marker: true, role: "system" }, { identifier: "chatHistory", marker: true, role: "user" }], prompt_order: [] } });

describe("context budget", () => {
  it("reserves output, drops old history but preserves instructions/latest round and original messages", async () => {
    const chatMessages = [message("旧".repeat(200)), message("旧回复", false), message("新问题"), message("续写", false)];
    const before = structuredClone(chatMessages);
    const result = await prepareChatCompletionRequest({ ...base(), chatMessages });
    expect(result.budget?.omittedMessages).toBeGreaterThan(0);
    expect(result.budget?.estimatedInputTokens).toBeLessThanOrEqual(80);
    expect(result.budget?.outputReserve).toBe(20);
    expect(result.messages[0].content).toBe("必要设定");
    expect(result.chatHistory).toContain("新问题");
    expect(result.chatHistory).toContain("续写");
    expect(result.chatHistory).not.toContain("旧".repeat(200));
    expect(chatMessages).toEqual(before);
  });
  it("blocks irreducible overflow before network without mutating source", async () => {
    let requests = 0;
    const source = { ...base(), baseUrl: "https://invalid.test", userName: "U", userText: "长".repeat(200), messages: [] };
    await expect((async () => { for await (const _ of runStreamingChatTurn({ ...source, fetchImpl: async () => { requests++; return new Response(); } })) { /* consume */ } })()).rejects.toThrow(/预算|上下文/);
    expect(requests).toBe(0);
    expect(source.userText.length).toBe(200);
  });
  it("rejects invalid or impossible reserve rather than silently sending", async () => {
    const input = base();
    input.preset.openai_max_tokens = 100;
    await expect(prepareChatCompletionRequest(input)).rejects.toThrow(/预算|上下文/);
    input.preset.openai_max_context = NaN;
    await expect(prepareChatCompletionRequest(input)).rejects.toThrow(/预算|上下文/);
  });
  it("does not reroll macro values while fitting history", async () => {
    let calls = 0;
    const input = base();
    input.preset.prompts.unshift({ identifier: "random", marker: false, role: "system", content: "{{random::A::B}}" } as typeof input.preset.prompts[number]);
    const result = await prepareChatCompletionRequest({ ...input, chatMessages: [message("旧".repeat(500)), message("新")], macroContext: { random: () => { calls++; return 0; } } });
    expect(calls).toBe(1);
    expect(result.messages[0].content).toBe("A");
  });
  it("keeps depth world content and system prompts when trimming history", async () => {
    const result = await prepareChatCompletionRequest({ ...base(), chatMessages: [message("旧".repeat(300)), message("新")], worldInfoEntries: [{ key: [], constant: true, content: "深度设定", position: 4, depth: 1 }] });
    expect(result.chatHistory).toContain("深度设定");
    expect(result.messages[0].content).toBe("必要设定");
    expect(result.budget?.omittedMessages).toBe(1);
  });
});
