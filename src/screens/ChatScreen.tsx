import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Archive,
  Bot,
  Download,
  FileJson2,
  KeyRound,
  Loader2,
  MessageSquare,
  RotateCcw,
  Save,
  Send,
  Square,
  UserRound,
} from "lucide-react";

import { getChatMessageDisplayText } from "../lib/chatHistory";
import { runStreamingChatTurn } from "../lib/chatStreaming";
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
  type SaveChatSnapshotToDatabaseInput,
} from "../services/chatPersistence";
import {
  loadChatArchiveDetail,
  loadChatArchiveSummaries,
  type ChatArchiveSummary,
} from "../services/chatArchive";
import { createChatJsonlExport } from "../services/chatExport";
import type { ChatMessageLine } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { ChatCompletionPreset } from "../types/preset";

const localCharacterOptionId = "__local_character__";
const minimalPresetOptionId = "__minimal_preset__";
const defaultBaseUrl = "https://api.openai.com/v1";
const defaultModel = "gpt-4.1-mini";
const defaultUserName = "User";
const defaultCharacterName = "my_silly 助手";
const defaultCharacterDescription =
  "你是 my_silly 的本地调试助手。回复应当清晰、简洁，并保持中文交流。";
const defaultPersonaDescription = "用户正在测试 my_silly 的 OpenAI 兼容实时对话链路。";

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
  const [statusText, setStatusText] = useState("等待输入");
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isAssetLoading, setIsAssetLoading] = useState(true);
  const [isArchiveLoading, setIsArchiveLoading] = useState(true);
  const [loadingArchiveId, setLoadingArchiveId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterAssetSummary[]>([]);
  const [presets, setPresets] = useState<PresetAssetSummary[]>([]);
  const [chatArchives, setChatArchives] = useState<ChatArchiveSummary[]>([]);
  const [loadedArchiveId, setLoadedArchiveId] = useState<string | null>(null);
  const [loadedArchiveName, setLoadedArchiveName] = useState<string | null>(null);
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
  const archiveFilterCharacterId =
    getChatArchiveFilterCharacterId(selectedCharacterId);
  const isCharacterReady =
    selectedCharacterId === localCharacterOptionId ||
    selectedCharacterDetail !== null;
  const isPresetReady =
    selectedPresetId === minimalPresetOptionId || selectedPresetDetail !== null;
  const canSend =
    !isStreaming &&
    inputText.trim().length > 0 &&
    isCharacterReady &&
    isPresetReady;
  const canSave = !isStreaming && !isSaving && messages.length > 0;
  const canExport = !isStreaming && messages.length > 0;

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
          messages,
          selectedCharacterId,
          userName,
        }),
      );

      setSaveMessage(`已保存：${stored.name}`);
      setLoadedArchiveId(stored.id);
      setLoadedArchiveName(stored.name);
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
  }, [activeCharacter, canExport, loadedArchiveName, messages, userName]);

  const handleLoadArchive = useCallback(
    async (archiveId: string) => {
      if (isStreaming || loadingArchiveId) {
        return;
      }

      setLoadingArchiveId(archiveId);
      setError(null);
      setSaveMessage(null);
      setArchiveError(null);

      try {
        const detail = await loadChatArchiveDetail(archiveId);
        const metadata = detail.stored.payload.metadata;

        setMessages(detail.stored.payload.messages);
        setUserName(normalizeName(metadata.user_name, defaultUserName));

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
    [isStreaming, loadingArchiveId, selectedCharacterId],
  );

  const handleReset = useCallback(() => {
    if (isStreaming) {
      return;
    }

    setMessages([]);
    setError(null);
    setSaveMessage(null);
    setLoadedArchiveId(null);
    setLoadedArchiveName(null);
    setStatusText("等待输入");
  }, [isStreaming]);

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
              也可以手动保存为 ST JSONL 兼容快照，不修改角色卡、世界书、预设或正则脚本 payload。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <SummaryTile label="消息行" value={messages.length} />
            <SummaryTile label="模型" value={model.trim() || "未设置"} compact />
            <SummaryTile label="状态" value={statusText} compact />
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
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
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
                disabled={isStreaming || messages.length === 0}
                type="button"
                onClick={handleReset}
              >
                <RotateCcw size={14} />
                清空
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            {messages.length === 0 ? (
              <EmptyChatState />
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <ChatBubble key={`${message.name}-${index}`} message={message} />
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
              subtitle="只读列出并加载 chats store；不重命名、不删除、不自动保存。"
            />
          </div>
          {archiveError ? <NoticeText kind="error" text={archiveError} /> : null}
          <ChatArchiveList
            archives={chatArchives}
            isLoading={isArchiveLoading}
            loadingArchiveId={loadingArchiveId}
            selectedArchiveId={loadedArchiveId}
            onLoad={(archiveId) => void handleLoadArchive(archiveId)}
            disabled={isStreaming}
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
            TavernHelper、JS-Slash-Runner 或正则脚本。
          </div>
        </aside>
      </div>
    </section>
  );
}

export function createLocalChatCharacter(input: {
  name?: string;
  description?: string;
}): CharacterCard {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: normalizeName(input.name, defaultCharacterName),
      description: input.description?.trim() || defaultCharacterDescription,
      first_mes: "",
      extensions: {},
    },
  };
}

