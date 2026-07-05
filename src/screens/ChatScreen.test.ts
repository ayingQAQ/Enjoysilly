import { describe, expect, it } from "vitest";

import {
  createLocalChatCharacter,
  createMinimalChatPreset,
  selectChatCharacterPayload,
  selectChatPresetPayload,
} from "./ChatScreen";

describe("ChatScreen helpers", () => {
  it("creates a minimal native chat completion preset", () => {
    const preset = createMinimalChatPreset();

    expect(preset.stream_openai).toBe(true);
    expect(preset.prompts.map((prompt) => prompt.identifier)).toEqual([
      "main",
      "personaDescription",
      "charDescription",
      "chatHistory",
    ]);
    expect(preset.prompt_order[0]?.order).toEqual([
      { identifier: "main", enabled: true },
      { identifier: "personaDescription", enabled: true },
      { identifier: "charDescription", enabled: true },
      { identifier: "chatHistory", enabled: true },
    ]);
    expect(preset.extensions).toBeUndefined();
  });

  it("normalizes the local debug character without adding external payload fields", () => {
    const character = createLocalChatCharacter({
      name: "  ",
      description: "  测试角色  ",
    });

    expect(character.spec).toBe("chara_card_v2");
    expect(character.spec_version).toBe("2.0");
    expect(character.data.name).toBe("my_silly 助手");
    expect(character.data.description).toBe("测试角色");
    expect(character.data.extensions).toEqual({});
  });

  it("prefers imported character and preset payloads when they are selected", () => {
    const fallbackCharacter = createLocalChatCharacter({
      name: "fallback",
      description: "fallback",
    });
    const importedCharacter = createLocalChatCharacter({
      name: "imported",
      description: "imported",
    });
    const fallbackPreset = createMinimalChatPreset();
    const importedPreset = {
      ...createMinimalChatPreset(),
      temperature: 0.2,
    };

    expect(selectChatCharacterPayload(importedCharacter, fallbackCharacter)).toBe(
      importedCharacter,
    );
    expect(selectChatCharacterPayload(undefined, fallbackCharacter)).toBe(
      fallbackCharacter,
    );
    expect(selectChatPresetPayload(importedPreset, fallbackPreset)).toBe(
      importedPreset,
    );
    expect(selectChatPresetPayload(undefined, fallbackPreset)).toBe(
      fallbackPreset,
    );
  });
});
