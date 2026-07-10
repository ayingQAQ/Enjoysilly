import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import {
  runStreamingChatContinue,
  runStreamingChatReroll,
  runStreamingChatTurn,
} from "../../lib/chatStreaming";
import type { RegexScriptLike } from "../../lib/regexEngine";
import type { WorldInfoScanInputEntry } from "../../lib/worldInfoScan";
import type { CharacterCard } from "../../types/character";
import type { ChatMessageLine, ChatMetadataLine } from "../../types/chat";
import type { ChatCompletionPreset } from "../../types/preset";
import {
  defaultUserName,
  formatChatSendError,
  getLastAssistantMessageIndex,
  isAbortError,
  normalizeName,
} from "../chatScreenHelpers";

interface UseChatStreamingActionsInput {
  activeCharacter: CharacterCard;
  activePreset: ChatCompletionPreset;
  activeRegexScripts: RegexScriptLike[];
  activeWorldInfoEntries?: WorldInfoScanInputEntry[];
  apiKey: string;
  baseUrl: string;
  inputText: string;
  interactiveSubmitTextRef: MutableRefObject<string | null>;
  isCharacterReady: boolean;
  isImportingChat: boolean;
  isPresetReady: boolean;
  messages: ChatMessageLine[];
  model: string;
  personaDescription: string;
  setError: Dispatch<SetStateAction<string | null>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  setInputText: Dispatch<SetStateAction<string>>;
  setLoadedChatMetadata: Dispatch<SetStateAction<ChatMetadataLine | null>>;
  setMessages: Dispatch<SetStateAction<ChatMessageLine[]>>;
  setSaveMessage: Dispatch<SetStateAction<string | null>>;
  setStatusText: Dispatch<SetStateAction<string>>;
  userName: string;
}

