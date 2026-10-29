// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CharacterEditorDrawer } from "./characters/CharacterEditorDrawer";
import { WorldInfoEditorDrawer } from "./worlds/WorldInfoEditorDrawer";
import { createCharacterDetailSummary } from "../services/characterDetails";
import { createWorldInfoDetailSummary } from "../services/worldInfoDetails";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
HTMLDialogElement.prototype.showModal = function () { this.open = true; };
HTMLDialogElement.prototype.close = function () { this.open = false; };
describe("editor save isolation", () => {
  it.each(["character", "world"])("locks %s inputs until the pending save completes", async kind => {
    const container = document.createElement("div");
    const root = createRoot(container);
    let resolve!: () => void;
    const pending = new Promise<void>(r => { resolve = r; });
    let calls = 0;
    const onSave = () => { calls++; return pending; };
    try {
      await act(async () => root.render(kind === "character"
        ? <CharacterEditorDrawer detail={createCharacterDetailSummary({ id: "c", name: "C", createdAt: "a", updatedAt: "a", payload: { spec: "chara_card_v2", spec_version: "2.0", data: { name: "C" } } })} onClose={() => {}} onSave={onSave} />
        : <WorldInfoEditorDrawer detail={createWorldInfoDetailSummary({ id: "w", name: "W", createdAt: "a", updatedAt: "a", payload: { entries: {} } })} onClose={() => {}} onSave={onSave} />));
      const input = container.querySelector<HTMLInputElement>('input:not([type="file"])')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "changed");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      const save = [...container.querySelectorAll("button")].find(b => /保存角色卡|保存世界书/.test(b.textContent ?? ""))!;
      act(() => { save.click(); save.click(); });
      expect(calls).toBe(1);
      expect(input.matches(":disabled")).toBe(true);
      await act(async () => resolve());
      expect(input.matches(":disabled")).toBe(false);
    } finally { act(() => root.unmount()); }
  });
});
