import { useSyncExternalStore } from "react";
import { Modal } from "./Modal";
import { unsavedChanges } from "../services/unsavedChanges";

export function UnsavedChangesDialog() {
  const prompt = useSyncExternalStore(unsavedChanges.subscribe, unsavedChanges.getSnapshot);
  if (!prompt) return null;
  const button = "rounded-lg border border-[var(--border-soft)] px-4 py-2 disabled:opacity-50";
  return <Modal busy={prompt.busy} onRequestClose={() => unsavedChanges.choose("cancel")} aria-labelledby="unsaved-title"
    className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/40"
    >
    <h2 id="unsaved-title" className="text-lg font-semibold">离开前保存修改？</h2>
    <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{prompt.labels.join("、")}有未保存内容。保存失败时会留在当前页面。</p>
    {prompt.error && <p role="alert" className="mt-3 text-sm text-red-600">{prompt.error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <button autoFocus className={button} disabled={prompt.busy} onClick={() => void unsavedChanges.choose("cancel")}>取消</button>
      <button className={button} disabled={prompt.busy} onClick={() => void unsavedChanges.choose("discard")}>放弃修改</button>
      <button className={`${button} bg-[var(--accent)] text-white`} disabled={prompt.busy} onClick={() => void unsavedChanges.choose("save")}>{prompt.busy ? "正在处理…" : "保存并离开"}</button>
    </div>
  </Modal>;
}