export function createMinimalChatPreset(): ChatCompletionPreset {
  return {
    temperature: 0.7,
    top_p: 1,
    openai_max_tokens: 800,
    stream_openai: true,
    prompts: [
      {
        identifier: "main",
        name: "主系统提示",
        role: "system",
        content:
          "你正在扮演 {{char}}，与 {{user}} 进行自然对话。回复应清晰、具体，并遵守角色描述。",
        enabled: true,
      },
      {
        identifier: "personaDescription",
        name: "用户 persona",
        role: "system",
        marker: true,
        enabled: true,
      },
      {
        identifier: "charDescription",
        name: "角色描述",
        role: "system",
        marker: true,
        enabled: true,
      },
      {
        identifier: "chatHistory",
        name: "聊天记录",
        role: "user",
        marker: true,
        enabled: true,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "main", enabled: true },
          { identifier: "personaDescription", enabled: true },
          { identifier: "charDescription", enabled: true },
          { identifier: "chatHistory", enabled: true },
        ],
      },
    ],
  };
}

export function selectChatCharacterPayload(
  importedCharacter: CharacterCard | undefined,
  fallbackCharacter: CharacterCard,
): CharacterCard {
  return importedCharacter ?? fallbackCharacter;
}

export function selectChatPresetPayload(
  importedPreset: ChatCompletionPreset | undefined,
  fallbackPreset: ChatCompletionPreset,
): ChatCompletionPreset {
  return importedPreset ?? fallbackPreset;
}

export function getChatArchiveFilterCharacterId(
  selectedCharacterId: string,
): string | undefined {
  return selectedCharacterId === localCharacterOptionId
    ? undefined
    : selectedCharacterId;
}

export function createChatSaveSnapshotInput(input: {
  activeCharacter: CharacterCard;
  messages: ChatMessageLine[];
  selectedCharacterId: string;
  userName: string;
}): SaveChatSnapshotToDatabaseInput {
  return {
    messages: input.messages,
    userName: normalizeName(input.userName, defaultUserName),
    characterName: normalizeName(
      input.activeCharacter.data.name,
      defaultCharacterName,
    ),
    characterId:
      input.selectedCharacterId === localCharacterOptionId
        ? undefined
        : input.selectedCharacterId,
  };
}

function ChatBubble({ message }: { message: ChatMessageLine }) {
  const isUser = message.is_user === true;
  const content = getChatMessageDisplayText(message);

  return (
    <article className={["flex", isUser ? "justify-end" : "justify-start"].join(" ")}>
      <div
        className={[
          "max-w-[88%] rounded-lg px-4 py-3 shadow-sm",
          isUser
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-primary)]",
        ].join(" ")}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs opacity-80">
          <span className="font-medium">{message.name}</span>
          {message.send_date ? <span>{message.send_date}</span> : null}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-7">
          {content || "正在生成..."}
        </p>
      </div>
    </article>
  );
}

