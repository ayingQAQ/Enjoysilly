// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { useChatPromptPreview } from "./useChatPromptPreview";
import type { PrepareStreamingChatTurnInput } from "../../lib/chatStreaming";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("invalidates inspected messages when the draft changes and preserves the new draft on close", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  let state: ReturnType<typeof useChatPromptPreview>;
  const base: PrepareStreamingChatTurnInput = { model: "test", messages: [], userName: "U", userText: "old", character: { spec: "chara_card_v2", spec_version: "2.0", data: { name: "C" } }, preset: { prompts: [{ identifier: "chatHistory", marker: true, role: "user" }], prompt_order: [] } };
  function Harness({ text }: { text: string }) { state = useChatPromptPreview({ ...base, userText: text }, true); return null; }
  try {
    await act(async () => root.render(<Harness text="old" />));
    await act(async () => { await state.prepare(); });
    expect(state!.data?.prepared.messages[0].content).toBe("U: old");
    await act(async () => root.render(<Harness text="new" />));
    expect(state!.data).toBeUndefined();
    expect(state!.error).toBeTruthy();
    await act(async () => { state.close(); await state.prepare(); });
    expect(state!.data?.prepared.messages[0].content).toBe("U: new");
    await act(async () => { state.close(); });
    expect(state!.open).toBe(false);
  } finally { await act(async () => root.unmount()); }
});

it("discards an in-flight result after the source changes or the drawer closes", async () => {
  const root = createRoot(document.createElement("div"));
  let state: ReturnType<typeof useChatPromptPreview>;
  function Harness({ text }: { text: string }) {
    state = useChatPromptPreview({ model: "test", messages: [], userName: "U", userText: text,
      character: { spec: "chara_card_v2", spec_version: "2.0", data: { name: "C" } },
      preset: { prompts: [{ identifier: "chatHistory", marker: true, role: "user" }], prompt_order: [] } }, true);
    return null;
  }
  try {
    act(() => root.render(<Harness text="old" />));
    let pending!: Promise<void>;
    act(() => { pending = state.prepare(); });
    act(() => root.render(<Harness text="new" />));
    await act(async () => { await pending; });
    expect(state!.data).toBeUndefined();
    expect(state!.error).toContain("会话已变化");
    act(() => { pending = state.prepare(); state.close(); });
    await act(async () => { await pending; });
    expect(state!.open).toBe(false);
    expect(state!.data).toBeUndefined();
  } finally { await act(async () => root.unmount()); }
});
