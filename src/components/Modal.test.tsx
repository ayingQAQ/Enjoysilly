// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.restoreAllMocks());
it("blocks Escape while busy, delegates dirty close and restores opener focus", () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  const opener = document.createElement("button");
  const host = document.createElement("div");
  document.body.append(opener, host); opener.focus();
  const root = createRoot(host);
  const close = vi.fn();
  const render = (busy: boolean) => act(() => root.render(<Modal aria-label="测试" busy={busy} onRequestClose={close}><button>内容</button></Modal>));
  try {
    render(true);
    const dialog = host.querySelector("dialog")!;
    expect(dialog.open).toBe(true);
    const cancel = new Event("cancel", { cancelable: true });
    act(() => dialog.dispatchEvent(cancel));
    expect(cancel.defaultPrevented).toBe(true);
    expect(close).not.toHaveBeenCalled();
    render(false);
    act(() => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(close).toHaveBeenCalledTimes(1);
    host.querySelector("button")!.focus();
    act(() => root.unmount());
    expect(document.activeElement).toBe(opener);
  } finally { host.remove(); opener.remove(); }
});
