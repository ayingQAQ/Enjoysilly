import { describe, expect, it } from "vitest";
import { scanWorldInfo, type WorldInfoScanOptions } from "./worldInfoScan";
import { replayTimedWorldInfo } from "./worldInfoTimed";
import type { ChatMessageLine } from "../types/chat";
const at = (turnIndex: number, previous?: ReturnType<typeof scanWorldInfo>): WorldInfoScanOptions => ({ diagnostics: true, enabledFeatures: { timedEffects: true }, runtimeState: { ...previous?.runtimeState, turnIndex } });
const msg = (mes: string, is_user: boolean): ChatMessageLine => ({ name: "N", mes, is_user, send_date: "date" });
describe("world timed effects", () => {
  it("holds sticky without keyword, then blocks cooldown and permits reactivation after expiry", () => {
    const entries = [{ key: ["moon"], content: "world", sticky: 3, cooldown: 2 }];
    const first = scanWorldInfo(entries, ["moon"], at(0));
    expect(first.runtimeState?.timedByEntryId?.["0"].stickyUntil).toBe(3);
    const sticky = scanWorldInfo(entries, ["none"], at(2, first));
    expect(sticky.before).toHaveLength(1);
    expect(sticky.diagnostics?.[0].attempts[0].reasons).toContain("sticky");
    const cooldown = scanWorldInfo(entries, ["moon"], at(3, sticky));
    expect(cooldown.before).toHaveLength(0);
    expect(cooldown.diagnostics?.[0].outcome).toBe("cooldown");
    expect(scanWorldInfo(entries, ["moon"], at(5, cooldown)).before).toHaveLength(1);
    expect(scanWorldInfo(entries, ["moon"], at(0, first)).runtimeState).toEqual(first.runtimeState);
  });
  it("honors portable delay and isolates duplicate ids, disabled entries and budget drops", () => {
    const entries = [{ id: 1, keys: ["moon"], content: "delayed", extensions: { delay: 2, sticky: 3 } }, { id: 1, keys: ["sun"], content: "other", extensions: { sticky: 3 } }];
    const first = scanWorldInfo(entries, ["moon"], at(0));
    expect(first.diagnostics?.[0].outcome).toBe("delay");
    const active = scanWorldInfo(entries, ["moon"], at(2, first));
    expect(scanWorldInfo(entries, ["none"], at(3, active)).before.map(e => e.content)).toEqual(["delayed"]);
    expect(scanWorldInfo([{ ...entries[0], enabled: false }], [], at(3, active)).before).toHaveLength(0);
    const rejected = scanWorldInfo(entries, ["moon"], { ...at(2), enabledFeatures: { timedEffects: true, tokenBudget: true }, tokenBudget: 0, estimateTokens: s => s.length });
    expect(rejected.runtimeState?.timedByEntryId).toEqual({});
  });
  it("replays current swipes and edited/branched histories without hidden persistent clocks", () => {
    const entries = [{ key: ["moon"], content: "world", sticky: 4, cooldown: 2, scanDepth: 1 }];
    const history = [msg("moon", true), msg("reply", false), msg("none", true)];
    const original = structuredClone(history);
    const first = replayTimedWorldInfo(entries, history, { diagnostics: true });
    expect(first.before).toHaveLength(1);
    expect(replayTimedWorldInfo(entries, structuredClone(history), { diagnostics: true })).toEqual(first);
    history[0].swipes = ["moon", "sun"]; history[0].swipe_id = 1;
    expect(replayTimedWorldInfo(entries, history, {}).before).toHaveLength(0);
    expect(replayTimedWorldInfo(entries, original.slice(0, 1), {}).before).toHaveLength(1);
    history[0].mes = "sun"; delete history[0].swipes;
    expect(replayTimedWorldInfo(entries, history, {}).before).toHaveLength(0);
  });
  it("keeps the same activation boundary when continuing an assistant response", () => {
    const entries = [{ key: ["moon"], content: "world", sticky: 4, scanDepth: 1 }];
    const before = replayTimedWorldInfo(entries, [msg("moon", true)], {});
    const continuation = replayTimedWorldInfo(entries, [msg("moon", true), msg("reply without keyword", false)], {});
    expect(continuation.before.map(e => e.content)).toEqual(["world"]);
    expect(continuation.runtimeState).toEqual(before.runtimeState);
  });
});
