import { describe, expect, it } from "vitest";
import { scanWorldInfo } from "./worldInfoScan";

describe("world info execution explanations", () => {
  it("explains every source independently even with duplicate IDs", () => {
    const entries = [
      { uid: 1, key: [], content: "disabled", disable: true },
      { uid: 1, key: [], content: " " },
      { uid: 1, key: ["moon"], content: "miss" },
      { uid: 1, key: ["sun"], content: "hit" },
      { uid: 1, key: [], content: "always", constant: true },
    ];
    const original = structuredClone(entries);
    const result = scanWorldInfo(entries, ["sun"], { diagnostics: true });
    expect(result.diagnostics?.map(e => e.outcome)).toEqual(["disabled", "empty", "no-keyword", "selected", "selected"]);
    expect(result.diagnostics?.[3].attempts[0].matchedKeys).toEqual(["sun"]);
    expect(result.diagnostics?.[4].attempts[0].reasons).toEqual(["constant"]);
    expect(entries).toEqual(original);
    expect(scanWorldInfo(entries, ["sun"]).diagnostics).toBeUndefined();
  });
  it("records secondary rejection, probability rejection and actual random roll", () => {
    const result = scanWorldInfo([
      { key: ["sun"], keysecondary: ["moon"], selective: true, content: "secondary" },
      { key: ["sun"], useProbability: true, probability: 30, content: "chance" },
    ], ["sun"], { diagnostics: true, random: () => 0.4, enabledFeatures: { selective: true, probability: true } });
    expect(result.diagnostics?.map(e => e.outcome)).toEqual(["selective", "probability"]);
    expect(result.diagnostics?.[1].attempts[0].probabilityRoll).toBe(40);
  });
  it("reports recursion round and budget elimination including zero recursion depth", () => {
    const entries = [{ key: [], content: "moon", constant: true }, { key: ["moon"], content: "next", delayUntilRecursion: true }];
    const options = { diagnostics: true, enabledFeatures: { recursion: true, tokenBudget: true }, tokenBudget: 4, estimateTokens: (s: string) => s.length };
    const result = scanWorldInfo(entries, [], options);
    expect(result.diagnostics?.[1].attempts[0].round).toBe(1);
    expect(result.diagnostics?.[1].outcome).toBe("budget");
    expect(scanWorldInfo(entries, [], { ...options, tokenBudget: 0, recursionDepth: 0 }).before).toEqual([]);
  });
  it("reports inactive advanced fields without pretending they were applied", () => {
    const result = scanWorldInfo([{ key: ["sun"], content: "text", selective: true, useProbability: true, probability: 0, sticky: 3 }], ["sun"], { diagnostics: true });
    expect(result.before).toHaveLength(1);
    expect(result.diagnostics?.[0].notes.join(" ")).toMatch(/selective/);
    expect(result.diagnostics?.[0].notes.join(" ")).toMatch(/probability/);
    expect(result.diagnostics?.[0].notes.join(" ")).toMatch(/sticky/);
  });
});
