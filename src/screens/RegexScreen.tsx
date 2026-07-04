import { useCallback, useEffect, useState } from "react";
import {
  Braces,
  Eye,
  FileJson2,
  ListChecks,
  Regex,
  ScrollText,
  ShieldAlert,
  X,
} from "lucide-react";

import {
  loadRegexCatalogSummary,
  type RegexCatalogItem,
  type RegexCatalogSummary,
} from "../services/regexCatalog";

export function RegexScreen() {
  const [catalog, setCatalog] = useState<RegexCatalogSummary | null>(null);
  const [selectedItem, setSelectedItem] = useState<RegexCatalogItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCatalog = useCallback(
    async (shouldApply: () => boolean = () => true) => {
      setIsLoading(true);
      setError(null);

      try {
        const summary = await loadRegexCatalogSummary();

        if (shouldApply()) {
          setCatalog(summary);
        }
      } catch (loadError: unknown) {
        if (shouldApply()) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setCatalog(null);
        }
      } finally {
        if (shouldApply()) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let isActive = true;

    void refreshCatalog(() => isActive);

    return () => {
      isActive = false;
    };
  }, [refreshCatalog]);

  const items = catalog?.items ?? [];

  return (
    <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">
              正则脚本
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
              从已导入预设的 extensions.regex_scripts 聚合正则脚本目录。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              当前页面只做只读管理和结构查看：不执行正则、不编辑脚本、不导入独立正则集合，
              也不会运行 TavernHelper / JS-Slash-Runner。原始 preset payload 和 extensions
              仍由预设兼容层原样保留。
            </p>
            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                读取正则脚本目录失败：{error}
              </p>
            ) : null}
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            type="button"
            onClick={() => void refreshCatalog()}
          >
            <ListChecks size={16} />
            {isLoading ? "读取中..." : "刷新目录"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <SummaryTile label="来源预设" value={catalog?.presetWithRegexCount ?? 0} />
        <SummaryTile label="正则脚本" value={catalog?.scriptCount ?? 0} />
        <SummaryTile label="ST 启用" value={catalog?.enabledScriptCount ?? 0} />
        <SummaryTile label="ST disabled" value={catalog?.disabledScriptCount ?? 0} />
        <SummaryTile label="runOnEdit" value={catalog?.runOnEditCount ?? 0} />
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] shadow-sm">
          正在从本地预设读取 extensions.regex_scripts...
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 shadow-sm">
          <div className="mb-4 grid size-12 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
            <Braces size={22} />
          </div>
          <h2 className="text-lg font-semibold">还没有可展示的正则脚本</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            请先在“预设”页面导入 ST 原生 Chat Completion 预设。只有预设里的
            <code> extensions.regex_scripts </code>
            会出现在这里；独立正则集合文件不会作为预设导入。
          </p>
        </div>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                  <Regex size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">
                    {item.scriptName}
                  </h2>
                  <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                    来源预设：{item.sourcePresetName}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniMetric
                  label="ST 状态"
                  value={item.disabled ? "disabled" : "enabled"}
                />
                <MiniMetric label="placement" value={item.placement.length} />
                <MiniMetric label="未知字段" value={item.unknownFieldNames.length} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                <FactPill
                  icon={<ShieldAlert size={14} />}
                  label={item.runOnEdit ? "runOnEdit 仅展示" : "不执行"}
                />
                <FactPill
                  icon={<ScrollText size={14} />}
                  label={item.promptOnly ? "promptOnly" : "非 promptOnly"}
                />
                <FactPill
                  icon={<FileJson2 size={14} />}
                  label={item.markdownOnly ? "markdownOnly" : "非 markdownOnly"}
                />
                <FactPill
                  icon={<Braces size={14} />}
                  label={formatDepthRange(item)}
                />
              </div>

              <div className="mt-4 space-y-2">
                <PreviewLine label="findRegex" value={item.findRegexPreview} />
                <PreviewLine
                  label="replace"
                  value={item.replaceStringPreview || "空"}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {item.placementLabels.length > 0 ? (
                  item.placementLabels.map((label) => (
                    <Badge key={label} text={label} />
                  ))
                ) : (
                  <Badge text="placement 未设" />
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3">
                <span className="text-xs text-[var(--text-muted)]">
                  #{item.scriptIndex + 1} · {formatDate(item.sourcePresetUpdatedAt)}
                </span>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)]"
                  type="button"
                  onClick={() => setSelectedItem(item)}
                >
                  <Eye size={14} />
                  查看详情
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {selectedItem ? (
        <RegexDetailDrawer
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </section>
  );
}

function RegexDetailDrawer({
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

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-muted)] px-2 py-2">
      <p className="truncate text-base font-semibold">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function FactPill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2">
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
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

function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
      {text}
    </span>
  );
}

function formatDepthRange(item: RegexCatalogItem): string {
  return `depth ${formatNullableNumber(item.minDepth)} - ${formatNullableNumber(item.maxDepth)}`;
}

function formatOptionalNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "未设";
}

function formatNullableNumber(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "未设";
}

function formatDate(value: string): string {
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
