import { useCallback, useEffect, useRef, useState } from "react";
import { deleteChatDraft, getChatDraftTabId, setChatDraftTabId, loadChatDraft, saveChatDraft, type ChatWorkspaceDraft } from "../../services/chatDrafts";
import { acquireChatDraftLease } from "../../services/chatDraftLease";

export function useChatDraftRecovery(draft: ChatWorkspaceDraft, restore: (draft: ChatWorkspaceDraft) => void, enabled = true) {
  const latest = useRef({ draft, restore });
  latest.current = { draft, restore };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const tab = useRef<string>();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const discarded = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let release: (() => void) | undefined;
    void (async () => {
      try {
        const lease = await acquireChatDraftLease(getChatDraftTabId(), navigator.locks);
        release = lease.release;
        if (!active) { release(); return; }
        tab.current = lease.id;
        const saved = await loadChatDraft(lease.sourceId);
        if (!active) return;
        if (saved && lease.id !== lease.sourceId) await saveChatDraft(lease.id, saved);
        if (!active) return;
        setChatDraftTabId(lease.id);
        if (saved) latest.current.restore(saved);
        setError(null);
        setReady(true);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { active = false; release?.(); };
  }, [attempt, enabled]);

  const persist = useCallback(async (override?: ChatWorkspaceDraft): Promise<boolean> => {
    if (!tab.current || !ready || discarded.current) return false;
    const captured = structuredClone(override ?? latest.current.draft);
    const id = tab.current;
    const operation = queue.current.catch(() => undefined).then(() => saveChatDraft(id, captured));
    queue.current = operation;
    try { await operation; setError(null); return true; }
    catch (e) { setError(`草稿保存失败：${e instanceof Error ? e.message : String(e)}`); return false; }
  }, [ready]);

  const discard = useCallback(async () => {
    if (!tab.current) return;
    discarded.current = true;
    try {
      await queue.current.catch(() => undefined);
      await deleteChatDraft(tab.current);
    } catch (e) {
      discarded.current = false;
      throw e;
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => void persist(), 300);
    return () => window.clearTimeout(timer);
  }, [draft, ready, persist]);

  return { ready, error, persist, discard, retry: () => ready ? void persist() : setAttempt(n => n + 1) };
}
