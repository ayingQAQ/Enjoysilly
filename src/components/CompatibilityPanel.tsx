import { useMemo } from "react";
import { analyzeAssetCompatibility, compatibilityLabels, type CompatibilityKind } from "../lib/assetCompatibility";

export function CompatibilityPanel({ kind, payload }: { kind: CompatibilityKind; payload: unknown }) {
  const findings = useMemo(() => analyzeAssetCompatibility(kind, payload), [kind, payload]);
  return <section aria-label="兼容性报告" className="mb-5 rounded-lg border border-[var(--border-soft)] p-4">
    <h3 className="font-semibold">兼容性分级</h3>
    <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">按能力分级，不代表整张资产完整支持。以下为当前聊天默认行为；未知数据保留不等于执行。</p>
    <ul className="mt-3 space-y-3">{findings.map(f => <li key={f.code} className="text-sm">
      <span className="mr-2 rounded bg-[var(--surface-muted)] px-2 py-1 text-xs">{compatibilityLabels[f.level]}</span><strong>{f.title}</strong>
      <p className="mt-1 break-words text-xs leading-6 text-[var(--text-secondary)]">{f.detail}</p>
      <p className="break-all text-xs text-[var(--text-muted)]">依据：{f.paths.join("、")}</p>
    </li>)}</ul>
  </section>;
}
