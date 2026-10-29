import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatContextPanel, useChatContextLayout } from "./chat/ChatContextPanel";
import { ChatPromptPreview } from "./chat/ChatPromptPreview";

import { getChatMessageDisplayText } from "../lib/chatHistory";
import { estimateChatMessagesTokens } from "../lib/tokenEstimate";
import { ChatSaveCoordinator } from "../services/chatSaveCoordinator";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { useChatDraftRecovery } from "./chat/useChatDraftRecovery";
import { ChatMessageEditor, type MessageEditDraft } from "./chat/ChatMessageEditor";
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
  const [saveCoordinator] = useState(() => new ChatSaveCoordinator());
  const [messages, setMessages] = useState<ChatMessageLine[]>([]);
  const [inputText, setInputText] = useState("");
  const [messageEdit, setMessageEdit] = useState<MessageEditDraft | null>(null);
  const interactiveSubmitTextRef = useRef<string | null>(null);
  const chatFormRef = useRef<HTMLFormElement>(null);
  const [isImportingFile, setIsImportingChat] = useState(false);
  const [statusText, setStatusText] = useState("等待输入");
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedArchiveId, setLoadedArchiveId] = useState<string | null>(null);
  const [loadedArchiveName, setLoadedArchiveName] = useState<string | null>(null);
  const [loadedChatMetadata, setLoadedChatMetadata] =
    useState<ChatMetadataLine | null>(null);
  const { wide: isWideChat, open: isContextPanelOpen, setOpen: setIsContextPanelOpen } = useChatContextLayout();
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
    isSettingsLoading,
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
  const workspaceDraft = useMemo(() => ({
    version: 1 as const, inputText, messages, archiveId: loadedArchiveId,
    archiveUpdatedAt: saveCoordinator.getArchiveVersion(),
    archiveName: loadedArchiveName, metadata: loadedChatMetadata, dirty: hasUnsavedChanges,
    characterId: selectedCharacterId, presetId: selectedPresetId, userName,
    characterName, characterDescription, personaDescription,
    messageEdit,
  }), [inputText, messages, loadedArchiveId, loadedArchiveName, loadedChatMetadata,
    hasUnsavedChanges, selectedCharacterId, selectedPresetId, userName, characterName,
    characterDescription, personaDescription, messageEdit]);
  const draftRecovery = useChatDraftRecovery(workspaceDraft, draft => {
    saveCoordinator.beginSession(draft.archiveId ?? undefined, draft.archiveUpdatedAt ?? undefined);
    setInputText(draft.inputText);
    setMessageEdit(draft.messageEdit ?? null);
    setMessages(draft.messages);
    setLoadedArchiveId(draft.archiveId);
    setLoadedArchiveName(draft.archiveName);
    setLoadedChatMetadata(draft.metadata);
    setHasUnsavedChanges(draft.dirty);
    setSelectedCharacterId(draft.characterId);
    if (draft.presetId) setSelectedPresetId(draft.presetId);
    setUserName(draft.userName);
    if (draft.characterName !== undefined) setCharacterName(draft.characterName);
    if (draft.characterDescription !== undefined) setCharacterDescription(draft.characterDescription);
    if (draft.personaDescription !== undefined) setPersonaDescription(draft.personaDescription);
    setStatusText(draft.recoveryNotice ?? "本地草稿已恢复（不代表存档已保存）");
    setRecoveryNotice(draft.recoveryNotice ?? null);
  }, !isSettingsLoading && !isAssetLoading);
  const isImportingChat = isImportingFile || !draftRecovery.ready;
  const {
    canContinue,
    preview,
    sendPreview,
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
    saveCoordinator,
    hasUnsavedChanges,
    setIsImportingChat,
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
    saveCoordinator,
    onSavedArchive: async (stored, latest) => {
      const persisted = await draftRecovery.persist({ ...workspaceDraft,
        archiveId: stored.id, archiveName: stored.name, archiveUpdatedAt: stored.updatedAt, dirty: !latest });
      if (!persisted) throw new Error("存档已写入，但恢复草稿更新失败，请重试保存");
    },
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

  useUnsavedChanges({
    label: "当前对话",
    dirty: hasUnsavedChanges || inputText.length > 0 || messageEdit !== null,
    busy: isStreaming || isImportingChat || isSaving,
    save: async () => {
      if (!await draftRecovery.persist()) return false;
      return !hasUnsavedChanges || await handleSave();
    },
    discard: draftRecovery.discard,
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
      if (isImportingChat) return;
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
    [isStreaming, isImportingChat],
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

    saveCoordinator.beginSession();
    setMessages([]);
    setError(null);
    setSaveMessage(null);
    setLoadedArchiveId(null);
    setLoadedArchiveName(null);
    setLoadedChatMetadata(null);
    setHasUnsavedChanges(false);
    lastAutoGreetingCharacterIdRef.current = null;
    setStatusText("等待输入");
  }, [isImportingChat, isStreaming, messages.length, saveCoordinator]);

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

      saveCoordinator.beginSession();
      setMessages([greetingMessage]);
      setError(null);
      setSaveMessage(null);
      setLoadedArchiveId(null);
      setLoadedArchiveName(null);
      setLoadedChatMetadata(null);
      setHasUnsavedChanges(true);
      setStatusText("已应用角色首条问候");
    },
    [activeCharacter, isImportingChat, isStreaming, messages.length, userName, saveCoordinator],
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
      setMessageEdit({ index: messageIndex, original: currentText, text: currentText });
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
    <section className="relative mx-auto flex h-full min-h-0 max-w-[1600px] flex-col p-2 sm:p-4 lg:p-5">
      {preview.open && <ChatPromptPreview data={preview.data} error={preview.error} onClose={preview.close} onSend={sendPreview} />}
      {messageEdit && <ChatMessageEditor draft={messageEdit} onChange={setMessageEdit}
        onClose={async () => {
          if (await draftRecovery.persist({ ...workspaceDraft, messageEdit: null })) setMessageEdit(null);
        }} onSave={async () => {
          const original = messages[messageEdit.index];
          if (!original || getChatMessageDisplayText(original) !== messageEdit.original) {
            setError("消息已发生变化，无法应用旧编辑草稿。请复制内容后关闭并重新编辑。");
            return false;
          }
          const updated = updateChatMessageTextAt(messages, messageEdit.index, messageEdit.text);
          if (!await draftRecovery.persist({ ...workspaceDraft, messages: updated, dirty: true, messageEdit: null })) return false;
          setMessages(updated);
          setMessageEdit(null);
          setHasUnsavedChanges(true);
          setSaveMessage(null);
          setStatusText("消息修改已应用，正在等待存档保存");
          return true;
        }} />}
      {recoveryNotice && <p role="status" className="mb-3 rounded-lg border border-[var(--border-soft)] p-3 text-sm">{recoveryNotice} <button className="underline" onClick={() => setRecoveryNotice(null)}>知道了</button></p>}
      {draftRecovery.error && <p role="alert" className="mb-3 rounded-lg border border-red-300 p-3 text-sm text-red-600">{draftRecovery.error} <button className="underline" onClick={draftRecovery.retry}>重试草稿读写</button></p>}
      <div
        className={[
          "grid min-h-0 flex-1 items-stretch gap-4",
          isContextPanelOpen && isWideChat ? "grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1",
        ].join(" ")}
      >
        <ChatConversationPane
          onPreview={() => void preview.prepare()}
          characterName={activeCharacter.data.name}
          contextOpen={isContextPanelOpen}
          onToggleContext={() => setIsContextPanelOpen(value => !value)}
          disabled={isImportingChat}
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
        {isContextPanelOpen ? <ChatContextPanel wide={isWideChat} onClose={() => setIsContextPanelOpen(false)}><ChatSidebar
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
        /></ChatContextPanel> : null}
      </div>
    </section>
  );
}
