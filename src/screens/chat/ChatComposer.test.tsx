// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { ChatComposer } from "./ChatComposer";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("prevents input being overwritten while a draft or archive is loading", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ChatComposer canSend={false} disabled inputText="" isStreaming={false}
      formRef={createRef()} quickReplySets={[]} statusText="正在恢复" onAppendQuickReply={() => {}}
      onInputChange={() => {}} onStop={() => {}} onSubmit={() => {}} />));
    expect(container.querySelector("textarea")?.disabled).toBe(true);
  } finally { act(() => root.unmount()); }
});
