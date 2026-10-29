import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import {
  deleteChatArchive,
  loadChatArchiveDetail,
  loadChatArchiveSummaries,
  renameChatArchive,
  type ChatArchiveSummary,
} from "../../services/chatArchive";
import type { ChatMessageLine, ChatMetadataLine } from "../../types/chat";
import type { ChatSaveCoordinator } from "../../services/chatSaveCoordinator";
import {
  cloneChatMessages,
  cloneChatMetadata,
  defaultCharacterName,
  defaultUserName,
  formatUnknownError,
  getChatArchiveFilterCharacterId,
  localCharacterOptionId,
  normalizeName,
} from "../chatScreenHelpers";

interface UseChatArchivesInput {
  saveCoordinator: ChatSaveCoordinator;
  hasUnsavedChanges: boolean;
  setIsImportingChat: Dispatch<SetStateAction<boolean>>;
  isImportingChat: boolean;
  isStreaming: boolean;
  loadedArchiveId: string | null;
  selectedCharacterId: string;
  setCharacterName: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  setLoadedArchiveId: Dispatch<SetStateAction<string | null>>;
  setLoadedArchiveName: Dispatch<SetStateAction<string | null>>;
  setLoadedChatMetadata: Dispatch<SetStateAction<ChatMetadataLine | null>>;
  setMessages: Dispatch<SetStateAction<ChatMessageLine[]>>;
  setSaveMessage: Dispatch<SetStateAction<string | null>>;
  setStatusText: Dispatch<SetStateAction<string>>;
  setUserName: Dispatch<SetStateAction<string>>;
}

export function useChatArchives(input: UseChatArchivesInput) {
  const [archives, setArchives] = useState<ChatArchiveSummary[]>([]);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiveLoading, setIsArchiveLoading] = useState(true);
  const [loadingArchiveId, setLoadingArchiveId] = useState<string | null>(null);
  const [archiveActionId, setArchiveActionId] = useState<string | null>(null);
  const busy = useRef(false);
  const refreshVersion = useRef(0);
  const latest = useRef(input);
  latest.current = input;
  const archiveFilterCharacterId = getChatArchiveFilterCharacterId(input.selectedCharacterId);

  const refreshChatArchives = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const version = ++refreshVersion.current;
      if (!options.silent) setIsArchiveLoading(true);
      setArchiveError(null);
      try {
        const summaries = await loadChatArchiveSummaries({ characterId: archiveFilterCharacterId });
        if (version === refreshVersion.current) setArchives(summaries);
      } catch (error: unknown) {
        if (version === refreshVersion.current) setArchiveError(formatUnknownError(error));
      } finally {
        if (version === refreshVersion.current) setIsArchiveLoading(false);
      }
    },
    [archiveFilterCharacterId],
  );

  useEffect(() => {
    void refreshChatArchives();
    return () => { refreshVersion.current++; };
  }, [refreshChatArchives]);

  const handleLoadArchive = useCallback(
    async (archiveId: string) => {
      if (input.isStreaming || input.isImportingChat || busy.current) return;
      if (input.hasUnsavedChanges && !window.confirm("当前对话有未保存的修改，确定放弃并加载存档吗？")) return;
      busy.current = true;
      input.setIsImportingChat(true);
      setLoadingArchiveId(archiveId);
      input.setError(null);
      input.setSaveMessage(null);
      setArchiveError(null);
      try {
        await input.saveCoordinator.flush();
        const detail = await loadChatArchiveDetail(archiveId);
        const metadata = detail.stored.payload.metadata;
        input.saveCoordinator.beginSession(archiveId, detail.stored.updatedAt);
        input.setMessages(cloneChatMessages(detail.stored.payload.messages));
        input.setLoadedChatMetadata(cloneChatMetadata(metadata));
        input.setUserName(normalizeName(metadata.user_name, defaultUserName));
        input.setHasUnsavedChanges(false);
        if (input.selectedCharacterId === localCharacterOptionId) {
          input.setCharacterName(
            normalizeName(metadata.character_name, defaultCharacterName),
          );
        }
        input.setLoadedArchiveId(detail.summary.id);
        input.setLoadedArchiveName(detail.summary.name);
        input.setStatusText(`已加载存档：${detail.summary.name}`);
      } catch (error: unknown) {
        setArchiveError(formatUnknownError(error));
        input.setStatusText("读取存档失败");
      } finally {
        busy.current = false;
        input.setIsImportingChat(false);
        setLoadingArchiveId(null);
      }
    },
    [archiveActionId, input, loadingArchiveId],
  );

  const handleRenameArchive = useCallback(
    async (archive: ChatArchiveSummary) => {
      if (input.isStreaming || input.isImportingChat || busy.current) return;
      const nextName = window.prompt("请输入新的对话存档名称", archive.name);
      if (nextName === null || nextName === archive.name) return;
      busy.current = true;
      input.setIsImportingChat(true);

      setArchiveActionId(archive.id);
      input.setError(null);
      input.setSaveMessage(null);
      setArchiveError(null);
      try {
        await input.saveCoordinator.flush();
        const renamed = await renameChatArchive({ chatId: archive.id, name: nextName });
        if (latest.current.loadedArchiveId === archive.id) {
          input.saveCoordinator.beginSession(archive.id, renamed.stored.updatedAt);
          input.setLoadedArchiveName(renamed.summary.name);
        }
        input.setSaveMessage(`已重命名存档：${renamed.summary.name}`);
        input.setStatusText("对话存档已重命名");
        await refreshChatArchives({ silent: true });
      } catch (error: unknown) {
        setArchiveError(formatUnknownError(error));
        input.setStatusText("重命名存档失败");
      } finally {
        busy.current = false;
        input.setIsImportingChat(false);
        setArchiveActionId(null);
      }
    },
    [archiveActionId, input, loadingArchiveId, refreshChatArchives],
  );

  const handleDeleteArchive = useCallback(
    async (archive: ChatArchiveSummary) => {
      if (input.isStreaming || input.isImportingChat || busy.current) return;
      if (
        !window.confirm(
          `确定删除本地对话存档「${archive.name}」吗？此操作不会修改角色卡、预设或 JSONL 导出文件。`,
        )
      ) {
        return;
      }

      busy.current = true;
      input.setIsImportingChat(true);
      setArchiveActionId(archive.id);
      input.setError(null);
      input.setSaveMessage(null);
      setArchiveError(null);
      try {
        await input.saveCoordinator.flush();
        const deleted = await deleteChatArchive(archive.id);
        if (latest.current.loadedArchiveId === archive.id) {
          input.saveCoordinator.beginSession();
          input.setLoadedArchiveId(null);
          input.setLoadedArchiveName(null);
          input.setLoadedChatMetadata(null);
          input.setHasUnsavedChanges(false);
        }
        input.setSaveMessage(`已删除存档：${deleted.name}`);
        input.setStatusText("对话存档已删除");
        await refreshChatArchives({ silent: true });
      } catch (error: unknown) {
        setArchiveError(formatUnknownError(error));
        input.setStatusText("删除存档失败");
      } finally {
        busy.current = false;
        input.setIsImportingChat(false);
        setArchiveActionId(null);
      }
    },
    [archiveActionId, input, loadingArchiveId, refreshChatArchives],
  );

  return {
    archiveActionId,
    archiveError,
    archives,
    handleDeleteArchive,
    handleLoadArchive,
    handleRenameArchive,
    isArchiveLoading,
    loadingArchiveId,
    refreshChatArchives,
  };
}
