import type { ReactNode } from "react";
import { Regex, X } from "lucide-react";

import type { PresetAssetSummary } from "../../services/assetCatalog";
import type {
  PresetDetailSummary,
  PresetPromptPreview,
  PresetRegexScriptPreview,
} from "../../services/presetDetails";

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

export function PresetDetailDrawer({
  detail,
  onClose,
}: {
  detail: PresetDetailSummary;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="预设详情"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            只读预览
          </p>
          <h2 className="mt-2 truncate text-xl font-semibold">{detail.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            这里仅展示 ST 原生预设结构摘要；`extensions` 和第三方字段会保留，但不会执行。
          </p>
        </div>
        <button
          aria-label="关闭预设详情"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-primary)] transition hover:border-[var(--border-strong)]"
          type="button"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <MiniMetric label="Prompt" value={detail.promptCount} />
          <MiniMetric label="启用" value={detail.enabledPromptCount} />
          <MiniMetric label="排序项" value={detail.orderedPromptCount} />
          <MiniMetric label="正则" value={detail.regexScriptCount} />
        </div>

        <section className="mt-5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <h3 className="text-sm font-semibold">结构信号</h3>
          <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
            <DetailLine label="marker prompt" value={detail.markerPromptCount} />
            <DetailLine label="system prompt" value={detail.systemPromptCount} />
            <DetailLine
              label="prompt_order 槽"
              value={detail.orderSlotCount}
            />
            <DetailLine
              label="启用排序项"
              value={`${detail.enabledOrderedPromptCount}/${detail.orderedPromptCount}`}
            />
            <DetailLine
              label="第三方扩展"
              value={formatExtensionFlags(detail)}
            />
            <DetailLine label="采样参数" value={formatDetailSampling(detail)} />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">Prompt 预览</h3>
          <div className="mt-3 space-y-3">
            {detail.promptPreviews.length > 0 ? (
              detail.promptPreviews.map((prompt) => (
                <PromptPreviewCard key={prompt.identifier} prompt={prompt} />
              ))
            ) : (
              <EmptyDetailText text="这个预设没有 prompts。" />
            )}
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">prompt_order</h3>
          <div className="mt-3 space-y-3">
            {detail.orderSlotPreviews.length > 0 ? (
              detail.orderSlotPreviews.map((slot) => (
                <div
                  key={slot.characterId}
                  className="rounded-lg border border-[var(--border-soft)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-[var(--text-primary)]">
                      character_id: {slot.characterId}
                    </p>
                    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                      启用 {slot.enabledOrderCount}/{slot.orderCount}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-xs leading-6 text-[var(--text-secondary)]">
                    {slot.sampleIdentifiers.length > 0
                      ? slot.sampleIdentifiers.join(" · ")
                      : "没有排序项"}
                  </p>
                </div>
              ))
            ) : (
              <EmptyDetailText text="这个预设没有 prompt_order。" />
            )}
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">extensions.regex_scripts</h3>
          <div className="mt-3 space-y-3">
            {detail.regexScriptPreviews.length > 0 ? (
              detail.regexScriptPreviews.map((script, index) => (
                <RegexPreviewCard
                  key={`${script.scriptName}-${index}`}
                  script={script}
                />
              ))
            ) : (
              <EmptyDetailText text="这个预设没有内嵌正则脚本。" />
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function PromptPreviewCard({ prompt }: { prompt: PresetPromptPreview }) {
  return (
    <article className="rounded-lg border border-[var(--border-soft)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold">{prompt.displayName}</h4>
          <p className="mt-1 break-all font-mono text-xs text-[var(--text-muted)]">
            {prompt.identifier}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge text={prompt.enabled ? "启用" : "停用"} />
          {prompt.marker ? <Badge text="marker" /> : null}
          {prompt.systemPrompt ? <Badge text="system_prompt" /> : null}
          {prompt.role ? <Badge text={prompt.role} /> : null}
        </div>
      </div>
      <p className="mt-3 text-xs leading-6 text-[var(--text-secondary)]">
        {prompt.contentPreview || "无 content；可能是动态 marker。"}
      </p>
      <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-3">
        <span>depth: {formatOptionalNumber(prompt.injectionDepth)}</span>
        <span>order: {formatOptionalNumber(prompt.injectionOrder)}</span>
        <span>trigger: {prompt.triggerCount}</span>
      </div>
    </article>
  );
}

function RegexPreviewCard({ script }: { script: PresetRegexScriptPreview }) {
  return (
    <article className="rounded-lg border border-[var(--border-soft)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-sm font-semibold">{script.scriptName}</h4>
        <div className="flex flex-wrap gap-1.5">
          <Badge text={script.disabled ? "ST disabled:true" : "ST disabled:false"} />
          {script.promptOnly ? <Badge text="promptOnly" /> : null}
          {script.markdownOnly ? <Badge text="markdownOnly" /> : null}
        </div>
      </div>
      <p className="mt-3 break-all font-mono text-xs leading-6 text-[var(--text-secondary)]">
        findRegex: {script.findRegexPreview || "空"}
      </p>
      <p className="mt-2 break-all text-xs leading-6 text-[var(--text-muted)]">
        replace: {script.replacePreview || "空"}
      </p>
      <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-3">
        <span>placement: {script.placementCount}</span>
        <span>minDepth: {formatNullableNumber(script.minDepth)}</span>
        <span>maxDepth: {formatNullableNumber(script.maxDepth)}</span>
      </div>
    </article>
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
      <span className="text-right font-medium text-[var(--text-primary)]">
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

function EmptyDetailText({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-4 text-sm text-[var(--text-muted)]">
      {text}
    </p>
  );
}

function formatExtensionFlags(detail: PresetDetailSummary): string {
  const flags = [
    detail.extensionFlags.hasRegexScripts ? "regex" : "",
    detail.extensionFlags.hasSPreset ? "SPreset" : "",
    detail.extensionFlags.hasTavernHelper ? "tavern_helper" : "",
    detail.extensionFlags.hasNestedExtensions ? "extensions" : "",
  ].filter(Boolean);

  return flags.length > 0 ? flags.join(" / ") : "无";
}

function formatDetailSampling(detail: PresetDetailSummary): string {
  const parts = [
    typeof detail.sampling.temperature === "number"
      ? `T ${detail.sampling.temperature}`
      : "",
    typeof detail.sampling.topP === "number" ? `P ${detail.sampling.topP}` : "",
    typeof detail.sampling.topK === "number" ? `K ${detail.sampling.topK}` : "",
    typeof detail.sampling.minP === "number" ? `min ${detail.sampling.minP}` : "",
    typeof detail.sampling.maxTokens === "number"
      ? `${detail.sampling.maxTokens} tokens`
      : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "仅原样保留";
}

function formatOptionalNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "未设";
}

function formatNullableNumber(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "未设";
}

export function formatSamplingSummary(preset: PresetAssetSummary): string {
  const parts = [
    typeof preset.temperature === "number" ? `T ${preset.temperature}` : "",
    typeof preset.topP === "number" ? `P ${preset.topP}` : "",
    typeof preset.maxTokens === "number" ? `${preset.maxTokens} tokens` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "采样参数保留";
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
