import { X } from "lucide-react";

import type { WorldInfoAssetSummary } from "../../services/assetCatalog";
import type {
  WorldInfoDetailSummary,
  WorldInfoEntryPreview,
} from "../../services/worldInfoDetails";

export const dialectLabels: Record<WorldInfoAssetSummary["dialect"], string> = {
  native: "ST 原生",
  portable: "角色卡内嵌",
};

export function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

export function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[var(--surface-muted)] px-2 py-2">
      <p className="text-base font-semibold">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

export function WorldInfoDetailDrawer({
  detail,
  onClose,
}: {
  detail: WorldInfoDetailSummary;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="世界书详情"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            只读预览
          </p>
          <h2 className="mt-2 truncate text-xl font-semibold">{detail.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            这里直接展示原始世界书 payload 摘要，不做 native / portable 方言互转，不写回
            IndexedDB。
          </p>
        </div>
        <button
          aria-label="关闭世界书详情"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-primary)] transition hover:border-[var(--border-strong)]"
          type="button"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <DetailMetric label="方言" value={dialectLabels[detail.dialect]} />
          <DetailMetric label="条目" value={detail.entryCount} />
          <DetailMetric label="启用" value={detail.enabledEntryCount} />
          <DetailMetric label="停用" value={detail.disabledEntryCount} />
        </div>

        <section className="mt-5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <h3 className="text-sm font-semibold">结构信号</h3>
          <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
            <DetailLine label="常驻条目" value={detail.constantEntryCount} />
            <DetailLine label="selective 条目" value={detail.selectiveEntryCount} />
            <DetailLine
              label="根级保留字段"
              value={formatFieldNames(detail.rootPreservedFieldNames)}
            />
            <DetailLine
              label="条目保留字段"
              value={formatFieldNames(detail.entryPreservedFieldNames)}
            />
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <h3 className="text-sm font-semibold">方言字段映射</h3>
          <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
            <DetailLine label="关键词" value="key ↔ keys" />
            <DetailLine label="次要关键词" value="keysecondary ↔ secondary_keys" />
            <DetailLine label="排序" value="order ↔ insertion_order" />
            <DetailLine label="启用状态" value="disable ↔ enabled（取反）" />
            <DetailLine label="大小写" value="caseSensitive ↔ case_sensitive" />
            <DetailLine label="显示序号" value="displayIndex ↔ display_index" />
          </div>
          <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
            native position 0/1 对应 portable before_char/after_char；2-7 没有 portable 顶层等价字段，详情页只读展示原始 payload 摘要。
          </p>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">条目预览</h3>
          {detail.entryPreviews.length > 20 ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              当前仅显示前 20 条，共 {detail.entryPreviews.length} 条。
            </p>
          ) : null}
          <div className="mt-3 space-y-3">
            {detail.entryPreviews.length > 0 ? (
              detail.entryPreviews.slice(0, 20).map((entry) => (
                <WorldInfoEntryPreviewCard key={`${entry.id}-${entry.index}`} entry={entry} />
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-4 text-sm text-[var(--text-muted)]">
                这个世界书没有可展示条目。
              </p>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function WorldInfoEntryPreviewCard({ entry }: { entry: WorldInfoEntryPreview }) {
  return (
    <article className="rounded-lg border border-[var(--border-soft)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold">{entry.title}</h4>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            source: {entry.sourceKey}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            #{entry.index + 1} · {entry.dialect === "native" ? "ST 原生" : "角色卡内嵌"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge text={entry.enabled ? "启用" : "停用"} />
          {entry.constant ? <Badge text="constant" /> : null}
          {entry.selective ? <Badge text="selective" /> : null}
        </div>
      </div>

      <p className="mt-3 text-xs leading-6 text-[var(--text-secondary)]">
        {entry.contentPreview || "无 content 预览。"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.keys.length > 0 ? (
          entry.keys.map((key, index) => (
            <span
              key={`${key}-${index}`}
              className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
            >
              {key}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
            无主关键词
          </span>
        )}
      </div>

      {entry.secondaryKeys.length > 0 ? (
        <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
          次要关键词：{entry.secondaryKeys.join(" · ")}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-3">
        <span>order: {formatOptionalNumber(entry.order)}</span>
        <span>position: {entry.positionLabel}</span>
        <span>depth: {formatOptionalNumber(entry.depth)}</span>
        <span>probability: {formatOptionalNumber(entry.probability)}</span>
        <span>displayIndex/display_index: {formatOptionalNumber(entry.displayIndex)}</span>
        <span>case: {formatNullableBoolean(entry.caseSensitive)}</span>
      </div>

      <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
        extensions 字段：{formatFieldNames(entry.extensionFieldNames)}；保留字段：
        {formatFieldNames(entry.preservedFieldNames)}
      </p>
    </article>
  );
}

function DetailMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-muted)] px-2 py-2 text-center">
      <p className="truncate text-base font-semibold">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
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

function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]">
      {text}
    </span>
  );
}

function formatFieldNames(values: string[]): string {
  return values.length > 0 ? values.join(" / ") : "无";
}

function formatOptionalNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "未设";
}

function formatNullableBoolean(value: boolean | null | undefined): string {
  return typeof value === "boolean" ? String(value) : "未设";
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
