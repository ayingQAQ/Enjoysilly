import { useRef, useState } from "react";
import type { StoredPreset } from "../../lib/db";
import { savePresetEdit } from "../../services/presetEdit";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { Modal, assetFocusTarget } from "../../components/Modal";
import { PresetPromptFields } from "./PresetPromptFields";

export function PresetEditor({ original, onClose, onSaved }: {
  original: StoredPreset; onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(original));
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const save = async () => {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true); setError("");
    try { await savePresetEdit(original, draft); await onSaved(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { saving.current = false; setBusy(false); }
  };
  const confirmLeave = useUnsavedChanges({ label: "预设编辑器", dirty, busy, save });
  const close = async () => { if (await confirmLeave()) onClose(); };
  const update = (mutate: (next: StoredPreset) => void) => setDraft(current => {
    const next = structuredClone(current); mutate(next); return next;
  });
  const field = "w-full rounded border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2";
  return <Modal drawer busy={busy} onRequestClose={close} returnFocus={() => assetFocusTarget(original.id, "编辑")} aria-label="编辑预设" className="flex w-full max-w-3xl flex-col bg-[var(--surface)] shadow-xl">
      <header className="flex shrink-0 items-center justify-between border-b p-4"><h2>编辑预设</h2><button disabled={busy} onClick={close}>关闭</button></header>
      <fieldset disabled={busy} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <label className="block">名称<input autoFocus className={field} value={draft.name} onChange={e => update(d => { d.name = e.target.value; })}/></label>
        <div className="grid gap-3 sm:grid-cols-3">{([['temperature','温度'],['top_p','核采样'],['openai_max_tokens','最大输出长度']] as const).map(([key,label]) =>
          <label key={key}>{label}<input className={field} type="number" min="0" step="any" value={draft.payload[key] ?? ''} onChange={e => update(d => { if (e.target.value === '') delete d.payload[key]; else d.payload[key] = Number(e.target.value); })}/></label>
        )}</div>
        <PresetPromptFields payload={draft.payload} onChange={payload => update(d => { d.payload = payload; })}/>
      </fieldset>
      <footer className="shrink-0 border-t p-4"><p role="alert" className="text-red-600">{error}</p><button disabled={busy || !dirty} className="rounded bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-50" onClick={() => void save()}>{busy ? '保存中…' : '保存预设'}</button></footer>
  </Modal>;
}
