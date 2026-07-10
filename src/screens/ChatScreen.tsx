import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Download,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";

import { getChatMessageDisplayText } from "../lib/chatHistory";
import { estimateChatMessagesTokens } from "../lib/tokenEstimate";
import type { ChatMessageLine, ChatMetadataLine } from "../types/chat";
import {
  SummaryTile,
  type ChatHtmlCardAction,
} from "./ChatScreenPanels";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatMessageList } from "./chat/ChatMessageList";
import { ChatSidebar } from "./chat/ChatSidebar";
import { useChatAssets } from "./chat/useChatAssets";
import { useChatArchives } from "./chat/useChatArchives";
import { useChatImportExport } from "./chat/useChatImportExport";
import { useChatStreamingActions } from "./chat/useChatStreamingActions";
import {
  createChatDraftStatus,
  createGreetingChatMessage,
  defaultCharacterName,
  defaultUserName,
  deleteChatMessageAt,
  localCharacterOptionId,
  minimalPresetOptionId,
  normalizeName,
  appendQuickReplyToInput,
  selectChatMessageSwipeAt,
  updateChatMessageTextAt,
} from "./chatScreenHelpers";

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessageLine[]>([]);
  const [inputText, setInputText] = useState("");
  const interactiveSubmitTextRef = useRef<string | null>(null);
  const chatFormRef = useRef<HTMLFormElement>(null);
  const [isImportingChat, setIsImportingChat] = useState(false);
  const [statusText, setStatusText] = useState("等待输入");
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedArchiveId, setLoadedArchiveId] = useState<string | null>(null);
  const [loadedArchiveName, setLoadedArchiveName] = useState<string | null>(null);
  const [loadedChatMetadata, setLoadedChatMetadata] =
    useState<ChatMetadataLine | null>(null);
  const lastAutoGreetingCharacterIdRef = useRef<string | null>(null);

  const {
    activeCharacter,
    activePreset,
    activeRegexScripts,
    activeWorldInfoEntries,
    apiKey,
    assetError,
    baseUrl,
    characterDescription,
    characterDetailError,
    characterName,
    characters,
    embeddedWorldInfoEntries,
    greetingOptions,
    isAssetLoading,
    isCharacterReady,
    isPresetReady,
    model,
    personaDescription,
    presetDetailError,
    presets,
    selectedCharacterDetail,
    selectedCharacterId,
    selectedPresetDetail,
    selectedPresetId,
    setCharacterDescription,
    setCharacterName,
    setPersonaDescription,
    setSelectedCharacterId,
    setSelectedPresetId,
    setUserName,
    userName,
    visibleQuickReplySets,
  } = useChatAssets({
    loadedArchiveId,
    messageCount: messages.length,
  });
  const {
    canContinue,
    handleContinueMessage,
    handleRerollMessage,
    handleSend,
    handleStop,
    isStreaming,
  } = useChatStreamingActions({
    activeCharacter,
    activePreset,
    activeRegexScripts,
    activeWorldInfoEntries,
    apiKey,
    baseUrl,
    inputText,
    interactiveSubmitTextRef,
    isCharacterReady,
    isImportingChat,
    isPresetReady,
    messages,
    model,
    personaDescription,
    setError,
    setHasUnsavedChanges,
    setInputText,
    setLoadedChatMetadata,
    setMessages,
    setSaveMessage,
    setStatusText,
    userName,
  });
  const canSend =
    !isStreaming &&
    !isImportingChat &&
    inputText.trim().length > 0 &&
    isCharacterReady &&
    isPresetReady;
  const draftStatus = createChatDraftStatus({
    hasUnsavedChanges,
    loadedArchiveName,
    messageCount: messages.length,
  });
  const estimatedTokenCount = useMemo(
    () => estimateChatMessagesTokens(messages),
    [messages],
  );

  const {
    archiveActionId,
    archiveError,
    archives: chatArchives,
    handleDeleteArchive,
    handleLoadArchive,
    handleRenameArchive,
    isArchiveLoading,
    loadingArchiveId,
    refreshChatArchives,
  } = useChatArchives({
    isImportingChat,
    isStreaming,
    loadedArchiveId,
    selectedCharacterId,
    setCharacterName,
    setError,
    setHasUnsavedChanges,
    setLoadedArchiveId,
    setLoadedArchiveName,
    setLoadedChatMetadata,
    setMessages,
    setSaveMessage,
    setStatusText,
    setUserName,
  });

  const {
    canExport,
    canImport,
    canSave,
    chatImportInputRef,
    handleChatImportFileChange,
    handleExport,
    handlePickChatImportFile,
    handleSave,
    isSaving,
  } = useChatImportExport({
    activeCharacter,
    hasUnsavedChanges,
    isImportingChat,
    isStreaming,
    loadedArchiveId,
    loadedArchiveName,
    loadedChatMetadata,
    messages,
    refreshChatArchives,
    selectedCharacterId,
    setCharacterName,
    setError,
    setHasUnsavedChanges,
    setIsImportingChat,
    setLoadedArchiveId,
    setLoadedArchiveName,
    setLoadedChatMetadata,
    setMessages,
    setSaveMessage,
    setStatusText,
    setUserName,
    userName,
  });

  useEffect(() => {
    if (
      selectedCharacterId === localCharacterOptionId ||
      !selectedCharacterDetail ||
      messages.length > 0 ||
      loadedArchiveId ||
      isStreaming ||
      isImportingChat ||
      lastAutoGreetingCharacterIdRef.current === selectedCharacterId
    ) {
      return;
    }

    const greetingMessage = createGreetingChatMessage({
      character: selectedCharacterDetail.stored.payload,
      userName: normalizeName(userName, defaultUserName),
    });

    lastAutoGreetingCharacterIdRef.current = selectedCharacterId;

    if (!greetingMessage) {
      return;
    }

    setMessages([greetingMessage]);
    setLoadedArchiveId(null);
    setLoadedArchiveName(null);
    setLoadedChatMetadata(null);
    setHasUnsavedChanges(true);
    setStatusText("已载入角色首条问候");
  }, [
    isImportingChat,
    isStreaming,
    loadedArchiveId,
    messages.length,
    selectedCharacterDetail,
    selectedCharacterId,
    userName,
  ]);

  const handleHtmlCardAction = useCallback(
    (action: ChatHtmlCardAction) => {
      const text = action.text.trim();
      if (!text) {
        return;
      }

      if (action.action === "appendDraft") {
        setInputText((current) => appendQuickReplyToInput(current, text));
        setStatusText("HTML card content appended to draft");
        return;
      }

      setInputText(text);

      if (action.action === "sendMessage") {
        if (isStreaming) {
          setStatusText("HTML card action is waiting for current generation to finish");
          return;
        }

        interactiveSubmitTextRef.current = text;
        window.setTimeout(() => chatFormRef.current?.requestSubmit(), 0);
        return;
      }

      setStatusText("HTML card content copied to draft");
    },
    [isStreaming],
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
    lastAutoGreetingCharacterIdRef.current = null;
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

  return (
    <section className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(340px,1fr)_minmax(360px,0.85fr)] xl:items-end">
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
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <SummaryTile label="消息行" value={messages.length} />
            <SummaryTile label="Token 估算" value={`约 ${estimatedTokenCount}`} compact />
            <SummaryTile label="草稿" value={draftStatus} compact />
            <SummaryTile label="模型" value={model.trim() || "未设置"} compact />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex w-full min-h-0 flex-col rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                <MessageSquare size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">本地对话窗口</h2>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {activeCharacter.data.name} ·{" "}
                  {normalizeName(userName, defaultUserName)} · 约{" "}
                  {estimatedTokenCount} token
                </p>
                {loadedArchiveName ? (
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    已加载：{loadedArchiveName}
                  </p>
                ) : null}
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {messages.length > 0
                    ? hasUnsavedChanges
                      ? "正在等待自动保存"
                      : "已自动保存到本地"
                    : "新对话会在出现消息后自动保存"}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <input
                ref={chatImportInputRef}
                className="hidden"
                type="file"
                accept=".jsonl,.json,application/json,application/x-ndjson,text/plain"
                onChange={(event) => void handleChatImportFileChange(event)}
              />
              <button
                className="inline-flex min-w-[4.75rem] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
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
                className="inline-flex min-w-[4.75rem] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canExport}
                type="button"
                onClick={handleExport}
              >
                <Download size={14} />
                导出
              </button>
              <button
                className="inline-flex min-w-[4.75rem] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canContinue}
                type="button"
                onClick={() => void handleContinueMessage()}
              >
                <RotateCcw size={14} />
                继续
              </button>
              <button
                className="inline-flex min-w-[4.75rem] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
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
                className="inline-flex min-w-[4.75rem] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isStreaming || isImportingChat}
                type="button"
                onClick={handleNewChat}
              >
                <Plus size={14} />
                新建
              </button>
            </div>
          </div>

          <div className="min-h-0 px-4 py-4">
            <ChatMessageList
              disabled={isStreaming || isImportingChat}
              displayRegexScripts={activeRegexScripts}
              messages={messages}
              onDelete={handleDeleteMessage}
              onEdit={handleEditMessage}
              onHtmlCardAction={handleHtmlCardAction}
              onReroll={(messageIndex) => void handleRerollMessage(messageIndex)}
              onSwipe={handleSelectMessageSwipe}
            />
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

          <ChatComposer
            canSend={canSend}
            formRef={chatFormRef}
            inputText={inputText}
            isStreaming={isStreaming}
            quickReplySets={visibleQuickReplySets}
            statusText={statusText}
            onAppendQuickReply={(message) =>
              setInputText((current) => appendQuickReplyToInput(current, message))
            }
            onInputChange={setInputText}
            onStop={handleStop}
            onSubmit={(event) => void handleSend(event)}
          />
        </div>

        <ChatSidebar
          archiveActionId={archiveActionId}
          archiveError={archiveError}
          archives={chatArchives}
          assetError={assetError}
          characterDescription={characterDescription}
          characterDetail={selectedCharacterDetail}
          characterDetailError={characterDetailError}
          characterName={characterName}
          characters={characters}
          disabled={isStreaming || isImportingChat}
          embeddedWorldInfoCount={embeddedWorldInfoEntries?.length}
          greetings={greetingOptions}
          isArchiveLoading={isArchiveLoading}
          isAssetLoading={isAssetLoading}
          loadingArchiveId={loadingArchiveId}
          localCharacterOptionId={localCharacterOptionId}
          minimalPresetOptionId={minimalPresetOptionId}
          personaDescription={personaDescription}
          presetDetail={selectedPresetDetail}
          presetDetailError={presetDetailError}
          presets={presets}
          selectedArchiveId={loadedArchiveId}
          selectedCharacterId={selectedCharacterId}
          selectedPresetId={selectedPresetId}
          userName={userName}
          onApplyGreeting={handleApplyGreeting}
          onCharacterDescriptionChange={setCharacterDescription}
          onCharacterNameChange={setCharacterName}
          onDeleteArchive={(archive) => void handleDeleteArchive(archive)}
          onLoadArchive={(archiveId) => void handleLoadArchive(archiveId)}
          onPersonaDescriptionChange={setPersonaDescription}
          onRenameArchive={(archive) => void handleRenameArchive(archive)}
          onSelectedCharacterIdChange={setSelectedCharacterId}
          onSelectedPresetIdChange={setSelectedPresetId}
          onUserNameChange={setUserName}
        />
      </div>
    </section>
  );
}
