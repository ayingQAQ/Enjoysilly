import { useMemo, useState } from "react";
import type { ChatMessageLine } from "../../types/chat";
import { searchChatMessages } from "../../lib/chatSearch";

export function ChatSearch({ messages, disabled, onBranch, onLocate }: {
  messages: ChatMessageLine[]; disabled: boolean;
  onBranch: (index: number) => void; onLocate: (index: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState(0);
  const hits = useMemo(() => searchChatMessages(messages, query), [messages, query]);
  const current = Math.min(position, Math.max(0, hits.length - 1));
  const index = hits[current];
  const button = "min-h-11 rounded-lg border border-[var(--border-soft)] px-3 text-xs disabled:opacity-40";
  return <div role="search" aria-label="对话搜索与分支" className="shrink-0 border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
    <input aria-label="搜索当前对话" placeholder="搜索当前 swipe 原文，留空浏览所有消息" value={query} onChange={e => { setQuery(e.target.value); setPosition(0); }} className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-sm" />
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p role="status" className="w-full text-xs text-[var(--text-secondary)]">{index === undefined ? "没有匹配消息" : `第 ${index + 1} 条消息 · ${current + 1} / ${hits.length}`}</p>
      <button className={button} disabled={current === 0} onClick={() => setPosition(current - 1)} aria-label="上一个匹配">上一条</button>
      <button className={button} disabled={current >= hits.length - 1} onClick={() => setPosition(current + 1)} aria-label="下一个匹配">下一条</button>
      <button className={button} disabled={index === undefined} onClick={() => onLocate(index)}>定位消息</button>
      <button className={button} disabled={disabled || index === undefined} onClick={() => onBranch(index)}>从此创建分支</button>
    </div>
  </div>;
}
