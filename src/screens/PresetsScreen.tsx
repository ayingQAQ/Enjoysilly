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
} from "../services/presetDetails";
import { createPresetJsonExport } from "../services/presetExport";
import { importPresetFilesToDatabase } from "../services/presetFileImport";
import {
  FactPill,
  formatDate,
  formatSamplingSummary,
  MiniMetric,
  PresetDetailDrawer,
  SummaryTile,
} from "./presets/PresetComponents";

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
