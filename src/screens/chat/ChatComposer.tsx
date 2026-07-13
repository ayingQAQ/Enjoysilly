import { Send, Square } from "lucide-react";
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
  const shouldShowStatus = statusText !== "等待输入" && !statusText.includes("自动保存");

  return (
    <form
      className="shrink-0 border-t border-[var(--border-soft)] bg-[var(--surface)] p-3 sm:px-5"
      ref={formRef}
      onSubmit={onSubmit}
    >
      <label className="sr-only" htmlFor="chat-message-input">
        输入消息
      </label>
      {quickReplySets.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {quickReplySets.flatMap((quickReplySet) =>
            quickReplySet.payload.qrList.map((item, index) => (
              <button
                key={`${quickReplySet.id}-${index}`}
                className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-60"
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
      <div className="flex items-center gap-2">
        <textarea
          id="chat-message-input"
          className="h-14 min-h-14 flex-1 resize-none rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-weak)]"
          disabled={isStreaming}
          placeholder="输入消息..."
          rows={1}
          value={inputText}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        {isStreaming ? (
          <button
            aria-label="停止生成"
            className="grid size-14 shrink-0 place-items-center rounded-2xl border border-red-200 bg-red-50 text-red-700 transition hover:border-red-300"
            type="button"
            onClick={onStop}
          >
            <Square size={17} />
          </button>
        ) : (
          <button
            aria-label="发送"
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSend}
            type="submit"
          >
            <Send size={21} />
          </button>
        )}
      </div>
      {shouldShowStatus ? <p aria-live="polite" className="mt-2 text-xs text-[var(--text-muted)]">{statusText}</p> : null}
    </form>
  );
}
