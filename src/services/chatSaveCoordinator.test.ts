import { describe, expect, it } from "vitest";
import { ChatSaveCoordinator } from "./chatSaveCoordinator";
import { createStoredChatSnapshot, type SaveChatSnapshotToDatabaseInput } from "./chatPersistence";

const snapshot = (text: string): SaveChatSnapshotToDatabaseInput => ({
  userName: "用户", characterName: "角色", messages: [{ name: "用户", mes: text, is_user: true }],
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

describe("chat save coordinator", () => {
  it("serializes writes and keeps one archive identity for a new conversation", async () => {
    const gate = deferred();
    const writes: SaveChatSnapshotToDatabaseInput[] = [];
    const coordinator = new ChatSaveCoordinator(async input => {
      writes.push(input);
      if (writes.length === 1) await gate.promise;
      return createStoredChatSnapshot(input);
    });
    const first = coordinator.save(snapshot("first"));
    const second = coordinator.save(snapshot("second"));
    await Promise.resolve();
    expect(writes).toHaveLength(1);
    gate.resolve();
    const [a, b] = await Promise.all([first, second]);
    expect(writes.map(x => x.messages[0].mes)).toEqual(["first", "second"]);
    expect(a.stored.id).toBe(b.stored.id);
    expect(a.isCurrent()).toBe(false);
    expect(b.isCurrent()).toBe(true);
  });

  it("does not acknowledge an old session after switching away and back", async () => {
    const gate = deferred();
    const coordinator = new ChatSaveCoordinator(async input => {
      await gate.promise;
      return createStoredChatSnapshot(input);
    });
    coordinator.beginSession("archive-a");
    const saving = coordinator.save(snapshot("old"));
    coordinator.beginSession("archive-b");
    coordinator.beginSession("archive-a");
    gate.resolve();
    const result = await saving;
    expect(result.stored.id).toBe("archive-a");
    expect(result.isCurrent()).toBe(false);
  });

  it("allows explicit retry after failure without poisoning the queue or changing identity", async () => {
    let attempts = 0;
    const ids: (string | undefined)[] = [];
    const coordinator = new ChatSaveCoordinator(async input => {
      ids.push(input.id);
      if (++attempts === 1) throw new Error("quota");
      return createStoredChatSnapshot(input);
    });
    await expect(coordinator.save(snapshot("retry"))).rejects.toThrow("quota");
    const result = await coordinator.save(snapshot("retry"));
    expect(result.isCurrent()).toBe(true);
    expect(ids[0]).toBe(ids[1]);
  });

  it("captures message data before queued work starts", async () => {
    const coordinator = new ChatSaveCoordinator(async input => createStoredChatSnapshot(input));
    const input = snapshot("captured");
    const saving = coordinator.save(input);
    input.messages[0].mes = "mutated";
    expect((await saving).stored.payload.messages[0].mes).toBe("captured");
  });
});