function EmptyChatState() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center">
      <div>
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
          <MessageSquare size={22} />
        </div>
        <h2 className="text-base font-semibold">还没有消息</h2>
        <p className="mt-2 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
          选择角色与预设后发送第一条消息。页面会显示真实流式响应；如果浏览器被
          CORS 拦截，请换用允许 Web 调用的兼容端点。
        </p>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-muted)] px-3 py-2">
      <p
        className={[
          "truncate font-semibold",
          compact ? "text-sm" : "text-xl",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function PanelTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <div className="mt-0.5 text-[var(--accent-strong)]">{icon}</div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function AssetSelectionSummary({
  characterDetail,
  isAssetLoading,
  presetDetail,
}: {
  characterDetail: CharacterDetailSummary | null;
  isAssetLoading: boolean;
  presetDetail: PresetDetailSummary | null;
}) {
  const lines = [
    characterDetail
      ? `角色：${characterDetail.name} · ${characterDetail.specVersion} · 世界书 ${
          characterDetail.embeddedBook?.entryCount ?? 0
        }`
      : "角色：本地调试角色",
    presetDetail
      ? `预设：${presetDetail.name} · prompt ${presetDetail.promptCount} · regex ${presetDetail.regexScriptCount}`
      : "预设：最小 Chat Completion 预设",
  ];

  return (
    <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]">
      <div className="mb-2 flex items-center gap-2 font-medium text-[var(--text-primary)]">
        <FileJson2 size={14} />
        {isAssetLoading ? "正在读取本地资产" : "当前发送资产"}
      </div>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function ChatArchiveList({
  archives,
  disabled,
  isLoading,
  loadingArchiveId,
  selectedArchiveId,
  onLoad,
}: {
  archives: ChatArchiveSummary[];
  disabled: boolean;
  isLoading: boolean;
  loadingArchiveId: string | null;
  selectedArchiveId: string | null;
  onLoad: (archiveId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]">
        正在读取本地存档...
      </div>
    );
  }

  if (archives.length === 0) {
    return (
      <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]">
        当前筛选下还没有已保存的对话。
      </div>
    );
  }

  return (
    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {archives.map((archive) => {
        const isSelected = archive.id === selectedArchiveId;
        const isLoadingArchive = archive.id === loadingArchiveId;

        return (
          <div
            key={archive.id}
            className={[
              "rounded-lg border p-3 text-xs leading-5",
              isSelected
                ? "border-[var(--accent)] bg-[var(--accent-weak)]"
                : "border-[var(--border-soft)] bg-[var(--surface-muted)]",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--text-primary)]">
                  {archive.name}
                </p>
                <p className="mt-1 text-[var(--text-muted)]">
                  {archive.characterName ?? "未知角色"} · {archive.messageCount} 行
                </p>
              </div>
              <button
                className="shrink-0 rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={disabled || Boolean(loadingArchiveId)}
                type="button"
                onClick={() => onLoad(archive.id)}
              >
                {isLoadingArchive ? "读取中" : isSelected ? "已加载" : "加载"}
              </button>
            </div>
            {archive.lastMessagePreview ? (
              <p className="mt-2 max-h-10 overflow-hidden text-[var(--text-secondary)]">
                {archive.lastMessagePreview}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function NoticeText({ kind, text }: { kind: "error" | "muted"; text: string }) {
  return (
    <p
      className={[
        "rounded-lg border px-3 py-2 text-xs leading-6",
        kind === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
      ].join(" ")}
    >
      {text}
    </p>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password";
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-[var(--text-primary)]">{label}</span>
      <input
        className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  disabled = false,
  label,
  options,
  value,
  onChange,
}: {
  disabled?: boolean;
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-[var(--text-primary)]">{label}</span>
      <select
        className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-[var(--text-primary)]">{label}</span>
      <textarea
        className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[var(--accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function normalizeName(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : fallback;
}

function formatChatSendError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}。请检查 API Base URL、模型名、API Key，以及端点是否允许浏览器 CORS 请求。`;
  }

  return `${String(error)}。请检查 API 配置。`;
}

function formatChatSaveError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}。保存对话失败，请检查浏览器是否允许 IndexedDB。`;
  }

  return `${String(error)}。保存对话失败。`;
}

function formatChatExportError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}。导出对话失败，请检查浏览器下载权限。`;
  }

  return `${String(error)}。导出对话失败。`;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
