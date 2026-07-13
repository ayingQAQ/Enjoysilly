import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PanelRightOpen } from "lucide-react";

import { getChatMessageDisplayText } from "../lib/chatHistory";
import { estimateChatMessagesTokens } from "../lib/tokenEstimate";
import type { ChatMessageLine, ChatMetadataLine } from "../types/chat";
import type { ChatHtmlCardAction } from "./chat/ChatMessageBubble";
import { ChatConversationPane } from "./chat/ChatConversationPane";
import { ChatSidebar } from "./chat/ChatSidebar";
import { useChatAssets } from "./chat/useChatAssets";
import { useChatArchives } from "./chat/useChatArchives";
import { useChatImportExport } from "./chat/useChatImportExport";
import { useChatStreamingActions } from "./chat/useChatStreamingActions";
import {
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
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(true);
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
    <section className="relative mx-auto flex h-full min-h-0 max-w-[1440px] flex-col px-4 py-3 lg:px-6 lg:py-4">
      {!isContextPanelOpen ? (
        <button
          aria-expanded={false}
          className="absolute right-4 top-3 z-10 inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] shadow-sm transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] lg:right-6 lg:top-4"
          type="button"
          onClick={() => setIsContextPanelOpen(true)}
        >
          <PanelRightOpen size={15} />
          打开上下文
        </button>
      ) : null}

      <div
        className={[
          "grid min-h-0 flex-1 items-stretch gap-4",
          isContextPanelOpen ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1",
        ].join(" ")}
      >
        <ChatConversationPane
          canSend={canSend}
          displayRegexScripts={activeRegexScripts}
          error={error}
          formRef={chatFormRef}
          inputText={inputText}
          isStreaming={isStreaming}
          messages={messages}
          quickReplySets={visibleQuickReplySets}
          statusText={statusText}
          onAppendQuickReply={(message) =>
            setInputText((current) => appendQuickReplyToInput(current, message))
          }
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          onHtmlCardAction={handleHtmlCardAction}
          onInputChange={setInputText}
          onRerollMessage={(messageIndex) => void handleRerollMessage(messageIndex)}
          onSelectSwipe={handleSelectMessageSwipe}
          onStop={handleStop}
          onSubmit={(event) => void handleSend(event)}
        />
        {isContextPanelOpen ? <ChatSidebar
          activeCharacterName={activeCharacter.data.name}
          archiveActionId={archiveActionId}
          archiveError={archiveError}
          archives={chatArchives}
          assetError={assetError}
          characterDescription={characterDescription}
          characterDetail={selectedCharacterDetail}
          characterDetailError={characterDetailError}
          characterName={characterName}
          characters={characters}
          canContinue={canContinue}
          canExport={canExport}
          canImport={canImport}
          canSave={canSave}
          chatImportInputRef={chatImportInputRef}
          disabled={isStreaming || isImportingChat}
          embeddedWorldInfoCount={embeddedWorldInfoEntries?.length}
          greetings={greetingOptions}
          isArchiveLoading={isArchiveLoading}
          isAssetLoading={isAssetLoading}
          isImporting={isImportingChat}
          isSaving={isSaving}
          loadingArchiveId={loadingArchiveId}
          localCharacterOptionId={localCharacterOptionId}
          loadedArchiveName={loadedArchiveName}
          minimalPresetOptionId={minimalPresetOptionId}
          model={model}
          personaDescription={personaDescription}
          presetDetail={selectedPresetDetail}
          presetDetailError={presetDetailError}
          presets={presets}
          selectedArchiveId={loadedArchiveId}
          selectedCharacterId={selectedCharacterId}
          selectedPresetId={selectedPresetId}
          tokenCount={estimatedTokenCount}
          userName={userName}
          onClose={() => setIsContextPanelOpen(false)}
          onApplyGreeting={handleApplyGreeting}
          onCharacterDescriptionChange={setCharacterDescription}
          onCharacterNameChange={setCharacterName}
          onChatImportChange={(event) => void handleChatImportFileChange(event)}
          onDeleteArchive={(archive) => void handleDeleteArchive(archive)}
          onContinue={() => void handleContinueMessage()}
          onExport={handleExport}
          onLoadArchive={(archiveId) => void handleLoadArchive(archiveId)}
          onNewChat={handleNewChat}
          onPersonaDescriptionChange={setPersonaDescription}
          onPickChatImport={handlePickChatImportFile}
          onRenameArchive={(archive) => void handleRenameArchive(archive)}
          onSelectedCharacterIdChange={setSelectedCharacterId}
          onSelectedPresetIdChange={setSelectedPresetId}
          onSave={() => void handleSave()}
          onUserNameChange={setUserName}
        /> : null}
      </div>
    </section>
  );
}
