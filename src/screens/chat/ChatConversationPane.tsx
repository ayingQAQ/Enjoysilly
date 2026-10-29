import { Eye, MessageSquare, PanelRightOpen, PanelRightClose } from "lucide-react";
import type { FormEvent, RefObject } from "react";

import type { RegexScriptLike } from "../../lib/regexEngine";
import type { StoredQuickReplySet } from "../../lib/db";
import type { ChatMessageLine } from "../../types/chat";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageList } from "./ChatMessageList";
import type { ChatHtmlCardAction } from "./ChatMessageBubble";

interface ChatConversationPaneProps {
  onPreview: () => void;
  characterName: string;
  contextOpen: boolean;
  onToggleContext: () => void;
  disabled?: boolean;
  canSend: boolean;
  displayRegexScripts: RegexScriptLike[];
  error: string | null;
  formRef: RefObject<HTMLFormElement>;
  inputText: string;
  isStreaming: boolean;
  messages: ChatMessageLine[];
  quickReplySets: StoredQuickReplySet[];
  statusText: string;
  onAppendQuickReply: (message: string) => void;
  onDeleteMessage: (messageIndex: number) => void;
  onEditMessage: (messageIndex: number) => void;
  onHtmlCardAction: (action: ChatHtmlCardAction) => void;
  onInputChange: (value: string) => void;
  onRerollMessage: (messageIndex: number) => void;
  onSelectSwipe: (messageIndex: number, direction: -1 | 1) => void;
  onStop: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ChatConversationPane(props: ChatConversationPaneProps) {
  const disabled = props.isStreaming || Boolean(props.disabled);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border-soft)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-weak)] text-[var(--accent-strong)]">
            <MessageSquare size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{props.characterName || "对话内容"}</h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">对话 · {props.messages.length} 条消息</p>
          </div>
        </div>
        <button type="button" aria-label="预览提示词" title="预览提示词" disabled={!props.canSend || disabled} onClick={props.onPreview}
          className="ml-auto grid size-11 shrink-0 place-items-center rounded-lg border border-[var(--border-soft)] disabled:opacity-40"><Eye size={16}/></button>
        <button type="button" aria-label={props.contextOpen ? "收起上下文" : "打开上下文"} aria-expanded={props.contextOpen}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          onClick={props.onToggleContext}>
          {props.contextOpen ? <PanelRightClose size={16}/> : <PanelRightOpen size={16}/>}<span className="hidden sm:inline">角色与存档</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-3xl">
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
      </div>
      {props.error ? <Notice tone="error" text={props.error} /> : null}
      <ChatComposer
        disabled={props.disabled}
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

function Notice({ tone, text }: { tone: "error"; text: string }) {
  return (
    <p
      className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700"
    >
      {text}
    </p>
  );
}
