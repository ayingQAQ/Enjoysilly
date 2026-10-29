// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PageErrorBoundary } from "./PageErrorBoundary";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("shows a recoverable error instead of a blank page and recovers on section change", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const node = document.createElement("div");
  const root = createRoot(node);
  const suppressExpected = (event: ErrorEvent) => { if (event.message.includes("chunk unavailable")) event.preventDefault(); };
  window.addEventListener("error", suppressExpected);
  function Broken(): never { throw new Error("chunk unavailable"); }
  try {
    await act(async () => root.render(<PageErrorBoundary key="bad"><Broken /></PageErrorBoundary>));
    expect(node.querySelector('[role="alert"]')?.textContent).toContain("页面加载失败");
    expect(node.querySelector("button")?.textContent).toContain("重新加载");
    await act(async () => root.render(<PageErrorBoundary key="good"><p>工作台恢复</p></PageErrorBoundary>));
    expect(node.textContent).toBe("工作台恢复");
  } finally { act(() => root.unmount()); log.mockRestore(); window.removeEventListener("error", suppressExpected); }
});
