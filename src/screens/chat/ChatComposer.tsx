import { Loader2, Send, Square } from "lucide-react";
import type { FormEvent, RefObject } from "react";

import type { StoredQuickReplySet } from "../../lib/db";

interface ChatComposerProps {
  canSend: boolean;
  formRef: RefObject<HTMLFormElement>;
  inputText: string;
  isStreaming: boolean;
  quickReplySets: StoredQuickReplySet[];
  statusText: string;
  onAppendQuickReply: (message: string) => void;
  onInputChange: (value: string) => void;
  onStop: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ChatComposer({
  canSend,
  formRef,
  inputText,
  isStreaming,
  quickReplySets,
  statusText,
  onAppendQuickReply,
  onInputChange,
  onStop,
  onSubmit,
}: ChatComposerProps) {
  return (
    <form
      className="border-t border-[var(--border-soft)] p-4"
      ref={formRef}
      onSubmit={onSubmit}
    >
      <label className="sr-only" htmlFor="chat-message-input">
        输入消息
      </label>
      <textarea
        id="chat-message-input"
        className="min-h-24 w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
        disabled={isStreaming}
        placeholder="输入要发送给模型的消息..."
        value={inputText}
        onChange={(event) => onInputChange(event.target.value)}
      />
      {quickReplySets.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickReplySets.flatMap((quickReplySet) =>
            quickReplySet.payload.qrList.map((item, index) => (
              <button
                key={`${quickReplySet.id}-${index}`}
                className="rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-60"
                disabled={isStreaming}
                type="button"
                onClick={() => onAppendQuickReply(item.message)}
              >
                {item.label}
              </button>
            )),
          )}
        </div>
      ) : null}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-xs text-[var(--text-muted)]">
          {statusText}
        </p>
        <div className="flex gap-2">
          {isStreaming ? (
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:border-red-300"
              type="button"
              onClick={onStop}
            >
              <Square size={15} />
              停止
            </button>
          ) : null}
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSend}
            type="submit"
          >
            {isStreaming ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Send size={16} />
            )}
            发送
          </button>
        </div>
      </div>
    </form>
  );
}
