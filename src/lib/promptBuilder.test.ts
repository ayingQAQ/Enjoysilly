import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";
import type { NativeWorldInfoEntry } from "../types/worldinfo";
import { importCharacterCardFromBytes } from "./cardIO";
import { parseChatCompletionPresetJson } from "./presetIO";
import { buildChatCompletionMessages } from "./promptBuilder";

const fixturesDir = join(process.cwd(), "test-fixtures");

function createCharacter(overrides: Partial<CharacterCard["data"]> = {}): CharacterCard {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: "Alice",
      description: "A careful archivist.",
      personality: "Precise and calm.",
      scenario: "A quiet library.",
      mes_example: "<START>\nAlice: Hello.",
      post_history_instructions: "Stay in character.",
      ...overrides,
    },
  };
}

function createPreset(): ChatCompletionPreset {
  return {
    prompts: [
      {
        identifier: "main",
        name: "Main",
        role: "system",
        content: "You are {{char}} talking to {{user}}.",
      },
      {
        identifier: "disabledPrompt",
        role: "system",
        content: "Should not appear.",
        enabled: false,
      },
      {
        identifier: "charDescription",
        role: "system",
        marker: true,
      },
      {
        identifier: "personaDescription",
        role: "system",
        marker: true,
      },
      {
        identifier: "chatHistory",
        role: "user",
        marker: true,
      },
      {
        identifier: "worldInfoBefore",
        role: "system",
        marker: true,
      },
      {
        identifier: "worldInfoAfter",
        role: "system",
        marker: true,
      },
      {
        identifier: "unknownMarker",
        role: "system",
        marker: true,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "main", enabled: true },
          { identifier: "disabledPrompt", enabled: true },
          { identifier: "charDescription", enabled: true },
          { identifier: "personaDescription", enabled: true },
          { identifier: "chatHistory", enabled: true },
          { identifier: "worldInfoBefore", enabled: false },
          { identifier: "worldInfoAfter", enabled: false },
          { identifier: "missingPrompt", enabled: true },
          { identifier: "unknownMarker", enabled: true },
        ],
      },
    ],
  };
}

function loadRealPresetFixture(): ChatCompletionPreset {
  const fileName = readdirSync(fixturesDir).find((name) =>
    name.endsWith(".json"),
  );

  if (!fileName) {
    throw new Error("Missing JSON preset fixture.");
  }

  return parseChatCompletionPresetJson(
    readFileSync(join(fixturesDir, fileName), "utf8"),
  );
}

function loadRealCharacterFixture(): CharacterCard {
  const fileName = readdirSync(fixturesDir).find((name) =>
    name.toLowerCase().endsWith(".png"),
  );

  if (!fileName) {
    throw new Error("Missing PNG character fixture.");
  }

  return importCharacterCardFromBytes(
    readFileSync(join(fixturesDir, fileName)),
    fileName,
  ).card;
}

