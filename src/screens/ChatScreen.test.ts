import { describe, expect, it } from "vitest";

import {
  createChatSaveSnapshotInput,
  createLocalChatCharacter,
  createMinimalChatPreset,
  getChatArchiveFilterCharacterId,
  selectChatCharacterPayload,
  selectChatPresetPayload,
} from "./ChatScreen";
import type { ChatMessageLine } from "../types/chat";

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

  it("creates save snapshot input for an imported character", () => {
    const messages: ChatMessageLine[] = [
      {
        name: "User",
        is_user: true,
        send_date: "2026-07-05@12h00m01s",
        mes: "你好",
        swipe_id: 0,
        swipes: ["你好"],
      },
    ];
    const character = createLocalChatCharacter({
      name: "  导入角色  ",
      description: "imported",
    });

    expect(
      createChatSaveSnapshotInput({
        activeCharacter: character,
        messages,
        selectedCharacterId: "character-1",
        userName: "  测试用户  ",
      }),
    ).toEqual({
      messages,
      userName: "测试用户",
      characterName: "导入角色",
      characterId: "character-1",
    });
  });

  it("does not bind a character id for the local debug character", () => {
    const messages: ChatMessageLine[] = [];
    const character = createLocalChatCharacter({
      name: "  ",
      description: "local",
    });

    expect(
      createChatSaveSnapshotInput({
        activeCharacter: character,
        messages,
        selectedCharacterId: "__local_character__",
        userName: "  ",
      }),
    ).toEqual({
      messages,
      userName: "User",
      characterName: "my_silly 助手",
      characterId: undefined,
    });
  });

  it("filters chat archives only when an imported character is selected", () => {
    expect(getChatArchiveFilterCharacterId("__local_character__")).toBeUndefined();
    expect(getChatArchiveFilterCharacterId("character-1")).toBe("character-1");
  });
});
