import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeAssetCompatibility } from "./assetCompatibility";
import { decodeCharacterCardFromPng } from "./png";
import { parseChatCompletionPresetJson, serializeChatCompletionPresetJson } from "./presetIO";

describe("asset compatibility tiers", () => {
  it("explains 修仙世界 script-dependent UI without changing its data", () => {
    const card = decodeCharacterCardFromPng(readFileSync("test-fixtures/修仙世界.png"));
    const before = JSON.stringify(card);
    const report = analyzeAssetCompatibility("character", card);
    expect(report.some(f => f.code === "script-runtime" && f.level === "not-executed")).toBe(true);
    expect(report.some(f => f.code === "html" && f.level === "partial")).toBe(true);
    expect(JSON.stringify(card)).toBe(before);
  });
  it("keeps real preset unknown extensions through report and export", () => {
    const preset = parseChatCompletionPresetJson(readFileSync("test-fixtures/【DarkSide-小猫之神】v2test.json", "utf8"));
    const before = structuredClone(preset);
    const report = analyzeAssetCompatibility("preset", preset);
    expect(report.some(f => f.code === "script-runtime")).toBe(true);
    expect(report.some(f => f.code === "prompt-injection" && f.level === "retained")).toBe(true);
    expect(JSON.parse(serializeChatCompletionPresetJson(preset))).toEqual(before);
  });
  it("distinguishes basic support, unknown preservation and ignored fields", () => {
    const report = analyzeAssetCompatibility("world", { entries: { a: { key: ["月"], content: "🌙", sticky: 2, position: 7, selective: true } }, extensions: { future: 42 } });
    expect(report.some(f => f.code === "world-basic" && f.level === "full")).toBe(true);
    expect(report.some(f => f.code === "world-limits" && f.level === "partial")).toBe(true);
    expect(report.some(f => f.code === "extensions" && f.level === "retained")).toBe(true);
    expect(report.find(f => f.code === "world-limits")?.detail).toMatch(/sticky/);
  });
  it("flags unsupported markers and script signals without executing them", () => {
    const report = analyzeAssetCompatibility("preset", { prompts: [{ identifier: "unknown", marker: true }], prompt_order: [], extensions: { mvu: { content: "throw new Error('never execute')" } } });
    expect(report.some(f => f.code === "unknown-marker" && f.level === "retained")).toBe(true);
    expect(report.some(f => f.code === "script-runtime" && f.level === "not-executed")).toBe(true);
  });
});
