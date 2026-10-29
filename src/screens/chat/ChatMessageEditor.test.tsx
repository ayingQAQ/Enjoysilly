// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { ChatMessageEditor } from "./ChatMessageEditor";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("keeps a failed edit visible with an error and supports Ctrl+Enter", async () => {
  // jsdom does not implement native modal top-layer APIs.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; } },
  });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ChatMessageEditor draft={{ index: 0, original: "old", text: "new\n🌙" }}
      onChange={() => {}} onClose={() => {}} onSave={async () => false} />));
    await act(async () => container.querySelector("textarea")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true })));
    expect(container.querySelector("textarea")?.value).toBe("new\n🌙");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("保存未完成");
  } finally { act(() => root.unmount()); }
});
