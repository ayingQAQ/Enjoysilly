import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileJson2,
  ListChecks,
  Regex,
  ScrollText,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { downloadBytesToFile } from "../lib/browserDownload";
import { deletePreset } from "../lib/db";
import {
  loadPresetAssetSummaries,
  type PresetAssetSummary,
} from "../services/assetCatalog";
import {
  loadPresetDetailSummary,
  type PresetDetailSummary,
  type PresetPromptPreview,
  type PresetRegexScriptPreview,
} from "../services/presetDetails";
import { createPresetJsonExport } from "../services/presetExport";
import { importPresetFilesToDatabase } from "../services/presetFileImport";

interface PresetNotice {
  kind: "success" | "error";
  message: string;
}

export function PresetsScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [presets, setPresets] = useState<PresetAssetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [busyPresetId, setBusyPresetId] = useState<string | null>(null);
  const [selectedPresetDetail, setSelectedPresetDetail] =
    useState<PresetDetailSummary | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<PresetNotice | null>(null);
  const isPresetActionBusy = busyPresetId !== null;

  const refreshPresets = useCallback(
    async (shouldApply: () => boolean = () => true) => {
      setIsLoading(true);
      setError(null);

      try {
        const summaries = await loadPresetAssetSummaries();

        if (shouldApply()) {
          setPresets(summaries);
        }
      } catch (refreshError: unknown) {
        if (shouldApply()) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : String(refreshError),
          );
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

    void refreshPresets(() => isActive);

    return () => {
      isActive = false;
    };
  }, [refreshPresets]);

  const handlePickFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";

      if (files.length === 0) {
        return;
      }

      setIsImporting(true);
      setNotice(null);

      try {
        const importItems = await Promise.all(
          files.map(async (file) => ({
            fileName: file.name,
            bytes: new Uint8Array(await file.arrayBuffer()),
          })),
        );
        const result = await importPresetFilesToDatabase(importItems);

        await refreshPresets();

        if (result.failed.length > 0) {
          setNotice({
            kind: result.imported.length > 0 ? "success" : "error",
            message: `成功导入 ${result.imported.length} 个预设，失败 ${result.failed.length} 个：${result.failed
              .map((failure) => `${failure.fileName}（${failure.message}）`)
              .join("；")}`,
          });
        } else {
          const regexCount = result.imported.reduce(
            (total, imported) => total + imported.regexScripts.length,
            0,
          );

          setNotice({
            kind: "success",
            message: `已导入 ${result.imported.length} 个 ST 原生预设，读取到 ${regexCount} 条 extensions.regex_scripts。`,
          });
        }
      } catch (importError: unknown) {
        setNotice({
          kind: "error",
          message:
            importError instanceof Error ? importError.message : String(importError),
        });
      } finally {
        setIsImporting(false);
      }
    },
    [refreshPresets],
  );

  const handleOpenPresetDetail = useCallback(async (presetId: string) => {
    setIsDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await loadPresetDetailSummary(presetId);

      setSelectedPresetDetail(detail);
    } catch (detailLoadError: unknown) {
      setSelectedPresetDetail(null);
      setDetailError(
        detailLoadError instanceof Error
          ? detailLoadError.message
          : String(detailLoadError),
      );
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const handleClosePresetDetail = useCallback(() => {
    setSelectedPresetDetail(null);
    setDetailError(null);
  }, []);

  const handleExportPreset = useCallback(async (presetId: string) => {
    setBusyPresetId(presetId);
    setNotice(null);

    try {
      const exported = await createPresetJsonExport(presetId);

      downloadBytesToFile(exported.bytes, exported.fileName, "application/json");
      setNotice({
        kind: "success",
        message: `已导出预设 JSON：${exported.fileName}。`,
      });
    } catch (exportError: unknown) {
      setNotice({
        kind: "error",
        message:
          exportError instanceof Error ? exportError.message : String(exportError),
      });
    } finally {
      setBusyPresetId(null);
    }
  }, []);

  const handleDeletePreset = useCallback(
    async (preset: PresetAssetSummary) => {
      const shouldDelete = window.confirm(
        `确定删除预设“${preset.name}”吗？这只会删除 my_silly 本地预设记录，不会删除角色卡、世界书或对话。`,
      );

      if (!shouldDelete) {
        return;
      }

      setBusyPresetId(preset.id);
      setNotice(null);

      try {
        await deletePreset(preset.id);
        await refreshPresets();
        setNotice({
          kind: "success",
          message: `已删除预设：${preset.name}。`,
        });
      } catch (deleteError: unknown) {
        setNotice({
          kind: "error",
          message:
            deleteError instanceof Error ? deleteError.message : String(deleteError),
        });
      } finally {
        setBusyPresetId(null);
      }
    },
    [refreshPresets],
  );

  const totalPromptCount = presets.reduce(
    (total, preset) => total + preset.promptCount,
    0,
  );
  const totalRegexCount = presets.reduce(
    (total, preset) => total + preset.regexScriptCount,
    0,
  );
  const thirdPartyCount = presets.filter((preset) => preset.hasThirdPartyData)
    .length;

  return (
    <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">
              预设管理
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
              只导入 ST 原生 Chat Completion 预设，正则脚本从 extensions 中读取。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              当前页面支持 <code>prompts[]</code> +{" "}
              <code>prompt_order[]</code> 结构的 JSON 预设。TavernHelper、JS-Slash-Runner
              和独立正则脚本文件不会作为预设执行；相关第三方字段会在原生预设里原样保留。
            </p>
            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                读取预设失败：{error}
              </p>
            ) : null}
            {notice ? (
              <p
                aria-live="polite"
                className={[
                  "mt-3 rounded-lg border px-3 py-2 text-sm",
                  notice.kind === "success"
                    ? "border-[var(--accent-weak)] bg-[var(--surface-muted)] text-[var(--accent-strong)]"
                    : "border-red-200 bg-red-50 text-red-700",
                ].join(" ")}
              >
                {notice.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".json,application/json"
              multiple
              onChange={handleFileChange}
            />
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isImporting || isPresetActionBusy}
              type="button"
              onClick={handlePickFiles}
            >
              <Upload size={16} />
              {isImporting ? "导入中..." : "导入预设"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryTile label="预设" value={presets.length} />
        <SummaryTile label="Prompt" value={totalPromptCount} />
        <SummaryTile label="正则脚本" value={totalRegexCount} />
        <SummaryTile label="第三方扩展" value={thirdPartyCount} />
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] shadow-sm">
          正在读取本地预设...
        </div>
      ) : null}

      {!isLoading && !error && presets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 shadow-sm">
          <div className="mb-4 grid size-12 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
            <ScrollText size={22} />
          </div>
          <h2 className="text-lg font-semibold">还没有预设</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            请选择 SillyTavern 原生 Chat Completion 预设 JSON。导入后这里会展示 prompt
            数量、排序槽、正则脚本数量和采样参数摘要。
          </p>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
            type="button"
            onClick={handlePickFiles}
          >
            <Upload size={16} />
            选择预设 JSON
          </button>
        </div>
      ) : null}

      {!isLoading && presets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {presets.map((preset) => (
            <article
              key={preset.id}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                  <ScrollText size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">{preset.name}</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    ST 原生 Chat Completion
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniMetric label="Prompt" value={preset.promptCount} />
                <MiniMetric label="启用" value={preset.enabledPromptCount} />
                <MiniMetric label="正则" value={preset.regexScriptCount} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                <FactPill
                  icon={<ListChecks size={14} />}
                  label={`排序 ${preset.enabledOrderedPromptCount}/${preset.orderedPromptCount}`}
                />
                <FactPill
                  icon={<SlidersHorizontal size={14} />}
                  label={formatSamplingSummary(preset)}
                />
                <FactPill
                  icon={<Regex size={14} />}
                  label={
                    preset.hasThirdPartyData ? "扩展已保留" : "无第三方扩展"
                  }
                />
                <FactPill icon={<FileJson2 size={14} />} label="JSON 已入库" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {preset.samplePromptNames.length > 0 ? (
                  preset.samplePromptNames.map((name, index) => (
                    <span
                      key={`${name}-${index}`}
                      className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                    >
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                    未命名 prompt
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPresetActionBusy || isDetailLoading}
                  type="button"
                  onClick={() => void handleOpenPresetDetail(preset.id)}
                >
                  <Eye size={14} />
                  查看详情
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPresetActionBusy}
                  type="button"
                  onClick={() => void handleExportPreset(preset.id)}
                >
                  <Download size={14} />
                  导出 JSON
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPresetActionBusy}
                  type="button"
                  onClick={() => void handleDeletePreset(preset)}
                >
                  <Trash2 size={14} />
                  删除
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3 text-xs text-[var(--text-muted)]">
                <span>{preset.orderSlotCount} 个 prompt_order 槽</span>
                <span>{formatDate(preset.updatedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {detailError ? (
        <p
          aria-live="polite"
          className="fixed bottom-5 right-5 z-40 max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg"
        >
          读取预设详情失败：{detailError}
        </p>
      ) : null}

      {isDetailLoading ? (
        <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-2xl md:top-0">
          <p className="text-sm text-[var(--text-secondary)]">
            正在读取预设详情...
          </p>
        </div>
      ) : null}

      {selectedPresetDetail ? (
        <PresetDetailDrawer
          detail={selectedPresetDetail}
          onClose={handleClosePresetDetail}
        />
      ) : null}
    </section>
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

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[var(--surface-muted)] px-2 py-2">
      <p className="text-base font-semibold">{value}</p>
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

function PresetDetailDrawer({
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

function formatSamplingSummary(preset: PresetAssetSummary): string {
  const parts = [
    typeof preset.temperature === "number" ? `T ${preset.temperature}` : "",
    typeof preset.topP === "number" ? `P ${preset.topP}` : "",
    typeof preset.maxTokens === "number" ? `${preset.maxTokens} tokens` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "采样参数保留";
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
