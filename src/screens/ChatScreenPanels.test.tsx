// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatMessageLine } from "../types/chat";
import { ChatBubble } from "./ChatScreenPanels";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  for (const container of containers.splice(0)) {
    container.remove();
  }
});

describe("ChatBubble HTML documents", () => {
  it("keeps the iframe scriptless while forwarding safe card actions", async () => {
    const onHtmlCardAction = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    containers.push(container);

    const root = createRoot(container);
    roots.push(root);
    const message: ChatMessageLine = {
      name: "角色",
      is_user: false,
      is_name: true,
      send_date: "2026-07-10T22:00:00.000Z",
      mes: `<!DOCTYPE html><html><head><style>.scenario-card { color: red; }</style></head><body><div class="scenario-card"><h3>启程</h3><p>进入森林</p></div></body></html>`,
    };

    await act(async () => {
      root.render(
        <ChatBubble
          disabled={false}
          message={message}
          onDelete={vi.fn()}
          onEdit={vi.fn()}
          onHtmlCardAction={onHtmlCardAction}
          onReroll={vi.fn()}
          onSwipeNext={vi.fn()}
          onSwipePrevious={vi.fn()}
        />,
      );
    });

    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(frame?.getAttribute("srcdoc")).toContain("Content-Security-Policy");
    expect(frame?.getAttribute("srcdoc")).not.toContain("<script");

    const frameDocument = frame?.contentDocument;
    expect(frameDocument).not.toBeNull();
    if (!frame || !frameDocument) {
      return;
    }

    frameDocument.body.innerHTML =
      '<div class="scenario-card"><h3>启程</h3><p>进入森林</p></div>';
    await act(async () => {
      frame.dispatchEvent(new Event("load"));
    });

    const card = frameDocument.querySelector<HTMLElement>(".scenario-card");
    expect(card).not.toBeNull();
    await act(async () => {
      card?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(onHtmlCardAction).toHaveBeenCalledWith({
      action: "setDraft",
      text: "启程\n\n进入森林",
    });
  });
});
