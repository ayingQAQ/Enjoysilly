import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Archive,
  Bot,
  Download,
  KeyRound,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  Send,
  Square,
  Upload,
  UserRound,
} from "lucide-react";

import { getChatMessageDisplayText } from "../lib/chatHistory";
import {
  runStreamingChatContinue,
  runStreamingChatReroll,
  runStreamingChatTurn,
} from "../lib/chatStreaming";
import { downloadBytesToFile } from "../lib/browserDownload";
import {
  loadCharacterAssetSummaries,
  loadPresetAssetSummaries,
  type CharacterAssetSummary,
  type PresetAssetSummary,
} from "../services/assetCatalog";
import {
  loadCharacterDetailSummary,
  type CharacterDetailSummary,
} from "../services/characterDetails";
import {
  loadPresetDetailSummary,
  type PresetDetailSummary,
} from "../services/presetDetails";
import {
  saveChatSnapshotToDatabase,
} from "../services/chatPersistence";
import { importChatToDatabase } from "../services/chatImport";
import {
  deleteChatArchive,
  loadChatArchiveDetail,
  loadChatArchiveSummaries,
  renameChatArchive,
  type ChatArchiveSummary,
} from "../services/chatArchive";
import { createChatJsonlExport } from "../services/chatExport";
import type { ChatMessageLine, ChatMetadataLine } from "../types/chat";
import {
  AssetSelectionSummary,
  ChatArchiveList,
  ChatBubble,
  EmptyChatState,
  Field,
  GreetingPicker,
  NoticeText,
  PanelTitle,
  SelectField,
  SummaryTile,
  TextAreaField,
} from "./ChatScreenPanels";
import {
  cloneChatMessages,
  cloneChatMetadata,
  createCharacterGreetingOptions,
  createChatDraftStatus,
  createChatImportDatabaseOptions,
  createChatSaveSnapshotInput,
  createGreetingChatMessage,
  createImportedChatScreenState,
  createLocalChatCharacter,
  createMinimalChatPreset,
  defaultBaseUrl,
  defaultCharacterDescription,
  defaultCharacterName,
  defaultModel,
  defaultPersonaDescription,
  defaultUserName,
  deleteChatMessageAt,
  formatChatExportError,
  formatChatImportError,
  formatChatSaveError,
  formatChatSendError,
  formatUnknownError,
  getChatArchiveFilterCharacterId,
  getLastAssistantMessageIndex,
  isAbortError,
  localCharacterOptionId,
  minimalPresetOptionId,
  normalizeName,
  selectChatCharacterPayload,
  selectChatMessageSwipeAt,
  selectChatPresetPayload,
  updateChatMessageTextAt,
} from "./chatScreenHelpers";

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessageLine[]>([]);
  const [inputText, setInputText] = useState("");
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [userName, setUserName] = useState(defaultUserName);
  const [characterName, setCharacterName] = useState(defaultCharacterName);
  const [characterDescription, setCharacterDescription] = useState(
    defaultCharacterDescription,
  );
  const [personaDescription, setPersonaDescription] = useState(
    defaultPersonaDescription,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingChat, setIsImportingChat] = useState(false);
  const [statusText, setStatusText] = useState("等待输入");
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isAssetLoading, setIsAssetLoading] = useState(true);
  const [isArchiveLoading, setIsArchiveLoading] = useState(true);
  const [loadingArchiveId, setLoadingArchiveId] = useState<string | null>(null);
  const [archiveActionId, setArchiveActionId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterAssetSummary[]>([]);
  const [presets, setPresets] = useState<PresetAssetSummary[]>([]);
  const [chatArchives, setChatArchives] = useState<ChatArchiveSummary[]>([]);
  const [loadedArchiveId, setLoadedArchiveId] = useState<string | null>(null);
  const [loadedArchiveName, setLoadedArchiveName] = useState<string | null>(null);
  const [loadedChatMetadata, setLoadedChatMetadata] =
    useState<ChatMetadataLine | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    localCharacterOptionId,
  );
  const [selectedPresetId, setSelectedPresetId] = useState(minimalPresetOptionId);
  const [selectedCharacterDetail, setSelectedCharacterDetail] =
    useState<CharacterDetailSummary | null>(null);
  const [selectedPresetDetail, setSelectedPresetDetail] =
    useState<PresetDetailSummary | null>(null);
  const [characterDetailError, setCharacterDetailError] = useState<string | null>(
    null,
  );
  const [presetDetailError, setPresetDetailError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatImportInputRef = useRef<HTMLInputElement>(null);

  const fallbackPreset = useMemo(() => createMinimalChatPreset(), []);
  const localCharacter = useMemo(
    () =>
      createLocalChatCharacter({
        name: characterName,
        description: characterDescription,
      }),
    [characterDescription, characterName],
  );
  const activeCharacter = selectChatCharacterPayload(
    selectedCharacterDetail?.stored.payload,
    localCharacter,
  );
  const activePreset = selectChatPresetPayload(
    selectedPresetDetail?.stored.payload,
    fallbackPreset,
  );
  const greetingOptions = useMemo(
    () => createCharacterGreetingOptions(activeCharacter),
    [activeCharacter],
  );
  const archiveFilterCharacterId =
    getChatArchiveFilterCharacterId(selectedCharacterId);
  const isCharacterReady =
    selectedCharacterId === localCharacterOptionId ||
    selectedCharacterDetail !== null;
  const isPresetReady =
    selectedPresetId === minimalPresetOptionId || selectedPresetDetail !== null;
  const canSend =
    !isStreaming &&
    !isImportingChat &&
    inputText.trim().length > 0 &&
    isCharacterReady &&
    isPresetReady;
  const canImport = !isStreaming && !isImportingChat;
  const canSave =
    !isStreaming && !isSaving && !isImportingChat && messages.length > 0;
  const canExport = !isStreaming && !isImportingChat && messages.length > 0;
  const lastAssistantMessageIndex = getLastAssistantMessageIndex(messages);
  const canContinue =
    !isStreaming &&
    !isImportingChat &&
    isCharacterReady &&
    isPresetReady &&
    lastAssistantMessageIndex !== undefined;
  const draftStatus = createChatDraftStatus({
    hasUnsavedChanges,
    loadedArchiveName,
    messageCount: messages.length,
  });

  const refreshChatArchives = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setIsArchiveLoading(true);
      }
      setArchiveError(null);

      try {
        const summaries = await loadChatArchiveSummaries({
          characterId: archiveFilterCharacterId,
        });

        setChatArchives(summaries);
      } catch (loadError: unknown) {
        setArchiveError(formatUnknownError(loadError));
      } finally {
        if (!options.silent) {
          setIsArchiveLoading(false);
        }
      }
    },
    [archiveFilterCharacterId],
  );

  useEffect(() => {
    let isActive = true;

    setIsAssetLoading(true);
    setAssetError(null);

    Promise.all([loadCharacterAssetSummaries(), loadPresetAssetSummaries()])
      .then(([loadedCharacters, loadedPresets]) => {
        if (!isActive) {
          return;
        }

        setCharacters(loadedCharacters);
        setPresets(loadedPresets);
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setAssetError(formatUnknownError(loadError));
        }
      })
      .finally(() => {
        if (isActive) {
          setIsAssetLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    void refreshChatArchives();
  }, [refreshChatArchives]);

  useEffect(() => {
    if (selectedCharacterId === localCharacterOptionId) {
      setSelectedCharacterDetail(null);
      setCharacterDetailError(null);
      return;
    }

    let isActive = true;
    setSelectedCharacterDetail(null);
    setCharacterDetailError(null);

    loadCharacterDetailSummary(selectedCharacterId)
      .then((detail) => {
        if (isActive) {
          setSelectedCharacterDetail(detail);
        }
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setCharacterDetailError(formatUnknownError(loadError));
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedCharacterId]);

  useEffect(() => {
    if (selectedPresetId === minimalPresetOptionId) {
      setSelectedPresetDetail(null);
      setPresetDetailError(null);
      return;
    }

    let isActive = true;
    setSelectedPresetDetail(null);
    setPresetDetailError(null);

    loadPresetDetailSummary(selectedPresetId)
      .then((detail) => {
        if (isActive) {
          setSelectedPresetDetail(detail);
        }
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setPresetDetailError(formatUnknownError(loadError));
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedPresetId]);

  const handleSend = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const userText = inputText.trim();
      const trimmedBaseUrl = baseUrl.trim();
      const trimmedModel = model.trim();

      if (!userText || isStreaming) {
        return;
      }

      if (!isCharacterReady || !isPresetReady) {
        setError("正在读取选中的角色或预设，请稍后再发送。");
        return;
      }

      if (!trimmedBaseUrl) {
        setError("请先填写 OpenAI 兼容 API Base URL。");
        return;
      }

      if (!trimmedModel) {
        setError("请先填写模型名称。");
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      setStatusText("正在请求模型");
      setError(null);
      setSaveMessage(null);
      setLoadedChatMetadata(null);
      setInputText("");

      try {
        for await (const update of runStreamingChatTurn({
          baseUrl: trimmedBaseUrl,
          apiKey,
          model: trimmedModel,
          preset: activePreset,
          character: activeCharacter,
          messages,
          userName: normalizeName(userName, defaultUserName),
          userText,
          personaDescription,
          signal: controller.signal,
        })) {
          setMessages(update.messages);
          setHasUnsavedChanges(true);

          if (update.kind === "started") {
            setStatusText("模型已连接，等待首个 token");
          } else if (update.kind === "delta") {
            setStatusText("正在流式接收");
          } else {
            setStatusText(
              update.finishReason
                ? `完成：${update.finishReason}`
                : "回复完成",
            );
          }
        }
      } catch (sendError: unknown) {
        if (isAbortError(sendError)) {
          setStatusText("已停止生成");
          return;
        }

        setError(formatChatSendError(sendError));
        setStatusText("请求失败");
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsStreaming(false);
      }
    },
    [
      activeCharacter,
      activePreset,
      apiKey,
      baseUrl,
      inputText,
      isCharacterReady,
      isPresetReady,
      isStreaming,
      messages,
      model,
      personaDescription,
      userName,
    ],
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handlePickChatImportFile = useCallback(() => {
    if (!canImport) {
      return;
    }

    chatImportInputRef.current?.click();
  }, [canImport]);

  const handleChatImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file || !canImport) {
        return;
      }

      if (
        messages.length > 0 &&
        !window.confirm(
          "导入 JSONL 会替换当前页面消息。已保存的本地存档不会被删除，是否继续？",
        )
      ) {
        return;
      }

      setIsImportingChat(true);
      setError(null);
      setSaveMessage(null);
      setArchiveError(null);
      setStatusText("正在导入 JSONL");

      try {
        const imported = await importChatToDatabase(
          new Uint8Array(await file.arrayBuffer()),
          file.name,
          createChatImportDatabaseOptions(selectedCharacterId),
        );
        const importedState = createImportedChatScreenState({
          chat: imported.chat,
          selectedCharacterId,
          storedId: imported.stored.id,
          storedName: imported.stored.name,
        });

        setMessages(importedState.messages);
        setUserName(importedState.userName);

        if (importedState.characterName) {
          setCharacterName(importedState.characterName);
        }

        setLoadedArchiveId(importedState.loadedArchiveId);
        setLoadedArchiveName(importedState.loadedArchiveName);
        setLoadedChatMetadata(importedState.metadata);
        setHasUnsavedChanges(false);
        setSaveMessage(
          `已导入并保存：${imported.stored.name}（${imported.chat.messages.length} 行消息）`,
        );
        setStatusText("JSONL 已导入到当前页面和本地数据库");
        await refreshChatArchives({ silent: true });
      } catch (importError: unknown) {
        setError(formatChatImportError(importError));
        setStatusText("导入失败");
      } finally {
        setIsImportingChat(false);
      }
    },
    [canImport, messages.length, refreshChatArchives, selectedCharacterId],
  );

  const handleSave = useCallback(async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const stored = await saveChatSnapshotToDatabase(
        createChatSaveSnapshotInput({
          activeCharacter,
          chatMetadata: loadedChatMetadata ?? undefined,
          messages,
          selectedCharacterId,
          userName,
        }),
      );

      setSaveMessage(`已保存：${stored.name}`);
      setLoadedArchiveId(stored.id);
      setLoadedArchiveName(stored.name);
      setHasUnsavedChanges(false);
      setStatusText("对话已保存到本地数据库");
      await refreshChatArchives({ silent: true });
    } catch (saveError: unknown) {
      setError(formatChatSaveError(saveError));
      setStatusText("保存失败");
    } finally {
      setIsSaving(false);
    }
  }, [
    activeCharacter,
    canSave,
    loadedChatMetadata,
    messages,
    refreshChatArchives,
    selectedCharacterId,
    userName,
  ]);

  const handleExport = useCallback(() => {
    if (!canExport) {
      return;
    }

    setError(null);
    setSaveMessage(null);

    try {
      const artifact = createChatJsonlExport({
        messages,
        userName: normalizeName(userName, defaultUserName),
        characterName: normalizeName(
          activeCharacter.data.name,
          defaultCharacterName,
        ),
        chatName: loadedArchiveName ?? undefined,
        metadata: loadedChatMetadata ?? undefined,
      });

      downloadBytesToFile(
        artifact.bytes,
        artifact.fileName,
        "application/x-ndjson",
      );
      setSaveMessage(`已导出：${artifact.fileName}`);
      setStatusText("当前对话已导出为 JSONL");
    } catch (exportError: unknown) {
      setError(formatChatExportError(exportError));
      setStatusText("导出失败");
    }
  }, [
    activeCharacter,
    canExport,
    loadedArchiveName,
    loadedChatMetadata,
    messages,
    userName,
  ]);

  const handleLoadArchive = useCallback(
    async (archiveId: string) => {
      if (isStreaming || loadingArchiveId || archiveActionId) {
        return;
      }

      setLoadingArchiveId(archiveId);
      setError(null);
      setSaveMessage(null);
      setArchiveError(null);

      try {
        const detail = await loadChatArchiveDetail(archiveId);
        const metadata = detail.stored.payload.metadata;

        setMessages(cloneChatMessages(detail.stored.payload.messages));
        setLoadedChatMetadata(cloneChatMetadata(metadata));
        setUserName(normalizeName(metadata.user_name, defaultUserName));
        setHasUnsavedChanges(false);

        if (selectedCharacterId === localCharacterOptionId) {
          setCharacterName(
            normalizeName(metadata.character_name, defaultCharacterName),
          );
        }

        setLoadedArchiveId(detail.summary.id);
        setLoadedArchiveName(detail.summary.name);
        setStatusText(`已加载存档：${detail.summary.name}`);
      } catch (loadError: unknown) {
        setArchiveError(formatUnknownError(loadError));
        setStatusText("读取存档失败");
      } finally {
        setLoadingArchiveId(null);
      }
    },
    [archiveActionId, isStreaming, loadingArchiveId, selectedCharacterId],
  );

  const handleNewChat = useCallback(() => {
    if (isStreaming || isImportingChat) {
      return;
    }

    if (
      messages.length > 0 &&
      !window.confirm(
        "新建空白对话会清空当前页面消息。已保存的本地存档不会被删除，是否继续？",
      )
    ) {
      return;
    }

    setMessages([]);
    setError(null);
    setSaveMessage(null);
    setLoadedArchiveId(null);
    setLoadedArchiveName(null);
    setLoadedChatMetadata(null);
    setHasUnsavedChanges(false);
    setStatusText("等待输入");
  }, [isImportingChat, isStreaming, messages.length]);

  const handleApplyGreeting = useCallback(
    (greetingIndex: number) => {
      if (isStreaming || isImportingChat) {
        return;
      }

      if (
        messages.length > 0 &&
        !window.confirm(
          "切换首条问候会替换当前页面消息。已保存的本地存档不会被删除，是否继续？",
        )
      ) {
        return;
      }

      const greetingMessage = createGreetingChatMessage({
        character: activeCharacter,
        greetingIndex,
        userName: normalizeName(userName, defaultUserName),
      });

      if (!greetingMessage) {
        setError("当前角色没有可用的 first_mes 或 alternate_greetings。");
        return;
      }

      setMessages([greetingMessage]);
      setError(null);
      setSaveMessage(null);
      setLoadedArchiveId(null);
      setLoadedArchiveName(null);
      setLoadedChatMetadata(null);
      setHasUnsavedChanges(true);
      setStatusText("已应用角色首条问候");
    },
    [activeCharacter, isImportingChat, isStreaming, messages.length, userName],
  );

  const handleEditMessage = useCallback(
    (messageIndex: number) => {
      if (isStreaming || isImportingChat) {
        return;
      }

      const message = messages[messageIndex];

      if (!message) {
        return;
      }

      const currentText = getChatMessageDisplayText(message);
      const nextText = window.prompt("编辑当前消息内容", currentText);

      if (nextText === null || nextText === currentText) {
        return;
      }

      setMessages((currentMessages) =>
        updateChatMessageTextAt(currentMessages, messageIndex, nextText),
      );
      setSaveMessage(null);
      setError(null);
      setHasUnsavedChanges(true);
      setStatusText("当前页面消息已编辑，保存后会写入本地存档");
    },
    [isImportingChat, isStreaming, messages],
  );

  const handleDeleteMessage = useCallback(
    (messageIndex: number) => {
      if (isStreaming || isImportingChat) {
        return;
      }

      const message = messages[messageIndex];

      if (!message) {
        return;
      }

      if (
        !window.confirm(
          "确定删除这条消息吗？删除只影响当前页面，保存后才会写入本地存档。",
        )
      ) {
        return;
      }

      setMessages((currentMessages) =>
        deleteChatMessageAt(currentMessages, messageIndex),
      );
      setSaveMessage(null);
      setError(null);
      setHasUnsavedChanges(true);
      setStatusText("当前页面消息已删除，保存后会写入本地存档");
    },
    [isImportingChat, isStreaming, messages],
  );

  const handleSelectMessageSwipe = useCallback(
    (messageIndex: number, direction: -1 | 1) => {
      if (isStreaming || isImportingChat) {
        return;
      }

      setMessages((currentMessages) =>
        selectChatMessageSwipeAt(currentMessages, messageIndex, direction),
      );
      setSaveMessage(null);
      setError(null);
      setHasUnsavedChanges(true);
      setStatusText("已切换当前消息 swipe，保存后会写入本地存档");
    },
    [isImportingChat, isStreaming],
  );

  const handleRerollMessage = useCallback(
    async (messageIndex: number) => {
      if (isStreaming || isImportingChat || !isCharacterReady || !isPresetReady) {
        return;
      }

      const targetMessage = messages[messageIndex];

      if (
        !targetMessage ||
        targetMessage.is_user === true ||
        targetMessage.is_system === true
      ) {
        return;
      }

      const trimmedBaseUrl = baseUrl.trim();
      const trimmedModel = model.trim();

      if (!trimmedBaseUrl) {
        setError("请先填写 OpenAI 兼容 API Base URL。");
        return;
      }

      if (!trimmedModel) {
        setError("请先填写模型名称。");
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      setStatusText("正在重新生成当前消息");
      setError(null);
      setSaveMessage(null);

      try {
        for await (const update of runStreamingChatReroll({
          assistantMessageIndex: messageIndex,
          baseUrl: trimmedBaseUrl,
          apiKey,
          model: trimmedModel,
          preset: activePreset,
          character: activeCharacter,
          messages,
          userName: normalizeName(userName, defaultUserName),
          personaDescription,
          signal: controller.signal,
        })) {
          setMessages(update.messages);
          setHasUnsavedChanges(true);

          if (update.kind === "started") {
            setStatusText("已创建新的 swipe，等待模型响应");
          } else if (update.kind === "delta") {
            setStatusText("正在接收重新生成内容");
          } else {
            setStatusText(
              update.finishReason
                ? `重新生成完成：${update.finishReason}`
                : "重新生成完成",
            );
          }
        }
      } catch (rerollError: unknown) {
        if (isAbortError(rerollError)) {
          setStatusText("已停止重新生成");
          return;
        }

        setError(formatChatSendError(rerollError));
        setStatusText("重新生成失败");
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsStreaming(false);
      }
    },
    [
      activeCharacter,
      activePreset,
      apiKey,
      baseUrl,
      isCharacterReady,
      isImportingChat,
      isPresetReady,
      isStreaming,
      messages,
      model,
      personaDescription,
      userName,
    ],
  );

  const handleContinueMessage = useCallback(async () => {
    if (!canContinue || lastAssistantMessageIndex === undefined) {
      return;
    }

    const trimmedBaseUrl = baseUrl.trim();
    const trimmedModel = model.trim();

    if (!trimmedBaseUrl) {
      setError("请先填写 OpenAI 兼容 API Base URL。");
      return;
    }

    if (!trimmedModel) {
      setError("请先填写模型名称。");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);
    setStatusText("正在继续最后一条回复");
    setError(null);
    setSaveMessage(null);

    try {
      for await (const update of runStreamingChatContinue({
        assistantMessageIndex: lastAssistantMessageIndex,
        baseUrl: trimmedBaseUrl,
        apiKey,
        model: trimmedModel,
        preset: activePreset,
        character: activeCharacter,
        messages,
        userName: normalizeName(userName, defaultUserName),
        personaDescription,
        signal: controller.signal,
      })) {
        setMessages(update.messages);
        setHasUnsavedChanges(true);

        if (update.kind === "started") {
          setStatusText("已请求继续回复，等待模型响应");
        } else if (update.kind === "delta") {
          setStatusText("正在接收继续内容");
        } else {
          setStatusText(
            update.finishReason
              ? `继续完成：${update.finishReason}`
              : "继续完成",
          );
        }
      }
    } catch (continueError: unknown) {
      if (isAbortError(continueError)) {
        setStatusText("已停止继续");
        return;
      }

      setError(formatChatSendError(continueError));
      setStatusText("继续失败");
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
    }
  }, [
    activeCharacter,
    activePreset,
    apiKey,
    baseUrl,
    canContinue,
    lastAssistantMessageIndex,
    messages,
    model,
    personaDescription,
    userName,
  ]);

  const handleRenameArchive = useCallback(
    async (archive: ChatArchiveSummary) => {
      if (isStreaming || loadingArchiveId || archiveActionId) {
        return;
      }

      const nextName = window.prompt("请输入新的对话存档名称", archive.name);

      if (nextName === null || nextName === archive.name) {
        return;
      }

      setArchiveActionId(archive.id);
      setError(null);
      setSaveMessage(null);
      setArchiveError(null);

      try {
        const renamed = await renameChatArchive({
          chatId: archive.id,
          name: nextName,
        });

        if (loadedArchiveId === archive.id) {
          setLoadedArchiveName(renamed.summary.name);
        }

        setSaveMessage(`已重命名存档：${renamed.summary.name}`);
        setStatusText("对话存档已重命名");
        await refreshChatArchives({ silent: true });
      } catch (renameError: unknown) {
        setArchiveError(formatUnknownError(renameError));
        setStatusText("重命名存档失败");
      } finally {
        setArchiveActionId(null);
      }
    },
    [
      archiveActionId,
      isStreaming,
      loadedArchiveId,
      loadingArchiveId,
      refreshChatArchives,
    ],
  );

  const handleDeleteArchive = useCallback(
    async (archive: ChatArchiveSummary) => {
      if (isStreaming || loadingArchiveId || archiveActionId) {
        return;
      }

      if (
        !window.confirm(
          `确定删除本地对话存档「${archive.name}」吗？此操作不会修改角色卡、预设或 JSONL 导出文件。`,
        )
      ) {
        return;
      }

      setArchiveActionId(archive.id);
      setError(null);
      setSaveMessage(null);
      setArchiveError(null);

      try {
        const deleted = await deleteChatArchive(archive.id);

        if (loadedArchiveId === archive.id) {
          setLoadedArchiveId(null);
          setLoadedArchiveName(null);
          setLoadedChatMetadata(null);
        }

        setSaveMessage(`已删除存档：${deleted.name}`);
        setStatusText("对话存档已删除");
        await refreshChatArchives({ silent: true });
      } catch (deleteError: unknown) {
        setArchiveError(formatUnknownError(deleteError));
        setStatusText("删除存档失败");
      } finally {
        setArchiveActionId(null);
      }
    },
    [
      archiveActionId,
      isStreaming,
      loadedArchiveId,
      loadingArchiveId,
      refreshChatArchives,
    ],
  );

  return (
    <section className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">
              实时对话
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              连接 OpenAI 兼容接口，执行流式 Chat Completion 回合。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              当前页面可以选择已导入角色和 ST 原生预设用于发送；对话默认只保存在当前页面状态，
              也可以导入/导出 ST JSONL，并手动保存为兼容快照，不修改角色卡、世界书、预设或正则脚本 payload。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <SummaryTile label="消息行" value={messages.length} />
            <SummaryTile label="草稿" value={draftStatus} compact />
            <SummaryTile label="模型" value={model.trim() || "未设置"} compact />
          </div>
        </div>
      </div>

      <div className="grid min-h-[640px] gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 flex-col rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                <MessageSquare size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">本地对话窗口</h2>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {activeCharacter.data.name} · {normalizeName(userName, defaultUserName)}
                </p>
                {loadedArchiveName ? (
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    已加载：{loadedArchiveName}
                  </p>
                ) : null}
                {hasUnsavedChanges && messages.length > 0 ? (
                  <p className="truncate text-xs text-amber-600">
                    有未保存更改，点击保存写入本地存档
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <input
                ref={chatImportInputRef}
                className="hidden"
                type="file"
                accept=".jsonl,.json,application/json,application/x-ndjson,text/plain"
                onChange={(event) => void handleChatImportFileChange(event)}
              />
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canImport}
                type="button"
                onClick={handlePickChatImportFile}
              >
                {isImportingChat ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Upload size={14} />
                )}
                导入
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canExport}
                type="button"
                onClick={handleExport}
              >
                <Download size={14} />
                导出
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canContinue}
                type="button"
                onClick={() => void handleContinueMessage()}
              >
                <RotateCcw size={14} />
                继续
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSave}
                type="button"
                onClick={() => void handleSave()}
              >
                {isSaving ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Save size={14} />
                )}
                保存
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isStreaming || isImportingChat}
                type="button"
                onClick={handleNewChat}
              >
                <Plus size={14} />
                新建
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            {messages.length === 0 ? (
              <EmptyChatState />
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <ChatBubble
                    key={`${message.name}-${index}`}
                    disabled={isStreaming || isImportingChat}
                    message={message}
                    onDelete={() => handleDeleteMessage(index)}
                    onEdit={() => handleEditMessage(index)}
                    onReroll={() => void handleRerollMessage(index)}
                    onSwipeNext={() => handleSelectMessageSwipe(index, 1)}
                    onSwipePrevious={() => handleSelectMessageSwipe(index, -1)}
                  />
                ))}
              </div>
            )}
          </div>

          {error ? (
            <p className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
              {error}
            </p>
          ) : null}
          {saveMessage ? (
            <p className="mx-4 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-700">
              {saveMessage}
            </p>
          ) : null}

          <form
            className="border-t border-[var(--border-soft)] p-4"
            onSubmit={(event) => void handleSend(event)}
          >
            <label className="sr-only" htmlFor="chat-message-input">
              输入消息
            </label>
            <textarea
              id="chat-message-input"
              className="min-h-24 w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              disabled={isStreaming}
              placeholder="输入要发送给模型的消息..."
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p aria-live="polite" className="text-xs text-[var(--text-muted)]">
                {statusText}
              </p>
              <div className="flex gap-2">
                {isStreaming ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:border-red-300"
                    type="button"
                    onClick={handleStop}
                  >
                    <Square size={15} />
                    停止
                  </button>
                ) : null}
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canSend}
                  type="submit"
                >
                  {isStreaming ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                  发送
                </button>
              </div>
            </div>
          </form>
        </div>

        <aside className="flex min-h-0 flex-col gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
          <PanelTitle
            icon={<KeyRound size={17} />}
            title="接口配置"
            subtitle="仅保存在当前页面状态，不写入本地数据库。"
          />
          <Field label="API Base URL" value={baseUrl} onChange={setBaseUrl} />
          <Field label="API Key" type="password" value={apiKey} onChange={setApiKey} />
          <Field label="模型" value={model} onChange={setModel} />

          <div className="border-t border-[var(--border-soft)] pt-4">
            <PanelTitle
              icon={<UserRound size={17} />}
              title="资产选择"
              subtitle="读取已导入角色和 ST 原生预设；当前阶段只读使用，不保存绑定关系。"
            />
          </div>
          <SelectField
            disabled={isStreaming || isAssetLoading}
            label="角色"
            options={[
              {
                label: "本地调试角色",
                value: localCharacterOptionId,
              },
              ...characters.map((characterAsset) => ({
                label: characterAsset.name,
                value: characterAsset.id,
              })),
            ]}
            value={selectedCharacterId}
            onChange={setSelectedCharacterId}
          />
          <SelectField
            disabled={isStreaming || isAssetLoading}
            label="预设"
            options={[
              {
                label: "最小 Chat Completion 预设",
                value: minimalPresetOptionId,
              },
              ...presets.map((presetAsset) => ({
                label: presetAsset.name,
                value: presetAsset.id,
              })),
            ]}
            value={selectedPresetId}
            onChange={setSelectedPresetId}
          />
          {assetError ? <NoticeText kind="error" text={assetError} /> : null}
          {characterDetailError ? (
            <NoticeText kind="error" text={characterDetailError} />
          ) : null}
          {presetDetailError ? (
            <NoticeText kind="error" text={presetDetailError} />
          ) : null}
          <AssetSelectionSummary
            characterDetail={selectedCharacterDetail}
            isAssetLoading={isAssetLoading}
            presetDetail={selectedPresetDetail}
          />

          <div className="border-t border-[var(--border-soft)] pt-4">
            <PanelTitle
              icon={<Archive size={17} />}
              title="本地存档"
              subtitle="管理 chats store 中的本地对话；不自动保存，不修改导入导出格式。"
            />
          </div>
          {archiveError ? <NoticeText kind="error" text={archiveError} /> : null}
          <ChatArchiveList
            archives={chatArchives}
            isLoading={isArchiveLoading}
            actionArchiveId={archiveActionId}
            loadingArchiveId={loadingArchiveId}
            selectedArchiveId={loadedArchiveId}
            onLoad={(archiveId) => void handleLoadArchive(archiveId)}
            onRename={(archive) => void handleRenameArchive(archive)}
            onDelete={(archive) => void handleDeleteArchive(archive)}
            disabled={isStreaming || isImportingChat}
          />

          <div className="border-t border-[var(--border-soft)] pt-4">
            <PanelTitle
              icon={<MessageSquare size={17} />}
              title="首条问候"
              subtitle="从角色卡 first_mes 与 alternate_greetings 生成 ST 兼容首条消息。"
            />
          </div>
          <GreetingPicker
            disabled={isStreaming || isImportingChat}
            greetings={greetingOptions}
            onApply={handleApplyGreeting}
          />

          <div className="border-t border-[var(--border-soft)] pt-4">
            <PanelTitle
              icon={<Bot size={17} />}
              title="调试输入"
              subtitle="本地角色模式下可编辑；已导入角色会按原始 payload 只读使用。"
            />
          </div>
          <Field label="用户名" value={userName} onChange={setUserName} />
          {selectedCharacterId === localCharacterOptionId ? (
            <>
              <Field
                label="角色名"
                value={characterName}
                onChange={setCharacterName}
              />
              <TextAreaField
                label="角色描述"
                value={characterDescription}
                onChange={setCharacterDescription}
              />
            </>
          ) : null}
          <TextAreaField
            label="用户 persona"
            value={personaDescription}
            onChange={setPersonaDescription}
          />

          <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]">
            选中的预设仅按 ST 原生 Chat Completion 结构参与 prompt 组装；不会执行
            TavernHelper、JS-Slash-Runner 或正则脚本。导入 JSONL 会保存到本地
            chats store，并替换当前页面消息。
          </div>
        </aside>
      </div>
    </section>
  );
}
