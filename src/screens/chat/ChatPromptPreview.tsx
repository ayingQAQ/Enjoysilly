import { Modal } from "../../components/Modal";
import type { PreparedStreamingChatTurn } from "../../lib/chatStreaming";
import { estimateTextTokens } from "../../lib/tokenEstimate";
import { worldInfoOutcomeLabels } from "../../lib/worldInfoDiagnostics";

export function ChatPromptPreview({ data, error, onClose, onSend }: {
  data?: PreparedStreamingChatTurn; error?: string; onClose: () => void; onSend: () => void;
}) {
  const prepared = data?.prepared;
  const tokens = prepared?.messages.reduce((sum, message) => sum + estimateTextTokens(message.content) + 4, 0) ?? 0;
  return <Modal drawer aria-label="发送前提示词预览" onRequestClose={onClose} className="flex w-full flex-col border-l border-[var(--border-soft)] bg-[var(--surface)]">
    <header className="shrink-0 border-b border-[var(--border-soft)] p-4">
      <h2 className="text-lg font-semibold">发送前提示词预览</h2>
      <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">仅预览下一条普通消息；不会请求模型或保存对话。确认后发送此快照，随机与时间宏不会重算。不展示连接密钥。</p>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {error ? <p role="alert">{error}</p> : !prepared ? <p role="status">正在组装提示词…</p> : <>
        <p className="mb-4 text-sm">{prepared.messages.length} 条请求消息 · 约 {tokens} token（启发式估算，非精确 tokenizer，不包含输出）</p>
        {prepared.budget && <p role="status" className="mb-4 rounded-lg bg-[var(--surface-muted)] p-3 text-sm">上下文上限 {prepared.budget.contextLimit} · 输出预留 {prepared.budget.outputReserve} · 输入约 {prepared.budget.estimatedInputTokens} / {prepared.budget.inputLimit}。本次省略最旧 {prepared.budget.omittedMessages} 条历史；原存档不变。</p>}
        <h3 className="mb-2 font-semibold">实际消息顺序</h3>
        <p className="mb-3 text-xs text-[var(--text-secondary)]">以下为宏展开和提示词正则处理后的正文。聊天历史按当前实现合并为 marker 文本；请勿向模型发送敏感信息。</p>
        <ol className="space-y-3">{prepared.messages.map((message, index) => <li key={index} className="rounded-lg border border-[var(--border-soft)] p-3">
          <h4 className="mb-2 break-words text-sm font-medium">{index + 1}. {message.role} · {prepared.messageSources?.[index]?.name ?? "请求消息"}</h4>
          <pre data-prompt-role={message.role} className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{message.content}</pre>
        </li>)}</ol>
        <h3 className="mb-2 mt-6 font-semibold">世界书触发说明</h3>
        <p className="mb-3 text-xs leading-6 text-[var(--text-secondary)]">“扫描选中”不等于一定发送：角色前/后条目还需要预设启用对应 worldInfoBefore/worldInfoAfter，深度条目需要 chatHistory。最终内容以上方请求为准。高级开关沿用当前设置，未启用的不会执行。</p>
        {!prepared.worldInfoScanResult?.diagnostics?.length ? <p className="text-sm">当前没有参与扫描的世界书条目。</p> : <ul className="space-y-2">{prepared.worldInfoScanResult.diagnostics.map(d => <li key={d.sourceIndex} className="rounded-lg border border-[var(--border-soft)] p-3 text-xs leading-6">
          <strong>#{d.sourceIndex + 1} {d.comment || `条目 ${d.id ?? d.sourceIndex + 1}`} · {worldInfoOutcomeLabels[d.outcome]}</strong>
          <p>插入组：{d.bucket === "before" ? "角色前" : d.bucket === "after" ? "角色后" : "历史深度"}</p>
          {d.attempts.some(a => a.reasons.includes("sticky")) && <p>sticky 保持激活：本轮无需再次命中关键词。</p>}
          {d.attempts.map((a, i) => <p key={i}>第 {a.round} 轮（0 为初始扫描）：{worldInfoOutcomeLabels[a.outcome]}；{a.reasons.includes("constant") ? "常驻；" : ""}关键词 {a.matchedKeys.join("、") || "无"}；次要关键词 {a.matchedSecondary.join("、") || "无"}{a.probabilityRoll !== undefined ? `；概率抽样 ${a.probabilityRoll.toFixed(2)}` : ""}</p>)}
          {d.notes.length > 0 && <details><summary className="cursor-pointer">执行限制（{d.notes.length}）</summary>{d.notes.map(note => <p key={note}>{note}</p>)}</details>}
        </li>)}</ul>}
      </>}
    </div>
    <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--border-soft)] p-4">
      <button type="button" className="min-h-11 rounded-lg border border-[var(--border-soft)] px-4" onClick={onClose}>关闭预览</button>
      <button type="button" className="min-h-11 rounded-lg bg-[var(--accent)] px-4 text-white disabled:opacity-50" disabled={!data || Boolean(error)} onClick={onSend}>发送此预览</button>
    </footer>
  </Modal>;
}
