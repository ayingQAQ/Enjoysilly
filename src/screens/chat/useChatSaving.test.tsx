// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatSaveCoordinator } from "../../services/chatSaveCoordinator";
import { createStoredChatSnapshot, type SaveChatSnapshotToDatabaseInput } from "../../services/chatPersistence";
import { useChatSaving } from "./useChatSaving";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
afterEach(() => { if (root) act(() => root.unmount()); vi.useRealTimers(); });
const snapshot = (mes: string): SaveChatSnapshotToDatabaseInput => ({
  userName: "U", characterName: "C", messages: [{ name: "U", mes }],
});

describe("chat saving lifecycle", () => {
  it("does not mark newer content saved and blocks same-tick duplicate manual saves", async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const writes: string[] = [];
    const coordinator = new ChatSaveCoordinator(async input => {
      writes.push(input.messages[0].mes);
      await gate;
      return createStoredChatSnapshot(input);
    });
    const acknowledgements: boolean[] = [];
    let current = snapshot("one");
    let api!: ReturnType<typeof useChatSaving>;
    function Harness() {
      api = useChatSaving({ coordinator, snapshot: current, dirty: false, paused: false,
        onSaved: (_stored, latest) => { acknowledgements.push(latest); }, onError: () => {} });
      return null;
    }
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Harness />));
    let saving!: Promise<boolean>;
    act(() => { saving = api.save(); void api.save(); });
    current = snapshot("two");
    await act(async () => root.render(<Harness />));
    await act(async () => { release(); await saving; });
    expect(writes).toEqual(["one"]);
    expect(acknowledgements).toEqual([false]);
  });

  it("suppresses old-session success and reports failure without automatic retry loops", async () => {
    vi.useFakeTimers();
    let reject!: (error: Error) => void;
    const gate = new Promise<never>((_, r) => { reject = r; });
    const coordinator = new ChatSaveCoordinator(() => gate);
    const errors: string[] = [];
    let api!: ReturnType<typeof useChatSaving>;
    const current = snapshot("one");
    function Harness() {
      api = useChatSaving({ coordinator, snapshot: current, dirty: true, paused: false,
        onSaved: () => { throw new Error("stale success"); }, onError: e => errors.push(String(e)) });
      return null;
    }
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Harness />));
    await act(async () => { vi.advanceTimersByTime(800); });
    coordinator.beginSession("another");
    await act(async () => { reject(new Error("old failure")); });
    expect(errors).toEqual([]);
    expect(api.isSaving).toBe(false);
  });
});
