import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";

import { downloadBytesToFile } from "../../lib/browserDownload";
import type { CharacterCard } from "../../types/character";
import type { ChatMessageLine, ChatMetadataLine } from "../../types/chat";
import { createChatJsonlExport } from "../../services/chatExport";
import { importChatToDatabase } from "../../services/chatImport";
import { saveChatSnapshotToDatabase } from "../../services/chatPersistence";
import {
  createChatImportDatabaseOptions,
  createChatSaveSnapshotInput,
  createImportedChatScreenState,
  defaultCharacterName,
  defaultUserName,
  formatChatExportError,
  formatChatImportError,
  formatChatSaveError,
  localCharacterOptionId,
  normalizeName,
} from "../chatScreenHelpers";

interface UseChatImportExportInput {
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
  const [isSaving, setIsSaving] = useState(false);
  const chatImportInputRef = useRef<HTMLInputElement>(null);
  const canImport = !input.isStreaming && !input.isImportingChat;
  const canSave =
    !input.isStreaming && !isSaving && !input.isImportingChat && input.messages.length > 0;
  const canExport =
    !input.isStreaming && !input.isImportingChat && input.messages.length > 0;

  const autoSaveChat = useCallback(async () => {
    if (input.messages.length === 0 || input.isStreaming || input.isImportingChat || isSaving) {
      return;
    }
    setIsSaving(true);
    input.setError(null);
    try {
      const stored = await saveChatSnapshotToDatabase({
        ...createChatSaveSnapshotInput({
          activeCharacter: input.activeCharacter,
          chatMetadata: input.loadedChatMetadata ?? undefined,
          messages: input.messages,
          selectedCharacterId: input.selectedCharacterId,
          userName: input.userName,
        }),
        id: input.loadedArchiveId ?? undefined,
        name: input.loadedArchiveName ?? undefined,
      });
      input.setLoadedArchiveId(stored.id);
      input.setLoadedArchiveName(stored.name);
      input.setHasUnsavedChanges(false);
      input.setSaveMessage(`已自动保存：${stored.name}`);
      input.setStatusText("对话已自动保存到本地数据库");
      await input.refreshChatArchives({ silent: true });
    } catch (error: unknown) {
      input.setError(formatChatSaveError(error));
      input.setHasUnsavedChanges(false);
      input.setStatusText("自动保存失败");
    } finally {
      setIsSaving(false);
    }
  }, [input, isSaving]);

  useEffect(() => {
    if (
      !input.hasUnsavedChanges ||
      input.messages.length === 0 ||
      input.isStreaming ||
      input.isImportingChat ||
      isSaving
    ) {
      return;
    }
    const timer = window.setTimeout(() => void autoSaveChat(), 800);
    return () => window.clearTimeout(timer);
  }, [autoSaveChat, input.hasUnsavedChanges, input.isImportingChat, input.isStreaming, input.messages.length, isSaving]);

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

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setIsSaving(true);
    input.setError(null);
    input.setSaveMessage(null);
    try {
      const stored = await saveChatSnapshotToDatabase(
        createChatSaveSnapshotInput({
          activeCharacter: input.activeCharacter,
          chatMetadata: input.loadedChatMetadata ?? undefined,
          messages: input.messages,
          selectedCharacterId: input.selectedCharacterId,
          userName: input.userName,
        }),
      );
      input.setSaveMessage(`已保存：${stored.name}`);
      input.setLoadedArchiveId(stored.id);
      input.setLoadedArchiveName(stored.name);
      input.setHasUnsavedChanges(false);
      input.setStatusText("对话已保存到本地数据库");
      await input.refreshChatArchives({ silent: true });
    } catch (error: unknown) {
      input.setError(formatChatSaveError(error));
      input.setStatusText("保存失败");
    } finally {
      setIsSaving(false);
    }
  }, [canSave, input]);

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
