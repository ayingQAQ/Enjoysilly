import { useRef, useState } from "react";
import { Modal } from "../../components/Modal";
import { unsavedChanges } from "../../services/unsavedChanges";

export interface MessageEditDraft { index: number; original: string; text: string }

export function ChatMessageEditor({ draft, onChange, onSave, onClose }: {
  draft: MessageEditDraft;
  onChange: (draft: MessageEditDraft) => void;
  onSave: () => Promise<boolean>;
  onClose: () => void | Promise<void>;
}) {
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = await onSave();
      if (!saved) setError("保存未完成：请保留或复制当前内容，检查消息是否已变化及本地存储是否可用。");
      return saved;
    }
    catch (e) { setError(`保存未完成：${e instanceof Error ? e.message : String(e)}`); return false; }
    finally { saving.current = false; setBusy(false); }
  };
  const close = async () => {
    if (busy) return;
    const accepted = await unsavedChanges.requestGuard({
      label: "消息编辑", dirty: draft.text !== draft.original, save,
    });
    if (accepted) await onClose();
  };
  return <Modal busy={busy} onRequestClose={close} aria-labelledby="message-edit-title"
    className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/40">
    <h2 id="message-edit-title" className="text-lg font-semibold">编辑消息</h2>
    <p className="my-2 text-xs text-[var(--text-secondary)]">Ctrl / ⌘ + Enter 保存，Escape 关闭。未应用的编辑会保留为本地草稿。</p>
    <label className="block text-sm">消息内容<textarea autoFocus disabled={busy} value={draft.text}
      className="mt-2 h-[min(50dvh,24rem)] w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3"
      onChange={event => onChange({ ...draft, text: event.target.value })}
      onKeyDown={event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void save(); } }}/></label>
    <div className="mt-4 flex justify-end gap-2">
      <button disabled={busy} className="rounded-lg border px-4 py-2" onClick={() => void close()}>取消编辑</button>
      <button disabled={busy} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white" onClick={() => void save()}>{busy ? "保存中…" : "保存消息"}</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
  </Modal>;
}
