import { useRef } from "react";
import { createChatBranch } from "../../services/chatBranch";
import { createChatLogSnapshot } from "../../services/chatPersistence";
import type { ChatSaveCoordinator } from "../../services/chatSaveCoordinator";
import type { ChatMessageLine, ChatMetadataLine } from "../../types/chat";

export function useChatBranch(input: {
  messages: ChatMessageLine[]; metadata: ChatMetadataLine | null; userName: string; characterName: string;
  archiveId: string | null; archiveName: string | null; characterId?: string;
  disabled: boolean; coordinator: ChatSaveCoordinator;
  setBusy: (value: boolean) => void; setError: (value: string | null) => void;
  setStatus: (value: string) => void; refresh: () => Promise<void>;
}) {
  const busy = useRef(false);
  return async (index: number) => {
    if (busy.current || input.disabled || !input.messages[index]) return;
    if (!window.confirm(`将第 1–${index + 1} 条消息保存为独立分支。当前对话与原存档不会被替换，是否继续？`)) return;
    const payload = createChatLogSnapshot({ messages: input.messages, metadata: input.metadata ?? undefined, userName: input.userName, characterName: input.characterName });
    const isCurrent = input.coordinator.captureSession();
    busy.current = true; input.setBusy(true); input.setError(null);
    try {
      await input.coordinator.flush();
      if (!isCurrent()) throw new Error("会话已切换，请重新选择分支位置。");
      const branch = await createChatBranch({ name: `${input.archiveName || input.characterName || "对话"} · 分支 #${index + 1}`, payload, throughIndex: index,
        sourceArchiveId: input.archiveId ?? undefined, expectedUpdatedAt: input.coordinator.getArchiveVersion() ?? undefined, characterId: input.characterId });
      input.setStatus(`已创建分支：${branch.name}，可在存档中加载；当前对话未切换。`);
      await input.refresh();
    } catch (error) { input.setError(error instanceof Error ? error.message : "分支保存失败，请重试。"); }
    finally { busy.current = false; input.setBusy(false); }
  };
}
