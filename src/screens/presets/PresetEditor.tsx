import { useState } from "react";
import type { StoredPreset } from "../../lib/db";
import { savePresetEdit } from "../../services/presetEdit";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";

export function PresetEditor({ original, onClose, onSaved }: {
  original: StoredPreset; onClose: () => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(original));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const save = async () => {
    if (busy) return false;
    setBusy(true); setError("");
    try { await savePresetEdit(original, draft); onSaved(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { setBusy(false); }
  };
  const confirmLeave = useUnsavedChanges({ label: "预设编辑器", dirty, busy, save });
  const close = async () => { if (await confirmLeave()) onClose(); };
  const update = (mutate: (next: StoredPreset) => void) => setDraft(current => {
    const next = structuredClone(current); mutate(next); return next;
  });
  const field = "w-full rounded border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2";
  return <div className="fixed inset-0 z-50 bg-black/30" onClick={close}>
    <section role="dialog" aria-modal="true" aria-label="编辑预设" className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-[var(--surface)] shadow-xl" onClick={e => e.stopPropagation()}>
      <header className="flex shrink-0 items-center justify-between border-b p-4"><h2>编辑预设</h2><button disabled={busy} onClick={close}>关闭</button></header>
      <fieldset disabled={busy} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <label className="block">名称<input autoFocus className={field} value={draft.name} onChange={e => update(d => { d.name = e.target.value; })}/></label>
        <div className="grid gap-3 sm:grid-cols-3">{([['temperature','温度'],['top_p','核采样'],['openai_max_tokens','最大输出长度']] as const).map(([key,label]) =>
          <label key={key}>{label}<input className={field} type="number" min="0" step="any" value={draft.payload[key] ?? ''} onChange={e => update(d => { if (e.target.value === '') delete d.payload[key]; else d.payload[key] = Number(e.target.value); })}/></label>
        )}</div>
        <h3 className="font-semibold">提示词</h3>
        {draft.payload.prompts.map((prompt,index) => <details key={`${prompt.identifier}-${index}`} className="rounded border p-3">
          <summary>{prompt.name || prompt.identifier}{prompt.marker ? ' · 动态内容' : ''}</summary>
          <label className="block mt-3">名称<input className={field} value={prompt.name ?? ''} onChange={e => update(d => { d.payload.prompts[index].name = e.target.value; })}/></label>
          <label className="block mt-3">角色<select className={field} value={prompt.role ?? ''} onChange={e => update(d => { d.payload.prompts[index].role = e.target.value; })}>{['',...new Set(['system','user','assistant',prompt.role].filter(Boolean))].map(role => <option key={role} value={role}>{role || '未设置'}</option>)}</select></label>
          {!prompt.marker && <label className="block mt-3">内容<textarea rows={6} className={field} value={prompt.content ?? ''} onChange={e => update(d => { d.payload.prompts[index].content = e.target.value; })}/></label>}
        </details>)}
        <h3 className="font-semibold">发送顺序与启用状态</h3>
        {draft.payload.prompt_order.map((slot,si) => <div key={si} className="space-y-2"><h4>排序槽 {slot.character_id}</h4>{slot.order.map((item,i) => <div key={`${item.identifier}-${i}`} className="flex items-center gap-2 rounded border p-2">
          <input aria-label={`启用 ${item.identifier}`} type="checkbox" checked={item.enabled !== false} onChange={e => update(d => { d.payload.prompt_order[si].order[i].enabled = e.target.checked; })}/>
          <span className="min-w-0 flex-1 break-words">{draft.payload.prompts.find(p => p.identifier === item.identifier)?.name || item.identifier}</span>
          {([-1,1] as const).map(delta => <button key={delta} disabled={i+delta < 0 || i+delta >= slot.order.length} onClick={() => update(d => { const list = d.payload.prompt_order[si].order; [list[i],list[i+delta]] = [list[i+delta],list[i]]; })}>{delta < 0 ? '上移' : '下移'}</button>)}
        </div>)}</div>)}
      </fieldset>
      <footer className="shrink-0 border-t p-4"><p role="alert" className="text-red-600">{error}</p><button disabled={busy || !dirty} className="rounded bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-50" onClick={() => void save()}>{busy ? '保存中…' : '保存预设'}</button></footer>
    </section>
  </div>;
}
