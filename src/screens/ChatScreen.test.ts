import { describe, expect, it } from "vitest";

import {
  appendQuickReplyToInput,
  createCharacterGreetingOptions,
  createChatDraftStatus,
  createGreetingChatMessage,
  createChatImportDatabaseOptions,
  createChatSaveSnapshotInput,
  createImportedChatScreenState,
  createLocalChatCharacter,
  createMinimalChatPreset,
  deleteChatMessageAt,
  extractCharacterRegexScripts,
  extractWorldInfoEntries,
  getChatArchiveFilterCharacterId,
  getLastAssistantMessageIndex,
  resolveDefaultWorldInfoEntries,
  selectChatCharacterPayload,
  selectChatPresetPayload,
  selectChatMessageSwipeAt,
  selectVisibleQuickReplySets,
  updateChatMessageTextAt,
} from "./chatScreenHelpers";
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

  it("appends quick reply text to input without merging separate replies", () => {
    expect(appendQuickReplyToInput("", "你好")).toBe("你好");
    expect(appendQuickReplyToInput("你好", "再见")).toBe("你好\n再见");
    expect(appendQuickReplyToInput("你好\n", "再见")).toBe("你好\n再见");
    expect(appendQuickReplyToInput("你好", "")).toBe("你好");
  });

  it("normalizes the local debug character without adding external payload fields", () => {
    const character = createLocalChatCharacter({
      name: "  ",
      description: "  测试角色  ",
    });

    expect(character.spec).toBe("chara_card_v2");
    expect(character.spec_version).toBe("2.0");
    expect(character.data.name).toBe("默认角色");
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

  it("extracts character embedded regex scripts with RP-Hub field aliases", () => {
    const character = createLocalChatCharacter({
      name: "regex character",
      description: "test",
    });

    character.data.extensions = {
      regex_scripts: [
        {
          name: "status renderer",
          regex: "状态栏:(.*)",
          replacement: "<div>$1</div>",
          enabled: false,
          placement: [2],
          markdownOnly: true,
        },
      ],
    };

    expect(extractCharacterRegexScripts(character)).toEqual([
      expect.objectContaining({
        scriptName: "status renderer",
        findRegex: "状态栏:(.*)",
        replaceString: "<div>$1</div>",
        disabled: true,
        placement: [2],
        markdownOnly: true,
      }),
    ]);
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
      characterName: "默认角色",
      characterId: undefined,
    });
  });

  it("filters chat archives only when an imported character is selected", () => {
    expect(getChatArchiveFilterCharacterId("__local_character__")).toBeUndefined();
    expect(getChatArchiveFilterCharacterId("character-1")).toBe("character-1");
  });

  it("creates greeting options from first_mes and alternate_greetings", () => {
    const character = createLocalChatCharacter({
      name: "林黛玉",
      description: "imported",
    });

    character.data.first_mes = "  {{user}}，你来了。 ";
    character.data.alternate_greetings = ["", "  另一个问候  "];

    expect(createCharacterGreetingOptions(character)).toEqual([
      "{{user}}，你来了。",
      "另一个问候",
    ]);
  });

  it("prefers V3 group-only greetings when requested", () => {
    const character = createLocalChatCharacter({
      name: "群聊角色",
      description: "imported",
    });

    character.data.first_mes = "普通问候";
    character.data.group_only_greetings = ["", "  群聊问候  "];

    expect(createCharacterGreetingOptions(character, { preferGroupOnly: true })).toEqual([
      "群聊问候",
    ]);
  });

  it("creates a ST-compatible greeting message with swipes and macro replacement", () => {
    const character = createLocalChatCharacter({
      name: "  林黛玉  ",
      description: "imported",
    });
    const before = structuredClone(character);

    character.data.first_mes = "{{user}}，你来了。";
    character.data.alternate_greetings = ["{{char}}在这里。"];

    const message = createGreetingChatMessage({
      character,
      greetingIndex: 1,
      now: new Date("2026-07-05T12:00:01"),
      userName: "  见山  ",
    });

    expect(message).toEqual({
      name: "林黛玉",
      is_user: false,
      send_date: "2026-07-05@12h00m01s",
      mes: "林黛玉在这里。",
      swipe_id: 1,
      swipes: ["见山，你来了。", "林黛玉在这里。"],
    });
    expect(character).toEqual({
      ...before,
      data: {
        ...before.data,
        first_mes: "{{user}}，你来了。",
        alternate_greetings: ["{{char}}在这里。"],
      },
    });
  });

  it("returns no greeting message when a character has no greetings", () => {
    expect(
      createGreetingChatMessage({
        character: createLocalChatCharacter({
          name: "无问候角色",
          description: "local",
        }),
        userName: "User",
      }),
    ).toBeNull();
  });

  it("updates the selected message swipe without mutating original messages", () => {
    const messages: ChatMessageLine[] = [
      {
        name: "User",
        is_user: true,
        mes: "保留",
      },
      {
        name: "角色",
        mes: "旧选中",
        swipe_id: 1,
        swipes: ["旧一", "旧选中"],
        extra: {
          keep: true,
        },
      },
    ];
    const before = structuredClone(messages);

    const updated = updateChatMessageTextAt(messages, 1, "新内容");

    expect(updated).toEqual([
      messages[0],
      {
        name: "角色",
        mes: "新内容",
        swipe_id: 1,
        swipes: ["旧一", "新内容"],
        extra: {
          keep: true,
        },
      },
    ]);
    expect(updated).not.toBe(messages);
    expect(updated[1]).not.toBe(messages[1]);
    expect(messages).toEqual(before);
  });

  it("creates a first swipe when editing a message without a valid swipe", () => {
    const messages: ChatMessageLine[] = [
      {
        name: "角色",
        mes: "旧内容",
        swipe_id: 9,
        swipes: ["旧一"],
        custom_message_field: "keep",
      },
    ];

    expect(updateChatMessageTextAt(messages, 0, "新内容")).toEqual([
      {
        name: "角色",
        mes: "新内容",
        swipe_id: 0,
        swipes: ["新内容"],
        custom_message_field: "keep",
      },
    ]);
  });

  it("deletes a message by index without mutating original messages", () => {
    const messages: ChatMessageLine[] = [
      { name: "User", is_user: true, mes: "第一条" },
      { name: "角色", mes: "第二条" },
      { name: "User", is_user: true, mes: "第三条" },
    ];
    const before = structuredClone(messages);

    expect(deleteChatMessageAt(messages, 1)).toEqual([
      messages[0],
      messages[2],
    ]);
    expect(messages).toEqual(before);
  });

  it("selects the next and previous message swipe without mutating messages", () => {
    const messages: ChatMessageLine[] = [
      {
        name: "角色",
        mes: "第二条",
        swipe_id: 1,
        swipes: ["第一条", "第二条", "第三条"],
        extra: {
          keep: true,
        },
      },
    ];
    const before = structuredClone(messages);

    expect(selectChatMessageSwipeAt(messages, 0, 1)).toEqual([
      {
        name: "角色",
        mes: "第三条",
        swipe_id: 2,
        swipes: ["第一条", "第二条", "第三条"],
        extra: {
          keep: true,
        },
      },
    ]);
    expect(selectChatMessageSwipeAt(messages, 0, -1)).toEqual([
      {
        name: "角色",
        mes: "第一条",
        swipe_id: 0,
        swipes: ["第一条", "第二条", "第三条"],
        extra: {
          keep: true,
        },
      },
    ]);
    expect(messages).toEqual(before);
  });

  it("wraps swipe selection and keeps messages without multiple swipes unchanged", () => {
    expect(
      selectChatMessageSwipeAt(
        [
          {
            name: "角色",
            mes: "第三条",
            swipe_id: 2,
            swipes: ["第一条", "第二条", "第三条"],
          },
        ],
        0,
        1,
      ),
    ).toEqual([
      {
        name: "角色",
        mes: "第一条",
        swipe_id: 0,
        swipes: ["第一条", "第二条", "第三条"],
      },
    ]);
    expect(
      selectChatMessageSwipeAt(
        [
          {
            name: "角色",
            mes: "单条",
            swipe_id: 0,
            swipes: ["单条"],
          },
        ],
        0,
        1,
      ),
    ).toEqual([
      {
        name: "角色",
        mes: "单条",
        swipe_id: 0,
        swipes: ["单条"],
      },
    ]);
  });

  it("finds the last assistant message index for continue", () => {
    expect(
      getLastAssistantMessageIndex([
        { name: "System", is_system: true, mes: "系统" },
        { name: "User", is_user: true, mes: "问题" },
        { name: "Alice", mes: "回答一" },
        { name: "User", is_user: true, mes: "追问" },
        { name: "Alice", mes: "回答二" },
      ]),
    ).toBe(4);
    expect(
      getLastAssistantMessageIndex([
        { name: "System", is_system: true, mes: "系统" },
        { name: "User", is_user: true, mes: "问题" },
      ]),
    ).toBeUndefined();
  });

  it("summarizes local chat draft save status", () => {
    expect(
      createChatDraftStatus({
        hasUnsavedChanges: false,
        loadedArchiveName: null,
        messageCount: 0,
      }),
    ).toBe("空白");
    expect(
      createChatDraftStatus({
        hasUnsavedChanges: true,
        loadedArchiveName: "已保存存档",
        messageCount: 2,
      }),
    ).toBe("未保存更改");
    expect(
      createChatDraftStatus({
        hasUnsavedChanges: false,
        loadedArchiveName: "已保存存档",
        messageCount: 2,
      }),
    ).toBe("已保存");
    expect(
      createChatDraftStatus({
        hasUnsavedChanges: false,
        loadedArchiveName: null,
        messageCount: 2,
      }),
    ).toBe("未保存草稿");
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

describe("resolveDefaultWorldInfoEntries", () => {
  it("returns undefined for missing defaultWorldId", () => {
    const result = resolveDefaultWorldInfoEntries(undefined, {
      id: "w1",
      name: "世界书",
      createdAt: "",
      updatedAt: "",
      payload: { entries: [{ key: ["test"], content: "text" }] },
    } as Parameters<typeof resolveDefaultWorldInfoEntries>[1]);

    expect(result).toBeUndefined();
  });

  it("returns undefined for null worldInfo", () => {
    const result = resolveDefaultWorldInfoEntries("w1", null);

    expect(result).toBeUndefined();
  });

  it("extracts entries from portable world info", () => {
    const worldInfo = {
      id: "w1",
      name: "世界书",
      createdAt: "",
      updatedAt: "",
      payload: {
        entries: [
          { key: ["test"], content: "hello" },
          { key: ["foo"], content: "bar" },
        ],
      },
    } as Parameters<typeof resolveDefaultWorldInfoEntries>[1];

    const result = resolveDefaultWorldInfoEntries("w1", worldInfo);

    expect(result).toHaveLength(2);
    expect(result?.[0]).toEqual(expect.objectContaining({ key: ["test"], content: "hello" }));
  });

  it("extracts entries from native world info", () => {
    const worldInfo = {
      id: "w1",
      name: "世界书",
      createdAt: "",
      updatedAt: "",
      payload: {
        entries: {
          "0": { key: ["test"], content: "hello" },
          "1": { key: ["foo"], content: "bar" },
        },
      },
    } as Parameters<typeof resolveDefaultWorldInfoEntries>[1];

    const result = resolveDefaultWorldInfoEntries("w1", worldInfo);

    expect(result).toHaveLength(2);
  });

  it("returns empty entries as undefined", () => {
    const worldInfo = {
      id: "w1",
      name: "空世界书",
      createdAt: "",
      updatedAt: "",
      payload: { entries: [] },
    } as Parameters<typeof resolveDefaultWorldInfoEntries>[1];

    const result = resolveDefaultWorldInfoEntries("w1", worldInfo);

    expect(result).toBeUndefined();
  });
});

describe("extractWorldInfoEntries", () => {
  it("extracts array entries from portable format", () => {
    const entries = extractWorldInfoEntries({
      entries: [
        { key: ["test"], content: "hello" },
      ],
    });

    expect(entries).toHaveLength(1);
  });

  it("extracts object entries from native format", () => {
    const entries = extractWorldInfoEntries({
      entries: {
        "0": { key: ["test"], content: "hello" },
        "1": { key: ["foo"], content: "bar" },
      },
    });

    expect(entries).toHaveLength(2);
  });
});

describe("selectVisibleQuickReplySets", () => {
  const setA = { id: "qr-a", name: "快速回复A", createdAt: "", updatedAt: "", payload: { name: "A", qrList: [{ label: "L1", message: "M1" }] } };
  const setB = { id: "qr-b", name: "快速回复B", createdAt: "", updatedAt: "", payload: { name: "B", qrList: [{ label: "L2", message: "M2" }] } };
  const allSets = [setA, setB];

  it("returns all sets when defaultQuickReplySetId is undefined", () => {
    expect(selectVisibleQuickReplySets(allSets, undefined)).toEqual(allSets);
  });

  it("returns only the default set when it exists", () => {
    const result = selectVisibleQuickReplySets(allSets, "qr-b");

    expect(result).toEqual([setB]);
  });

  it("falls back to all sets when default id is not found", () => {
    expect(selectVisibleQuickReplySets(allSets, "qr-nonexistent")).toEqual(allSets);
  });
});

describe("ChatBindingSnapshot round-trip", () => {
  const baseInput = {
    activeCharacter: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: { name: "测试角色" },
    } as Parameters<typeof createChatSaveSnapshotInput>[0]["activeCharacter"],
    messages: [
      {
        name: "User",
        is_user: true,
        mes: "你好",
      },
    ] as ChatMessageLine[],
    selectedCharacterId: "char-1",
    userName: "User",
  };

  it("writes binding snapshot into chatMetadata when provided", () => {
    const result = createChatSaveSnapshotInput({
      ...baseInput,
      binding: {
        presetId: "preset-1",
        worldIds: ["world-1"],
        regexSourceIds: ["preset-1:regex:0"],
        quickReplySetIds: ["qr-1"],
        personaId: "persona-1",
      },
    });

    expect(result.chatMetadata).toBeDefined();
    const meta = result.chatMetadata as Record<string, unknown>;
    expect(meta.presetId).toBe("preset-1");
    expect(meta.worldIds).toEqual(["world-1"]);
    expect(meta.quickReplySetIds).toEqual(["qr-1"]);
    expect(meta.personaId).toBe("persona-1");
    expect(meta._ms_regexSourceIds).toEqual(["preset-1:regex:0"]);
    expect(meta._ms_bindingVersion).toBe(1);
  });

  it("omits empty binding arrays and undefined fields", () => {
    const result = createChatSaveSnapshotInput({
      ...baseInput,
      binding: {
        worldIds: [],
        regexSourceIds: [],
        quickReplySetIds: [],
      },
    });

    expect(result.chatMetadata).toBeDefined();
    const meta = result.chatMetadata as Record<string, unknown>;
    expect(meta.presetId).toBeUndefined();
    expect(meta.worldIds).toBeUndefined();
    expect(meta.personaId).toBeUndefined();
    expect(meta._ms_bindingVersion).toBe(1);
  });

  it("extracts binding snapshot from chatMetadata round-trip", async () => {
    const { extractChatBindingFromMetadata } = await import("../types/localProfile");
    const { serializeChatBindingToMetadata } = await import("../types/localProfile");

    const original = {
      presetId: "preset-1",
      worldIds: ["world-1", "world-2"],
      regexSourceIds: ["regex-1"],
      quickReplySetIds: ["qr-1"],
      personaId: "persona-1",
    };

    const serialized = serializeChatBindingToMetadata(original);
    const extracted = extractChatBindingFromMetadata(serialized);

    expect(extracted).toEqual(original);
  });

  it("extracts binding snapshot tolerates missing fields", async () => {
    const { extractChatBindingFromMetadata } = await import("../types/localProfile");

    const extracted = extractChatBindingFromMetadata(undefined);
    expect(extracted).toEqual({
      worldIds: [],
      regexSourceIds: [],
      quickReplySetIds: [],
    });
  });

  it("merges binding into existing imported chatMetadata", () => {
    const result = createChatSaveSnapshotInput({
      ...baseInput,
      chatMetadata: {
        user_name: "OldUser",
        character_name: "OldChar",
        chat_metadata: {
          customField: "keep-me",
        },
      },
      binding: {
        presetId: "preset-2",
        worldIds: ["world-2"],
        regexSourceIds: [],
        quickReplySetIds: [],
      },
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata!.user_name).toBe("OldUser");
    expect(result.metadata!.character_name).toBe("OldChar");
    const meta = result.chatMetadata as Record<string, unknown>;
    expect(meta.customField).toBe("keep-me");
    expect(meta.presetId).toBe("preset-2");
    expect(meta.worldIds).toEqual(["world-2"]);
  });
});