describe("prompt builder", () => {
  it("builds ordered messages from enabled prompt_order entries", () => {
    const messages = buildChatCompletionMessages({
      preset: createPreset(),
      character: createCharacter(),
      userName: "Tester",
      personaDescription: "Tester likes concise answers.",
      chatHistory: "Tester: Hi\nAlice: Hello",
      worldInfoBefore: "Should not appear because order item is disabled.",
    });

    expect(messages).toEqual([
      {
        role: "system",
        content: "You are Alice talking to Tester.",
      },
      {
        role: "system",
        content: "A careful archivist.",
      },
      {
        role: "system",
        content: "Tester likes concise answers.",
      },
      {
        role: "user",
        content: "Tester: Hi\nAlice: Hello",
      },
    ]);
  });

  it("falls back to enabled prompt list when prompt_order has no usable slot", () => {
    const preset = createPreset();
    preset.prompt_order = [];

    const messages = buildChatCompletionMessages({
      preset,
      character: createCharacter({ nickname: "Al" }),
      userName: "Tester",
    });

    expect(messages[0]).toEqual({
      role: "system",
      content: "You are Alice talking to Tester.",
    });
    expect(messages.map((message) => message.content)).not.toContain(
      "Should not appear.",
    );
  });

  it("does not mutate source preset or character payloads", () => {
    const preset = createPreset();
    const character = createCharacter();
    const originalPreset = structuredClone(preset);
    const originalCharacter = structuredClone(character);

    buildChatCompletionMessages({
      preset,
      character,
      userName: "Tester",
      personaDescription: "Persona",
    });

    expect(preset).toEqual(originalPreset);
    expect(character).toEqual(originalCharacter);
  });

  it("injects scanned world info into before and after markers", () => {
    const preset = createPreset();
    preset.prompt_order[0].order = [
      { identifier: "worldInfoBefore", enabled: true },
      { identifier: "worldInfoAfter", enabled: true },
    ];

    const worldInfoEntries: NativeWorldInfoEntry[] = [
      {
        key: ["library"],
        content: "Before lore",
        order: 2,
        position: 0,
      },
      {
        key: ["library"],
        content: "After lore",
        order: 1,
        position: 1,
      },
      {
        key: ["missing"],
        content: "Should not appear",
        order: 0,
        position: 0,
      },
    ];

    const messages = buildChatCompletionMessages({
      preset,
      character: createCharacter(),
      worldInfoEntries,
      worldInfoScanMessages: ["The library is open."],
    });

    expect(messages).toEqual([
      {
        role: "system",
        content: "Before lore",
      },
      {
        role: "system",
        content: "After lore",
      },
    ]);
  });

  it("keeps explicit world info strings ahead of scanned results", () => {
    const preset = createPreset();
    preset.prompt_order[0].order = [
      { identifier: "worldInfoBefore", enabled: true },
    ];

    const messages = buildChatCompletionMessages({
      preset,
      character: createCharacter(),
      worldInfoBefore: "Manual world info",
      worldInfoEntries: [
        {
          key: ["library"],
          content: "Scanned world info",
          position: 0,
        },
      ],
      worldInfoScanMessages: ["library"],
    });

    expect(messages).toEqual([
      {
        role: "system",
        content: "Manual world info",
      },
    ]);
  });

  it("builds messages from real preset and character fixtures", () => {
    const preset = loadRealPresetFixture();
    const character = loadRealCharacterFixture();

    const messages = buildChatCompletionMessages({
      preset,
      character,
      userName: "User",
      personaDescription: "A fixture persona.",
      chatHistory: "User: Hello",
      worldInfoBefore: "Before world info.",
      worldInfoAfter: "After world info.",
    });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((message) => message.content.includes(character.data.name)))
      .toBe(true);
    expect(JSON.stringify(preset.extensions)).toContain("regex_scripts");
  });

  it("applies regexScripts to assembled message contents", () => {
    const messages = buildChatCompletionMessages({
      preset: createPreset(),
      character: createCharacter(),
      userName: "Tester",
      personaDescription: "Tester likes concise answers.",
      chatHistory: "Tester: Hi\nAlice: Hello",
      regexScripts: [
        {
          findRegex: "Tester",
          replaceString: "User",
          placement: [5],
          promptOnly: true,
        },
        {
          findRegex: "careful",
          replaceString: "meticulous",
          placement: [5],
          promptOnly: true,
        },
      ],
    });

    expect(messages).toEqual([
      { role: "system", content: "You are Alice talking to User." },
      { role: "system", content: "A meticulous archivist." },
      { role: "system", content: "User likes concise answers." },
      { role: "user", content: "User: Hi\nAlice: Hello" },
    ]);
  });

  it("skips disabled regex scripts during prompt building", () => {
    const messages = buildChatCompletionMessages({
      preset: createPreset(),
      character: createCharacter(),
      userName: "Tester",
      regexScripts: [
        {
          findRegex: "Tester",
          replaceString: "User",
          disabled: true,
          placement: [5],
          promptOnly: true,
        },
        {
          findRegex: "Alice",
          replaceString: "Bob",
          placement: [5],
          promptOnly: true,
        },
      ],
    });

    expect(messages[0].content).toBe("You are Bob talking to Tester.");
  });

  it("does not apply user, AI output, or markdown-only regex scripts to prompt messages", () => {
    const messages = buildChatCompletionMessages({
      preset: createPreset(),
      character: createCharacter(),
      userName: "Tester",
      personaDescription: "Tester likes concise answers.",
      chatHistory: "Tester: Hi\nAlice: Hello",
      regexScripts: [
        {
          findRegex: "Tester",
          replaceString: "User",
          placement: [1],
        },
        {
          findRegex: "Alice",
          replaceString: "Bot",
          placement: [2],
        },
        {
          findRegex: "careful",
          replaceString: "visible-only",
          markdownOnly: true,
          placement: [5],
          promptOnly: true,
        },
      ],
    });

    expect(messages).toEqual([
      { role: "system", content: "You are Alice talking to Tester." },
      { role: "system", content: "A careful archivist." },
      { role: "system", content: "Tester likes concise answers." },
      { role: "user", content: "Tester: Hi\nAlice: Hello" },
    ]);
  });

  it("returns unchanged messages when regexScripts is empty", () => {
    const messagesWithoutRegex = buildChatCompletionMessages({
      preset: createPreset(),
      character: createCharacter(),
      userName: "Tester",
    });

    const messagesWithEmpty = buildChatCompletionMessages({
      preset: createPreset(),
      character: createCharacter(),
      userName: "Tester",
      regexScripts: [],
    });

    expect(messagesWithEmpty).toEqual(messagesWithoutRegex);
  });

  it("preserves source regexScripts immutability", () => {
    const scripts = [
      { findRegex: "Tester", replaceString: "User" },
    ];
    const originalScripts = structuredClone(scripts);

    buildChatCompletionMessages({
      preset: createPreset(),
      character: createCharacter(),
      userName: "Tester",
      regexScripts: scripts,
    });

    expect(scripts).toEqual(originalScripts);
  });

  it("applies real fixture regex scripts from preset extensions to prompt messages", () => {
    const preset = loadRealPresetFixture();
    const character = loadRealCharacterFixture();

    const messages = buildChatCompletionMessages({
      preset,
      character,
      userName: "User",
      personaDescription: "A fixture persona.",
      chatHistory: "User: Hello",
      worldInfoBefore: "Before world info.",
      worldInfoAfter: "After world info.",
      regexScripts: preset.extensions?.regex_scripts?.filter(
        (script): script is typeof preset.extensions.regex_scripts[number] =>
          typeof script === "object" && script !== null && script.disabled !== true,
      ) ?? [],
    });

    expect(messages.length).toBeGreaterThan(0);
    expect(JSON.stringify(preset.extensions)).toContain("regex_scripts");
  });
});
