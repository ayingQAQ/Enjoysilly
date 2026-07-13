import { Download, Loader2, MessageSquare, Plus, RotateCcw, Save, Upload } from "lucide-react";
import type { ChangeEvent, FormEvent, ReactNode, RefObject } from "react";

import type { RegexScriptLike } from "../../lib/regexEngine";
import type { StoredQuickReplySet } from "../../lib/db";
import type { ChatMessageLine } from "../../types/chat";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageList } from "./ChatMessageList";
import type { ChatHtmlCardAction } from "./ChatMessageBubble";

interface ChatConversationPaneProps {
  activeCharacterName: string;
  canContinue: boolean;
  canExport: boolean;
  canImport: boolean;
  canSave: boolean;
  canSend: boolean;
  chatImportInputRef: RefObject<HTMLInputElement>;
  displayRegexScripts: RegexScriptLike[];
  error: string | null;
  formRef: RefObject<HTMLFormElement>;
  hasUnsavedChanges: boolean;
  inputText: string;
  isImporting: boolean;
  isSaving: boolean;
  isStreaming: boolean;
  loadedArchiveName: string | null;
  messages: ChatMessageLine[];
  quickReplySets: StoredQuickReplySet[];
  saveMessage: string | null;
  statusText: string;
  tokenCount: number;
  userName: string;
  onAppendQuickReply: (message: string) => void;
  onChatImportChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onContinue: () => void;
  onDeleteMessage: (messageIndex: number) => void;
  onEditMessage: (messageIndex: number) => void;
  onExport: () => void;
  onHtmlCardAction: (action: ChatHtmlCardAction) => void;
  onInputChange: (value: string) => void;
  onNewChat: () => void;
  onPickChatImport: () => void;
  onRerollMessage: (messageIndex: number) => void;
  onSave: () => void;
  onSelectSwipe: (messageIndex: number, direction: -1 | 1) => void;
  onStop: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ChatConversationPane(props: ChatConversationPaneProps) {
  const disabled = props.isStreaming || props.isImporting;

  return (
    <div className="flex w-full min-h-0 flex-col rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
            <MessageSquare size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">本地对话窗口</h2>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {props.activeCharacterName} · {props.userName} · 约 {props.tokenCount} token
            </p>
            {props.loadedArchiveName ? (
              <p className="truncate text-xs text-[var(--text-muted)]">
                已加载：{props.loadedArchiveName}
              </p>
            ) : null}
            <p className="truncate text-xs text-[var(--text-muted)]">
              {props.messages.length > 0
                ? props.hasUnsavedChanges
                  ? "正在等待自动保存"
                  : "已自动保存到本地"
                : "新对话会在出现消息后自动保存"}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <input
            ref={props.chatImportInputRef}
            className="hidden"
            type="file"
            accept=".jsonl,.json,application/json,application/x-ndjson,text/plain"
            onChange={props.onChatImportChange}
          />
          <ToolbarButton disabled={!props.canImport} onClick={props.onPickChatImport}>
            {props.isImporting ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            导入
          </ToolbarButton>
          <ToolbarButton disabled={!props.canExport} onClick={props.onExport}>
            <Download size={14} />导出
          </ToolbarButton>
          <ToolbarButton disabled={!props.canContinue} onClick={props.onContinue}>
            <RotateCcw size={14} />继续
          </ToolbarButton>
          <ToolbarButton disabled={!props.canSave} onClick={props.onSave}>
            {props.isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            保存
          </ToolbarButton>
          <ToolbarButton disabled={disabled} onClick={props.onNewChat}>
            <Plus size={14} />新建
          </ToolbarButton>
        </div>
      </div>

      <div className="min-h-0 px-4 py-4">
        <ChatMessageList
          disabled={disabled}
          displayRegexScripts={props.displayRegexScripts}
          messages={props.messages}
          onDelete={props.onDeleteMessage}
          onEdit={props.onEditMessage}
          onHtmlCardAction={props.onHtmlCardAction}
          onReroll={props.onRerollMessage}
          onSwipe={props.onSelectSwipe}
        />
      </div>
      {props.error ? <Notice tone="error" text={props.error} /> : null}
      {props.saveMessage ? <Notice tone="success" text={props.saveMessage} /> : null}
      <ChatComposer
        canSend={props.canSend}
        formRef={props.formRef}
        inputText={props.inputText}
        isStreaming={props.isStreaming}
        quickReplySets={props.quickReplySets}
        statusText={props.statusText}
        onAppendQuickReply={props.onAppendQuickReply}
        onInputChange={props.onInputChange}
        onStop={props.onStop}
        onSubmit={props.onSubmit}
      />
    </div>
  );
}

function ToolbarButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex min-w-[4.75rem] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Notice({ tone, text }: { tone: "error" | "success"; text: string }) {
  return (
    <p
      className={
        tone === "error"
          ? "mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700"
          : "mx-4 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-700"
      }
    >
      {text}
    </p>
  );
}
