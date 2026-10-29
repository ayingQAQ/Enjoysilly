import { useState } from "react";
import type { ChatCompletionPreset } from "../../types/preset";
import { addPrompt, copyPrompt, deletePrompt, movePromptOrder, setPromptEnabled } from "../../services/presetPrompts";

const field = "w-full rounded border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2";
export function PresetPromptFields({ payload, onChange }: { payload: ChatCompletionPreset; onChange: (next: ChatCompletionPreset) => void }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const update = (mutate: (next: ChatCompletionPreset) => void) => { const next = structuredClone(payload); mutate(next); onChange(next); };
  return <>
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">提示词</h3><button type="button" className="rounded border px-3 py-2" onClick={() => onChange(addPrompt(payload))}>新增提示词</button></div>
    {payload.prompts.length === 0 && <p>暂无提示词，点击“新增提示词”开始。</p>}
    {payload.prompts.map((prompt, index) => <details key={prompt.identifier} className="rounded border p-3">
      <summary className="break-words">{prompt.name || prompt.identifier}{prompt.marker ? " · 动态内容" : ""}</summary>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label><input type="checkbox" checked={prompt.enabled !== false} onChange={e => onChange(setPromptEnabled(payload, prompt.identifier, e.target.checked))}/> 启用此提示词（所有排序槽）</label>
        <button type="button" disabled={prompt.marker === true} title={prompt.marker ? "动态内容依赖固定标识，不能复制" : undefined} onClick={() => onChange(copyPrompt(payload, prompt.identifier))}>复制提示词</button>
        <button type="button" onClick={() => setDeleting(prompt.identifier)}>删除提示词</button>
      </div>
      {deleting === prompt.identifier && <div className="my-3 rounded border border-red-300 p-3" role="group" aria-label="确认删除提示词">
        <p>删除后会移除所有排序槽中的引用。{prompt.marker ? "此项为动态内容，删除会影响对应内容的注入。" : ""}保存前可关闭编辑器并放弃修改。</p>
        <button type="button" className="mr-4" onClick={() => setDeleting(null)}>取消删除</button>
        <button type="button" onClick={() => { onChange(deletePrompt(payload, prompt.identifier)); setDeleting(null); }}>确认删除</button>
      </div>}
      <label className="mt-3 block">名称<input className={field} value={prompt.name ?? ""} onChange={e => update(d => { d.prompts[index].name = e.target.value; })}/></label>
      <label className="mt-3 block">角色<select className={field} value={prompt.role ?? ""} onChange={e => update(d => { d.prompts[index].role = e.target.value; })}>{["", ...new Set(["system", "user", "assistant", prompt.role].filter(Boolean))].map(role => <option key={role} value={role}>{role || "未设置"}</option>)}</select></label>
      {!prompt.marker && <label className="mt-3 block">内容<textarea rows={6} className={field} value={prompt.content ?? ""} onChange={e => update(d => { d.prompts[index].content = e.target.value; })}/></label>}
    </details>)}
    <h3 className="font-semibold">发送顺序与启用状态</h3>
    <p className="text-xs text-[var(--text-secondary)]">排序槽单独控制发送顺序。全局禁用的提示词不会发送，即使槽内勾选启用。</p>
    {payload.prompt_order.map((slot, si) => <section key={si} aria-label={`排序槽 ${slot.character_id}`} className="space-y-2"><h4>排序槽 {slot.character_id}</h4>{slot.order.map((item, i) => <div key={`${item.identifier}-${i}`} className="flex items-center gap-2 rounded border p-2">
      <input aria-label={`启用 ${item.identifier}`} type="checkbox" checked={item.enabled !== false} onChange={e => update(d => { d.prompt_order[si].order[i].enabled = e.target.checked; })}/>
      <span className="min-w-0 flex-1 break-words">{payload.prompts.find(p => p.identifier === item.identifier)?.name || item.identifier}</span>
      {([-1, 1] as const).map(delta => <button type="button" key={delta} disabled={i + delta < 0 || i + delta >= slot.order.length} onClick={() => onChange(movePromptOrder(payload, si, i, delta))}>{delta < 0 ? "上移" : "下移"}</button>)}
    </div>)}</section>)}
  </>;
}
