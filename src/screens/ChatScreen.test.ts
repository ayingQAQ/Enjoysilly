import { describe, expect, it } from "vitest";

import {
  createChatImportDatabaseOptions,
  createChatSaveSnapshotInput,
  createImportedChatScreenState,
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

  it("preserves imported chat metadata when creating a save snapshot input", () => {
    const messages: ChatMessageLine[] = [];
    const metadata = {
      user_name: "旧用户",
      character_name: "旧角色",
      create_date: "2026-07-05@12h00m00s",
      chat_metadata: {
        imported: true,
      },
      unknown_header_field: "keep",
    };

    const result = createChatSaveSnapshotInput({
      activeCharacter: createLocalChatCharacter({
        name: "新角色",
        description: "local",
      }),
      chatMetadata: metadata,
      messages,
      selectedCharacterId: "__local_character__",
      userName: "新用户",
    });

    expect(result.metadata).toEqual(metadata);
    expect(result.metadata).not.toBe(metadata);
    expect(result.metadata?.chat_metadata).not.toBe(metadata.chat_metadata);
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

  it("binds imported JSONL chats only when an imported character is selected", () => {
    expect(createChatImportDatabaseOptions("__local_character__")).toEqual({
      characterId: undefined,
    });
    expect(createChatImportDatabaseOptions("character-1")).toEqual({
      characterId: "character-1",
    });
  });

  it("creates imported chat screen state from ST JSONL metadata", () => {
    const chat = {
      metadata: {
        user_name: "  见山  ",
        character_name: "  林黛玉  ",
        create_date: "2026-07-05@12h00m00s",
        chat_metadata: {
          keep: true,
        },
      },
      messages: [
        {
          name: "林黛玉",
          mes: "你来了。",
          swipe_id: 0,
          swipes: ["你来了。"],
          extra: {
            unknown: true,
          },
          custom_message_field: "keep",
        },
      ],
    };

    const state = createImportedChatScreenState({
      chat,
      selectedCharacterId: "__local_character__",
      storedId: "chat-1",
      storedName: "导入对话",
    });

    expect(state).toEqual({
      messages: chat.messages,
      userName: "见山",
      characterName: "林黛玉",
      metadata: chat.metadata,
      loadedArchiveId: "chat-1",
      loadedArchiveName: "导入对话",
    });
    expect(state.messages).not.toBe(chat.messages);
    expect(state.messages[0]).not.toBe(chat.messages[0]);
    expect(state.metadata).not.toBe(chat.metadata);
    expect(state.metadata.chat_metadata).not.toBe(chat.metadata.chat_metadata);
  });

  it("keeps imported character selection when loading a JSONL chat", () => {
    const state = createImportedChatScreenState({
      chat: {
        metadata: {
          user_name: "  ",
          character_name: "文件内角色",
        },
        messages: [],
      },
      selectedCharacterId: "character-1",
      storedId: "chat-1",
      storedName: "导入对话",
    });

    expect(state.userName).toBe("User");
    expect(state.characterName).toBeUndefined();
  });
});
