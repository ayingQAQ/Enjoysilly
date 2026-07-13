import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileJson2, Pencil, Trash2 } from "lucide-react";

import { getChatMessageDisplayText } from "../../lib/chatHistory";
import {
  isRenderableHtmlDocumentMessage,
  renderSafeHtmlDocumentToSrcDoc,
  renderSafeMarkdownToHtml,
} from "../../lib/markdown";
import { executeRegexScriptsAsync, type RegexScriptLike } from "../../lib/regexEngine";
import { estimateTextTokens } from "../../lib/tokenEstimate";
import type { ChatMessageLine } from "../../types/chat";
import { getMessageSwipeCount, normalizeMessageSwipeIndex } from "../chatScreenHelpers";

export type ChatHtmlCardAction = {
  action: "appendDraft" | "sendMessage" | "setDraft";
  text: string;
};

/**
 * 异步执行显示正则：走 worker + timeout，超时或报错回退原文。
 * 抽取为独立 hook 避免在 React render 中执行同步正则。
 */
function useDisplayRegexText(
  originalContent: string,
  scripts: RegexScriptLike[],
  placement: number,
): string {
  const [result, setResult] = useState(originalContent);
  // 用 ref 追踪最新的原文，避免 effect cleanup 后写入过时结果
  const latestContentRef = useRef(originalContent);

  useEffect(() => {
    latestContentRef.current = originalContent;

    // 先立即显示原文（编辑等场景下即时响应）
    setResult(originalContent);

    if (!originalContent || scripts.length === 0) {
      return;
    }

    let cancelled = false;
    const currentContent = originalContent;

    executeRegexScriptsAsync(currentContent, scripts, {
      placement,
      promptOnly: false,
    })
      .then((regexResult) => {
        if (cancelled) return;
        // 如果原文在此期间已变化，丢弃过期结果
        if (latestContentRef.current !== currentContent) return;
        setResult(regexResult.text);
      })
      .catch(() => {
        if (!cancelled && latestContentRef.current === currentContent) {
          setResult(currentContent);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [originalContent, scripts, placement]);

  return result;
}

export function ChatBubble({
  disabled,
  message,
  onDelete,
  onEdit,
  onReroll,
  onSwipeNext,
  onSwipePrevious,
  onHtmlCardAction,
  displayRegexScripts = [],
}: {
  disabled: boolean;
  displayRegexScripts?: RegexScriptLike[];
  message: ChatMessageLine;
  onDelete: () => void;
  onEdit: () => void;
  onReroll: () => void;
  onSwipeNext: () => void;
  onSwipePrevious: () => void;
  onHtmlCardAction?: (action: ChatHtmlCardAction) => void;
}) {
  const isUser = message.is_user === true;
  const canReroll = message.is_user !== true && message.is_system !== true;
  const originalContent = getChatMessageDisplayText(message);
  const content = useDisplayRegexText(
    originalContent,
    displayRegexScripts,
    isUser ? 1 : 2,
  );
  const shouldRenderHtmlDocument = isRenderableHtmlDocumentMessage(content);
  const contentHtml = shouldRenderHtmlDocument ? "" : renderSafeMarkdownToHtml(content);
  const estimatedTokens = estimateTextTokens(content);
  const swipeCount = getMessageSwipeCount(message);
  const swipeIndex = normalizeMessageSwipeIndex(message);

  const handleContentClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onHtmlCardAction) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const actionElement = target.closest<HTMLElement>("[data-ms-action]");
      if (!actionElement) {
        return;
      }

      const action = actionElement.dataset.msAction;
      if (
        action !== "setDraft" &&
        action !== "appendDraft" &&
        action !== "sendMessage"
      ) {
        return;
      }

      const text =
        actionElement.dataset.msText?.trim() ||
        actionElement.textContent?.trim() ||
        "";

      if (!text) {
        return;
      }

      event.preventDefault();
      onHtmlCardAction({ action, text });
    },
    [onHtmlCardAction],
  );

  return (
    <article className={["group flex", isUser ? "justify-end" : "justify-start"].join(" ")}>
      <div
        className={[
          "max-w-[96%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[94%]",
          isUser
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-primary)]",
        ].join(" ")}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs opacity-80">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-medium">{message.name}</span>
            {message.send_date ? <span>{message.send_date}</span> : null}
            {content ? <span>约 {estimatedTokens} token</span> : null}
          </div>
          <div className="flex shrink-0 gap-1 opacity-80 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <button
              className={[
                "rounded border px-1.5 py-0.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                isUser
                  ? "border-white/40 bg-white/10 text-white hover:bg-white/20"
                  : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
              ].join(" ")}
              disabled={disabled}
              type="button"
              onClick={onEdit}
            >
              编辑
            </button>
            <button
              className={[
                "rounded border px-1.5 py-0.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                isUser
                  ? "border-white/40 bg-white/10 text-white hover:bg-white/20"
                  : "border-red-200 bg-red-50 text-red-700 hover:border-red-300",
              ].join(" ")}
              disabled={disabled}
              type="button"
              onClick={onDelete}
            >
              删除
            </button>
            {canReroll ? (
              <button
                className="rounded border border-[var(--border-soft)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                type="button"
                onClick={onReroll}
              >
                重新生成
              </button>
            ) : null}
          </div>
        </div>
        {content ? (
          shouldRenderHtmlDocument ? (
            <ChatHtmlDocumentFrame
              content={content}
              onAction={onHtmlCardAction}
              title={`${message.name} HTML message`}
            />
          ) : (
            <div
              className={[
                "chat-markdown break-words text-sm leading-7",
                isUser ? "chat-markdown-user" : "",
              ].join(" ")}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
              onClick={onHtmlCardAction ? handleContentClick : undefined}
            />
          )
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-7">
            正在生成...
          </p>
        )}
        {swipeCount > 1 ? (
          <div
            className={[
              "mt-3 flex items-center justify-end gap-2 text-xs",
              isUser ? "text-white/80" : "text-[var(--text-muted)]",
            ].join(" ")}
          >
            <button
              className={[
                "rounded border px-2 py-1 font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                isUser
                  ? "border-white/40 bg-white/10 text-white hover:bg-white/20"
                  : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
              ].join(" ")}
              disabled={disabled}
              type="button"
              onClick={onSwipePrevious}
            >
              上一条
            </button>
            <span>
              {swipeIndex + 1} / {swipeCount}
            </span>
            <button
              className={[
                "rounded border px-2 py-1 font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                isUser
                  ? "border-white/40 bg-white/10 text-white hover:bg-white/20"
                  : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
              ].join(" ")}
              disabled={disabled}
              type="button"
              onClick={onSwipeNext}
            >
              下一条
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ChatHtmlDocumentFrame({
  content,
  onAction,
  title,
}: {
  content: string;
  onAction?: (action: ChatHtmlCardAction) => void;
  title: string;
}) {
  const [height, setHeight] = useState(180);
  const cleanupRef = useRef<(() => void) | null>(null);
  const srcDoc = useMemo(
    () => renderSafeHtmlDocumentToSrcDoc(content),
    [content],
  );

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  const handleLoad = useCallback(
    (event: React.SyntheticEvent<HTMLIFrameElement>) => {
      cleanupRef.current?.();
      cleanupRef.current = null;

      try {
        const doc =
          event.currentTarget.contentDocument ??
          event.currentTarget.contentWindow?.document;
        if (!doc) {
          return;
        }

        const applyHeight = () => {
          const docHeight = Math.max(
            doc.documentElement?.scrollHeight ?? 0,
            doc.body?.scrollHeight ?? 0,
            doc.documentElement?.offsetHeight ?? 0,
            doc.body?.offsetHeight ?? 0,
          );
          if (Number.isFinite(docHeight) && docHeight > 0) {
            setHeight(Math.min(Math.max(Math.ceil(docHeight), 180), 760));
          }
        };

        const handleDocumentClick = (clickEvent: MouseEvent) => {
          if (!onAction) {
            return;
          }

          const target = clickEvent.target as {
            closest?: (selector: string) => Element | null;
          } | null;
          const actionElement = target?.closest?.(
            "[data-ms-action], .scenario-card",
          ) as HTMLElement | null;
          if (!actionElement) {
            return;
          }

          const requestedAction = actionElement.dataset.msAction ?? "setDraft";
          if (
            requestedAction !== "setDraft" &&
            requestedAction !== "appendDraft" &&
            requestedAction !== "sendMessage"
          ) {
            return;
          }

          const heading = actionElement
            .querySelector("h1,h2,h3,h4")
            ?.textContent?.trim();
          const paragraph = actionElement
            .querySelector("p")
            ?.textContent?.trim();
          const inferredText = [heading, paragraph].filter(Boolean).join("\n\n");
          const text =
            actionElement.dataset.msText?.trim() ||
            inferredText ||
            actionElement.textContent?.trim() ||
            "";
          if (!text) {
            return;
          }

          clickEvent.preventDefault();
          onAction({ action: requestedAction, text });
        };

        doc.addEventListener("click", handleDocumentClick);
        const FrameResizeObserver = doc.defaultView?.ResizeObserver;
        const resizeObserver = FrameResizeObserver
          ? new FrameResizeObserver(applyHeight)
          : null;
        resizeObserver?.observe(doc.body ?? doc.documentElement);
        applyHeight();

        cleanupRef.current = () => {
          doc.removeEventListener("click", handleDocumentClick);
          resizeObserver?.disconnect();
        };
      } catch {
        setHeight(180);
      }
    },
    [onAction],
  );

  return (
    <iframe
      className="chat-html-frame"
      referrerPolicy="no-referrer"
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      style={{ height }}
      title={title}
      onLoad={handleLoad}
    />
  );
}
