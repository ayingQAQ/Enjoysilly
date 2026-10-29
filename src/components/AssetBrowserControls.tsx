import { useRef, useState } from "react";
import type { AssetQuery } from "../services/assetOrganization";
import { Modal } from "./Modal";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";

const field = "min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-2";
export function AssetBrowserControls({ label, query, onChange, tags, count, total, error, onRetry }: {
  label: string; query: AssetQuery; onChange: (q: AssetQuery) => void; tags: string[];
  count: number; total: number; error: string; onRetry: () => void;
}) {
  return <section aria-label={`${label}筛选`} className="space-y-3">
    <div className="flex flex-wrap gap-3">
      <input className={`${field} flex-1`} type="search" aria-label={`搜索${label}`} placeholder={`搜索${label}名称`} value={query.query} onChange={e => onChange({ ...query, query: e.target.value })}/>
      <select className={field} aria-label={`${label}标签筛选`} value={query.tag} onChange={e => onChange({ ...query, tag: e.target.value })}>
        <option value="">全部标签</option>{[...new Set([...tags, ...(query.tag ? [query.tag] : [])])].map(t => <option key={t}>{t}</option>)}
      </select>
      <select className={field} aria-label={`${label}排序`} value={query.sort} onChange={e => onChange({ ...query, sort: e.target.value as AssetQuery["sort"] })}>
        <option value="updated">最近修改</option><option value="created">最近导入</option><option value="name">名称</option>
      </select>
      <button className={field} onClick={() => onChange({ query: "", tag: "", sort: "updated" })}>重置筛选</button>
    </div>
    <p role="status" className="text-sm text-[var(--text-secondary)]">显示 {count} / {total} 个{label}{total > 0 && count === 0 ? "，没有匹配结果，请调整或重置筛选。" : ""}</p>
    {error && <p role="alert">{error}<button onClick={onRetry}>重试</button></p>}
  </section>;
}

export function AssetTagButton({ name, tags, onSave }: { name: string; tags: string[]; onSave: (tags: string[]) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
    {tags.map(t => <span key={t} className="rounded bg-[var(--accent-weak)] px-2 py-1">{t}</span>)}
    <button className={field} onClick={() => setOpen(true)}>管理标签</button>
    {open && <TagEditor name={name} tags={tags} onSave={onSave} onClose={() => setOpen(false)}/>}
  </div>;
}
function TagEditor({ name, tags, onSave, onClose }: { name: string; tags: string[]; onSave: (tags: string[]) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState(tags.join("\n"));
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (saving.current) return false;
    saving.current = true; setBusy(true);
    try { await onSave(text.split("\n")); onClose(); return true; }
    catch (e) { setError(`标签保存失败：${e instanceof Error ? e.message : String(e)}`); return false; }
    finally { saving.current = false; setBusy(false); }
  };
  const confirmLeave = useUnsavedChanges({ label: "本地标签", dirty: text !== tags.join("\n"), busy, save });
  const close = async () => { if (await confirmLeave()) onClose(); };
  return <Modal aria-label="管理本地标签" busy={busy} onRequestClose={close} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-[var(--surface)] p-5">
    <h2 className="text-lg font-semibold">{name} · 本地标签</h2>
    <p className="my-3 text-sm">每行一个标签。仅在本地整理和完整备份中保存，不写入 ST 导出文件。</p>
    <label>标签<textarea autoFocus className={`${field} mt-2 block w-full`} rows={5} disabled={busy} value={text} onChange={e => setText(e.target.value)}/></label>
    {error && <p role="alert">{error}</p>}
    <div className="mt-4 flex justify-end gap-3"><button disabled={busy} onClick={() => void close()}>取消</button><button disabled={busy} onClick={() => void save()}>保存标签</button></div>
  </Modal>;
}
