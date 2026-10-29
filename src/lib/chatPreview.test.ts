import { describe, expect, it } from "vitest";
import { prepareStreamingChatTurn, runStreamingChatTurn } from "./chatStreaming";
import type { RunStreamingChatTurnInput } from "./chatStreaming";

function input(): RunStreamingChatTurnInput {
  return {
    baseUrl: "https://example.invalid/v1", apiKey: "secret-not-in-preview", model: "test", userName: "用户", userText: "月亮", messages: [{ name: "角色", is_user: false, mes: "old", swipes: ["old", "current"], swipe_id: 1, send_date: "date" }],
    character: { spec: "chara_card_v2", spec_version: "2.0", data: { name: "角色", description: "角色设定" } },
    preset: { prompts: [{ identifier: "charDescription", marker: true, role: "system" }, { identifier: "random", content: "{{random::A::B}}", role: "system" }, { identifier: "worldInfoBefore", marker: true, role: "system" }, { identifier: "chatHistory", marker: true, role: "user" }], prompt_order: [] },
    worldInfoEntries: [{ key: ["太阳"], content: "世界设定" }],
    regexScripts: [{ findRegex: "月亮", replaceString: "太阳", placement: [1] }],
  };
}
describe("prepared next-message preview", () => {
  it("prepares processed input and current swipe without network, credentials or mutations", async () => {
    const source = input();
    const original = structuredClone(source);
    source.preset.extensions = { regex_scripts: [{ findRegex: "角色设定", replaceString: "最终设定", placement: [5], promptOnly: true }] };
    original.preset.extensions = structuredClone(source.preset.extensions);
    const preview = await prepareStreamingChatTurn(source);
    expect(preview.prepared.messages[0]).toEqual({ role: "system", content: "最终设定" });
    expect(preview.prepared.messages.map(m => m.content).join(" ")).toContain("太阳");
    expect(preview.prepared.messages.map(m => m.content).join(" ")).toContain("current");
    expect(preview.prepared.messages.map(m => m.content)).toContain("世界设定");
    expect(preview.prepared.messageSources?.map(s => s.identifier)).toEqual(["charDescription", "random", "worldInfoBefore", "chatHistory"]);
    expect(preview.prepared.worldInfoScanResult?.diagnostics?.[0].outcome).toBe("selected");
    expect(JSON.stringify(preview)).not.toContain("secret-not-in-preview");
    expect(source).toEqual(original);
  });
  it("sends the inspected snapshot without rerolling macros or leaking diagnostics into the request", async () => {
    const source = input();
    let randomCalls = 0;
    source.macroContext = { random: () => { randomCalls++; return 0; } };
    const preview = await prepareStreamingChatTurn(source);
    let sent: unknown;
    const updates = [];
    for await (const update of runStreamingChatTurn({ ...source, preparedTurn: preview, fetchImpl: async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { headers: { "Content-Type": "text/event-stream" } });
    } })) updates.push(update);
    expect(randomCalls).toBe(1);
    expect(sent).toEqual(preview.prepared.requestBody);
    expect(sent).not.toHaveProperty("messageSources");
    expect(sent).not.toHaveProperty("worldInfoScanResult");
    expect(updates.at(-1)?.messages.at(-1)?.mes).toBe("ok");
  });
});
