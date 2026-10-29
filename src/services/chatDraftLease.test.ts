import { describe, expect, it } from "vitest";
import { acquireChatDraftLease } from "./chatDraftLease";

function lockManager(): Pick<LockManager, "request"> {
  const held = new Set<string>();
  return { request: async (name: string, _options: unknown, callback: (lock: object | null) => Promise<void>) => {
    if (held.has(name)) return callback(null);
    held.add(name);
    try { await callback({ name }); } finally { held.delete(name); }
  } } as Pick<LockManager, "request">;
}
describe("chat draft ownership", () => {
  it("gives duplicated tabs separate keys while allowing reload to reclaim a released key", async () => {
    const locks = lockManager();
    const first = await acquireChatDraftLease("shared", locks);
    const duplicate = await acquireChatDraftLease("shared", locks);
    expect(first.id).toBe("shared");
    expect(duplicate.id).not.toBe(first.id);
    expect(duplicate.sourceId).toBe("shared");
    first.release();
    await Promise.resolve(); await Promise.resolve();
    const reloaded = await acquireChatDraftLease("shared", locks);
    expect(reloaded.id).toBe("shared");
    reloaded.release(); duplicate.release();
  });
  it("uses a new key when ownership locking is unavailable", async () => {
    const a = await acquireChatDraftLease("old", undefined);
    const b = await acquireChatDraftLease("old", undefined);
    expect(a.id).not.toBe(b.id);
    expect(a.sourceId).toBe("old");
  });
});