export function useChatStreamingActions(input: UseChatStreamingActionsInput) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastAssistantMessageIndex = getLastAssistantMessageIndex(input.messages);
  const canContinue =
    !isStreaming &&
    !input.isImportingChat &&
    input.isCharacterReady &&
    input.isPresetReady &&
    lastAssistantMessageIndex !== undefined;

  const handleSend = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const submittedText = input.interactiveSubmitTextRef.current ?? input.inputText;
      input.interactiveSubmitTextRef.current = null;
      const userText = submittedText.trim();
      const trimmedBaseUrl = input.baseUrl.trim();
      const trimmedModel = input.model.trim();

      if (!userText || isStreaming) return;
      if (!input.isCharacterReady || !input.isPresetReady) {
        input.setError("正在读取选中的角色或预设，请稍后再发送。");
        return;
      }
      if (!trimmedBaseUrl) {
        input.setError("请先填写 OpenAI 兼容 API Base URL。");
        return;
      }
      if (!trimmedModel) {
        input.setError("请先填写模型名称。");
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      input.setStatusText("正在请求模型");
      input.setError(null);
      input.setSaveMessage(null);
      input.setLoadedChatMetadata(null);
      input.setInputText("");

      try {
        for await (const update of runStreamingChatTurn({
          baseUrl: trimmedBaseUrl,
          apiKey: input.apiKey,
          model: trimmedModel,
          preset: input.activePreset,
          character: input.activeCharacter,
          messages: input.messages,
          userName: normalizeName(input.userName, defaultUserName),
          userText,
          personaDescription: input.personaDescription,
          worldInfoEntries: input.activeWorldInfoEntries,
          signal: controller.signal,
          regexScripts: input.activeRegexScripts,
        })) {
          input.setMessages(update.messages);
          input.setHasUnsavedChanges(true);
          input.setStatusText(
            update.kind === "started"
              ? "模型已连接，等待首个 token"
              : update.kind === "delta"
                ? "正在流式接收"
                : update.finishReason
                  ? `完成：${update.finishReason}`
                  : "回复完成",
          );
        }
      } catch (error: unknown) {
        if (isAbortError(error)) {
          input.setStatusText("已停止生成");
          return;
        }
        input.setError(formatChatSendError(error));
        input.setStatusText("请求失败");
      } finally {
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [input, isStreaming],
  );

  const handleRerollMessage = useCallback(
    async (messageIndex: number) => {
      if (
        isStreaming ||
        input.isImportingChat ||
        !input.isCharacterReady ||
        !input.isPresetReady
      ) {
        return;
      }
      const targetMessage = input.messages[messageIndex];
      if (!targetMessage || targetMessage.is_user || targetMessage.is_system) return;

      const trimmedBaseUrl = input.baseUrl.trim();
      const trimmedModel = input.model.trim();
      if (!trimmedBaseUrl) {
        input.setError("请先填写 OpenAI 兼容 API Base URL。");
        return;
      }
      if (!trimmedModel) {
        input.setError("请先填写模型名称。");
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      input.setStatusText("正在重新生成当前消息");
      input.setError(null);
      input.setSaveMessage(null);

      try {
        for await (const update of runStreamingChatReroll({
          assistantMessageIndex: messageIndex,
          baseUrl: trimmedBaseUrl,
          apiKey: input.apiKey,
          model: trimmedModel,
          preset: input.activePreset,
          character: input.activeCharacter,
          messages: input.messages,
          userName: normalizeName(input.userName, defaultUserName),
          personaDescription: input.personaDescription,
          worldInfoEntries: input.activeWorldInfoEntries,
          signal: controller.signal,
          regexScripts: input.activeRegexScripts,
        })) {
          input.setMessages(update.messages);
          input.setHasUnsavedChanges(true);
          input.setStatusText(
            update.kind === "started"
              ? "已创建新的 swipe，等待模型响应"
              : update.kind === "delta"
                ? "正在接收重新生成内容"
                : update.finishReason
                  ? `重新生成完成：${update.finishReason}`
                  : "重新生成完成",
          );
        }
      } catch (error: unknown) {
        if (isAbortError(error)) {
          input.setStatusText("已停止重新生成");
          return;
        }
        input.setError(formatChatSendError(error));
        input.setStatusText("重新生成失败");
      } finally {
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [input, isStreaming],
  );

  const handleContinueMessage = useCallback(async () => {
    if (!canContinue || lastAssistantMessageIndex === undefined) return;
    const trimmedBaseUrl = input.baseUrl.trim();
    const trimmedModel = input.model.trim();
    if (!trimmedBaseUrl) {
      input.setError("请先填写 OpenAI 兼容 API Base URL。");
      return;
    }
    if (!trimmedModel) {
      input.setError("请先填写模型名称。");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);
    input.setStatusText("正在继续最后一条回复");
    input.setError(null);
    input.setSaveMessage(null);

    try {
      for await (const update of runStreamingChatContinue({
        assistantMessageIndex: lastAssistantMessageIndex,
        baseUrl: trimmedBaseUrl,
        apiKey: input.apiKey,
        model: trimmedModel,
        preset: input.activePreset,
        character: input.activeCharacter,
        messages: input.messages,
        userName: normalizeName(input.userName, defaultUserName),
        personaDescription: input.personaDescription,
        worldInfoEntries: input.activeWorldInfoEntries,
        signal: controller.signal,
        regexScripts: input.activeRegexScripts,
      })) {
        input.setMessages(update.messages);
        input.setHasUnsavedChanges(true);
        input.setStatusText(
          update.kind === "started"
            ? "已请求继续回复，等待模型响应"
            : update.kind === "delta"
              ? "正在接收继续内容"
              : update.finishReason
                ? `继续完成：${update.finishReason}`
                : "继续完成",
        );
      }
    } catch (error: unknown) {
      if (isAbortError(error)) {
        input.setStatusText("已停止继续");
        return;
      }
      input.setError(formatChatSendError(error));
      input.setStatusText("继续失败");
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [canContinue, input, lastAssistantMessageIndex]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    canContinue,
    handleContinueMessage,
    handleRerollMessage,
    handleSend,
    handleStop,
    isStreaming,
  };
}
