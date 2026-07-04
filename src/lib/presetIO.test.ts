import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  encodeChatCompletionPresetJson,
  extractRegexScripts,
  isChatCompletionPreset,
  parseChatCompletionPresetJson,
  serializeChatCompletionPresetJson,
} from "./presetIO";

const fixturesDir = join(process.cwd(), "test-fixtures");

function loadPresetFixture(): unknown {
  const fileName = readdirSync(fixturesDir).find((name) =>
    name.endsWith(".json"),
  );

  if (!fileName) {
    throw new Error("Missing JSON preset fixture.");
  }

  return JSON.parse(readFileSync(join(fixturesDir, fileName), "utf8"));
}

describe("SillyTavern preset parsing", () => {
  it("identifies the real Chat Completion preset fixture", () => {
    const preset = loadPresetFixture();

    expect(isChatCompletionPreset(preset)).toBe(true);

    if (!isChatCompletionPreset(preset)) {
      throw new Error("Fixture was not recognized as a Chat Completion preset.");
    }

    expect(Object.keys(preset)).toHaveLength(47);
    expect(preset.prompts).toHaveLength(50);
    expect(preset.prompt_order).toHaveLength(2);
    expect(preset.prompt_order[1].order).toHaveLength(39);
  });

  it("extracts regex scripts from preset extensions without executing them", () => {
    const preset = loadPresetFixture();

    expect(isChatCompletionPreset(preset)).toBe(true);

    if (!isChatCompletionPreset(preset)) {
      throw new Error("Fixture was not recognized as a Chat Completion preset.");
    }

    const scripts = extractRegexScripts(preset);

    expect(scripts).toHaveLength(10);
    expect(scripts[0]).toMatchObject({
      scriptName: "对ai隐藏思维连",
      promptOnly: true,
    });
  });

  it("round-trips preset JSON while preserving unknown extension data", () => {
    const source = loadPresetFixture();
    const json = JSON.stringify(source);
    const preset = parseChatCompletionPresetJson(json);
    const serialized = serializeChatCompletionPresetJson(preset);
    const encoded = encodeChatCompletionPresetJson(preset);

    expect(JSON.parse(serialized)).toEqual(source);
    expect(new TextDecoder().decode(encoded)).toBe(serialized);
    expect(preset.extensions?.tavern_helper).toBeDefined();
    expect(preset.extensions?.SPreset).toBeDefined();
  });

  it("rejects TavernHelper script preset JSON", () => {
    const scriptPreset = {
      id: "third-party-script",
      name: "脚本预设",
      content: "injectScript(() => {})",
      info: "<p>第三方脚本</p>",
      buttons: [],
      data: {},
    };

    expect(() =>
      parseChatCompletionPresetJson(JSON.stringify(scriptPreset)),
    ).toThrow("JSON is not a supported SillyTavern Chat Completion preset.");
  });

  it("rejects standalone regex script collection JSON", () => {
    const regexCollection = {
      id: "regex-only",
      scriptName: "独立正则",
      findRegex: "/hello/g",
      replaceString: "world",
    };

    expect(() =>
      parseChatCompletionPresetJson(JSON.stringify(regexCollection)),
    ).toThrow("JSON is not a supported SillyTavern Chat Completion preset.");
  });
});
