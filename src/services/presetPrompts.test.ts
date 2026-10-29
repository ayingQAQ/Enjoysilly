import { expect, it } from "vitest";
import { addPrompt, copyPrompt, deletePrompt, movePromptOrder, setPromptEnabled } from "./presetPrompts";
import type { ChatCompletionPreset } from "../types/preset";

const fixture = (): ChatCompletionPreset => ({
  prompts: [{ identifier: "a", name: "A", content: "🌙", unknown: { keep: true } }, { identifier: "chatHistory", marker: true }],
  prompt_order: [
    { character_id: 100000, extra: "slot", order: [{ identifier: "a", enabled: true, extra: 1 }, { identifier: "chatHistory", enabled: true }] },
    { character_id: 100001, order: [{ identifier: "missing", enabled: false }, { identifier: "a", enabled: false }, { identifier: "a", enabled: true }] },
  ], extensions: { future: [1,2] },
});
it("copies ordinary prompts and all references with new identity while preserving unknown fields", () => {
  const original = fixture();
  const next = copyPrompt(original, "a", "copy");
  expect(next.prompts[1]).toEqual({ identifier: "copy", name: "A 副本", content: "🌙", unknown: { keep: true } });
  expect(next.prompt_order[0].order[1]).toEqual({ identifier: "copy", enabled: true, extra: 1 });
  expect(next.prompt_order[1].order.map(i => i.identifier)).toEqual(["missing", "a", "copy", "a", "copy"]);
  expect(original.prompts).toHaveLength(2);
  expect(next.extensions).toEqual(original.extensions);
});
it("deletes every reference, preserving unrelated and unknown slot data", () => {
  const next = deletePrompt(fixture(), "a");
  expect(next.prompts.map(p => p.identifier)).toEqual(["chatHistory"]);
  expect(next.prompt_order[0]).toEqual({ character_id: 100000, extra: "slot", order: [{ identifier: "chatHistory", enabled: true }] });
  expect(next.prompt_order[1].order).toEqual([{ identifier: "missing", enabled: false }]);
});
it("adds enabled prompts to existing slots and creates a slot if missing", () => {
  const next = addPrompt(fixture(), "new");
  expect(next.prompt_order.map(s => s.order.at(-1))).toEqual([{ identifier: "new", enabled: true }, { identifier: "new", enabled: true }]);
  expect(addPrompt({ prompts: [{ identifier: "old", enabled: false }], prompt_order: [] }, "new").prompt_order).toEqual([
    { character_id: 100001, order: [{ identifier: "old", enabled: false }, { identifier: "new", enabled: true }] },
  ]);
});
it("toggles prompt and all references, reorders only the selected slot", () => {
  const next = setPromptEnabled(fixture(), "a", false);
  expect(next.prompts[0].enabled).toBe(false);
  expect(next.prompt_order.flatMap(s => s.order).filter(i => i.identifier === "a").every(i => i.enabled === false)).toBe(true);
  const moved = movePromptOrder(next, 0, 1, -1);
  expect(moved.prompt_order[0].order.map(i => i.identifier)).toEqual(["chatHistory", "a"]);
  expect(moved.prompt_order[1]).toEqual(next.prompt_order[1]);
  expect(movePromptOrder(next, 0, 0, -1)).toEqual(next);
});
it("rejects duplicate identifiers, missing sources and dynamic marker copies", () => {
  expect(() => addPrompt(fixture(), "a")).toThrow();
  expect(() => copyPrompt(fixture(), "missing", "new")).toThrow();
  expect(() => copyPrompt(fixture(), "chatHistory", "new")).toThrow("动态");
});
