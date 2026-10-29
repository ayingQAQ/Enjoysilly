import {
  useCallback,
  useMemo,
  useRef,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";

import { downloadBytesToFile } from "../../lib/browserDownload";
import type { StoredChat } from "../../lib/db";
import type { CharacterCard } from "../../types/character";
import type { ChatMessageLine, ChatMetadataLine } from "../../types/chat";
import { createChatJsonlExport } from "../../services/chatExport";
import { importChatToDatabase } from "../../services/chatImport";
import type { ChatSaveCoordinator } from "../../services/chatSaveCoordinator";
import { useChatSaving } from "./useChatSaving";
import {
  createChatImportDatabaseOptions,
  createChatSaveSnapshotInput,
  createImportedChatScreenState,
  defaultCharacterName,
  defaultUserName,
  formatChatExportError,
  formatChatImportError,
  formatChatSaveError,
  normalizeName,
} from "../chatScreenHelpers";

interface UseChatImportExportInput {
  saveCoordinator: ChatSaveCoordinator;
  onSavedArchive: (stored: StoredChat, latest: boolean) => Promise<void>;
  activeCharacter: CharacterCard;
  hasUnsavedChanges: boolean;
  isImportingChat: boolean;
  isStreaming: boolean;
  loadedArchiveId: string | null;
  loadedArchiveName: string | null;
  loadedChatMetadata: ChatMetadataLine | null;
  messages: ChatMessageLine[];
  refreshChatArchives: (options?: { silent?: boolean }) => Promise<void>;
  selectedCharacterId: string;
  setCharacterName: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  setIsImportingChat: Dispatch<SetStateAction<boolean>>;
  setLoadedArchiveId: Dispatch<SetStateAction<string | null>>;
  setLoadedArchiveName: Dispatch<SetStateAction<string | null>>;
  setLoadedChatMetadata: Dispatch<SetStateAction<ChatMetadataLine | null>>;
  setMessages: Dispatch<SetStateAction<ChatMessageLine[]>>;
  setSaveMessage: Dispatch<SetStateAction<string | null>>;
  setStatusText: Dispatch<SetStateAction<string>>;
  setUserName: Dispatch<SetStateAction<string>>;
  userName: string;
}

export function useChatImportExport(input: UseChatImportExportInput) {
  const snapshot = useMemo(() => ({
    ...createChatSaveSnapshotInput({
      activeCharacter: input.activeCharacter,
      chatMetadata: input.loadedChatMetadata ?? undefined,
      messages: input.messages,
      selectedCharacterId: input.selectedCharacterId,
      userName: input.userName,
    }),
    id: input.loadedArchiveId ?? undefined,
    name: input.loadedArchiveName ?? undefined,
  }), [input.activeCharacter, input.loadedChatMetadata, input.messages,
    input.selectedCharacterId, input.userName, input.loadedArchiveId, input.loadedArchiveName]);
  const { save: handleSave, isSaving } = useChatSaving({
    coordinator: input.saveCoordinator,
    snapshot,
    dirty: input.hasUnsavedChanges,
    paused: input.isStreaming || input.isImportingChat || (!input.loadedArchiveId && input.messages.length === 0),
    onSaved: async (stored, latest) => {
      input.setLoadedArchiveId(stored.id);
      input.setLoadedArchiveName(stored.name);
      input.setHasUnsavedChanges(!latest);
      input.setError(null);
      input.setSaveMessage(latest ? `已保存：${stored.name}` : "上一版本已保存，最新修改待保存");
      input.setStatusText(latest ? "对话已保存到本地数据库" : "最新修改待保存");
      void input.refreshChatArchives({ silent: true });
      await input.onSavedArchive(stored, latest);
    },
    onError: error => {
      input.setError(`${formatChatSaveError(error)}；内容仍未保存，请点击保存重试。`);
      input.setHasUnsavedChanges(true);
      input.setSaveMessage(null);
      input.setStatusText("保存失败，请重试");
    },
  });
  const chatImportInputRef = useRef<HTMLInputElement>(null);
  const canImport = !input.isStreaming && !input.isImportingChat;
  const canSave =
    !input.isStreaming && !isSaving && !input.isImportingChat && (input.messages.length > 0 || !!input.loadedArchiveId);
  const canExport =
    !input.isStreaming && !input.isImportingChat && input.messages.length > 0;

  const handlePickChatImportFile = useCallback(() => {
    if (canImport) chatImportInputRef.current?.click();
  }, [canImport]);

  const handleChatImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !canImport) return;
      if (
        input.messages.length > 0 &&
        !window.confirm("导入 JSONL 会替换当前页面消息。已保存的本地存档不会被删除，是否继续？")
      ) {
        return;
      }

      input.setIsImportingChat(true);
      input.setError(null);
      input.setSaveMessage(null);
      input.setStatusText("正在导入 JSONL");
      try {
        const imported = await importChatToDatabase(
          new Uint8Array(await file.arrayBuffer()),
          file.name,
          createChatImportDatabaseOptions(input.selectedCharacterId),
        );
        const importedState = createImportedChatScreenState({
          chat: imported.chat,
          selectedCharacterId: input.selectedCharacterId,
          storedId: imported.stored.id,
          storedName: imported.stored.name,
        });
        input.saveCoordinator.beginSession(importedState.loadedArchiveId ?? undefined, imported.stored.updatedAt);
        input.setMessages(importedState.messages);
        input.setUserName(importedState.userName);
        if (importedState.characterName) input.setCharacterName(importedState.characterName);
        input.setLoadedArchiveId(importedState.loadedArchiveId);
        input.setLoadedArchiveName(importedState.loadedArchiveName);
        input.setLoadedChatMetadata(importedState.metadata);
        input.setHasUnsavedChanges(false);
        input.setSaveMessage(
          `已导入并保存：${imported.stored.name}（${imported.chat.messages.length} 行消息）`,
        );
        input.setStatusText("JSONL 已导入到当前页面和本地数据库");
        await input.refreshChatArchives({ silent: true });
      } catch (error: unknown) {
        input.setError(formatChatImportError(error));
        input.setStatusText("导入失败");
      } finally {
        input.setIsImportingChat(false);
      }
    },
    [canImport, input],
  );

  const handleExport = useCallback(() => {
    if (!canExport) return;
    input.setError(null);
    input.setSaveMessage(null);
    try {
      const artifact = createChatJsonlExport({
        messages: input.messages,
        userName: normalizeName(input.userName, defaultUserName),
        characterName: normalizeName(input.activeCharacter.data.name, defaultCharacterName),
        chatName: input.loadedArchiveName ?? undefined,
        metadata: input.loadedChatMetadata ?? undefined,
      });
      downloadBytesToFile(artifact.bytes, artifact.fileName, "application/x-ndjson");
      input.setSaveMessage(`已导出：${artifact.fileName}`);
      input.setStatusText("当前对话已导出为 JSONL");
    } catch (error: unknown) {
      input.setError(formatChatExportError(error));
      input.setStatusText("导出失败");
    }
  }, [canExport, input]);

  return {
    canExport,
    canImport,
    canSave,
    chatImportInputRef,
    handleChatImportFileChange,
    handleExport,
    handlePickChatImportFile,
    handleSave,
    isImportingChat: input.isImportingChat,
    isSaving,
  };
}
