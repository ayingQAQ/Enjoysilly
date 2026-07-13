import type { ReactNode } from "react";
import { X } from "lucide-react";

import type { RegexCatalogItem } from "../../services/regexCatalog";

export function RegexDetailDrawer({
  item,
  onClose,
}: {
  item: RegexCatalogItem;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="正则脚本详情"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            只读目录
          </p>
          <h2 className="mt-2 truncate text-xl font-semibold">{item.scriptName}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            来源：{item.sourcePresetName}。这里只展示 metadata，不编译、不运行、不保存修改。
          </p>
        </div>
        <button
          aria-label="关闭正则脚本详情"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-primary)] transition hover:border-[var(--border-strong)]"
          type="button"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <MiniMetric label="ST disabled" value={item.disabled ? "true" : "false"} />
          <MiniMetric label="placement" value={item.placement.length} />
          <MiniMetric label="trimStrings" value={item.trimStringCount} />
          <MiniMetric label="未知字段" value={item.unknownFieldNames.length} />
        </div>

        <section className="mt-5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <h3 className="text-sm font-semibold">脚本标记</h3>
          <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
            <DetailLine label="source preset id" value={item.sourcePresetId} />
            <DetailLine label="script id" value={item.scriptId ?? "未设"} />
            <DetailLine label="promptOnly" value={item.promptOnly ? "true" : "false"} />
            <DetailLine
              label="markdownOnly"
              value={item.markdownOnly ? "true" : "false"}
            />
            <DetailLine label="runOnEdit" value={item.runOnEdit ? "true" : "false"} />
            <DetailLine
              label="substituteRegex"
              value={formatOptionalNumber(item.substituteRegex)}
            />
            <DetailLine label="minDepth" value={formatNullableNumber(item.minDepth)} />
            <DetailLine label="maxDepth" value={formatNullableNumber(item.maxDepth)} />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">findRegex</h3>
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 text-xs leading-6 text-[var(--text-secondary)]">
            {item.findRegex || "空"}
          </pre>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">replaceString</h3>
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 text-xs leading-6 text-[var(--text-secondary)]">
            {item.replaceString || "空"}
          </pre>
        </section>

        <section className="mt-5 rounded-lg border border-[var(--border-soft)] p-4">
          <h3 className="text-sm font-semibold">保留字段信号</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            {item.unknownFieldNames.length > 0
              ? `检测到未识别字段：${item.unknownFieldNames.join("、")}。这些字段仍保存在来源预设 payload 中，本页不做规范化。`
              : "没有检测到 regex_scripts 条目上的未知字段。"}
          </p>
        </section>
      </div>
    </aside>
  );
}

export function SelectFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-[var(--text-primary)]">{label}</span>
      <select
        className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function createPlacementFilterOptions(
  items: RegexCatalogItem[],
): Array<{ label: string; value: string }> {
  const labelsByPlacement = new Map<number, string>();

  for (const item of items) {
    item.placement.forEach((placement, index) => {
      labelsByPlacement.set(
        placement,
        item.placementLabels[index] ?? `${placement} · 未知 placement`,
      );
    });
  }

  return [...labelsByPlacement.entries()]
    .sort(([left], [right]) => left - right)
    .map(([placement, label]) => ({
      label,
      value: String(placement),
    }));
}

export function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

export function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-muted)] px-2 py-2">
      <p className="truncate text-base font-semibold">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

export function FactPill({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2">
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

export function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="break-all rounded-lg bg-[var(--surface-muted)] px-3 py-2 font-mono text-xs leading-6 text-[var(--text-secondary)]">
      <span className="font-sans text-[var(--text-muted)]">{label}: </span>
      {value || "空"}
    </p>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface)] px-3 py-2">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="break-all text-right font-medium text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

export function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
      {text}
    </span>
  );
}

export function formatDepthRange(item: RegexCatalogItem): string {
  return `depth ${formatNullableNumber(item.minDepth)} - ${formatNullableNumber(item.maxDepth)}`;
}

function formatOptionalNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "未设";
}

function formatNullableNumber(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "未设";
}

export function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
