export function AssetMetric({ label, value }: { label: string; value: number }) {
  return <div className="flex min-w-0 items-baseline gap-2 rounded-md bg-[var(--surface-muted)] px-3 py-2">
    <span className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">{value}</span>
    <span className="text-xs text-[var(--text-secondary)]">{label}</span>
  </div>;
}
