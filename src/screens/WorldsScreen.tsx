import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpenText,
  Download,
  Eye,
  FileJson2,
  Library,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { downloadBytesToFile } from "../lib/browserDownload";
import { deleteWorldInfo } from "../lib/db";
import {
  loadWorldInfoAssetSummaries,
  type WorldInfoAssetSummary,
} from "../services/assetCatalog";
import {
  loadWorldInfoDetailSummary,
  type WorldInfoDetailSummary,
  type WorldInfoEntryPreview,
} from "../services/worldInfoDetails";
import { createWorldInfoJsonExport } from "../services/worldInfoExport";
import { importWorldInfoFilesToDatabase } from "../services/worldInfoFileImport";

interface WorldInfoNotice {
  kind: "success" | "error";
  message: string;
}

const dialectLabels: Record<WorldInfoAssetSummary["dialect"], string> = {
  native: "ST 原生",
  portable: "角色卡内嵌",
};

export function WorldsScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [worlds, setWorlds] = useState<WorldInfoAssetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [busyWorldId, setBusyWorldId] = useState<string | null>(null);
  const [selectedWorldDetail, setSelectedWorldDetail] =
    useState<WorldInfoDetailSummary | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<WorldInfoNotice | null>(null);
  const isWorldActionBusy = busyWorldId !== null;

  const refreshWorlds = useCallback(
    async (shouldApply: () => boolean = () => true) => {
      setIsLoading(true);
      setError(null);

      try {
        const summaries = await loadWorldInfoAssetSummaries();

        if (shouldApply()) {
          setWorlds(summaries);
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

    void refreshWorlds(() => isActive);

    return () => {
      isActive = false;
    };
  }, [refreshWorlds]);

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
        const result = await importWorldInfoFilesToDatabase(importItems);

        await refreshWorlds();

        if (result.failed.length > 0) {
          setNotice({
            kind: result.imported.length > 0 ? "success" : "error",
            message: `成功导入 ${result.imported.length} 个世界书，失败 ${result.failed.length} 个：${result.failed
              .map((failure) => `${failure.fileName}（${failure.message}）`)
              .join("；")}`,
          });
        } else {
          setNotice({
            kind: "success",
            message: `已导入 ${result.imported.length} 个世界书，未知字段和 extensions 已保留。`,
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
    [refreshWorlds],
  );

  const handleExportWorld = useCallback(async (worldId: string) => {
    setBusyWorldId(worldId);
    setNotice(null);

    try {
      const exported = await createWorldInfoJsonExport(worldId);

      downloadBytesToFile(exported.bytes, exported.fileName, "application/json");
      setNotice({
        kind: "success",
        message: `已导出世界书 JSON：${exported.fileName}。`,
      });
    } catch (exportError: unknown) {
      setNotice({
        kind: "error",
        message:
          exportError instanceof Error ? exportError.message : String(exportError),
      });
    } finally {
      setBusyWorldId(null);
    }
  }, []);

  const handleDeleteWorld = useCallback(
    async (world: WorldInfoAssetSummary) => {
      const shouldDelete = window.confirm(
        `确定删除世界书“${world.name}”吗？这只会删除 my_silly 本地世界书记录，不会删除角色卡或对话。`,
      );

      if (!shouldDelete) {
        return;
      }

      setBusyWorldId(world.id);
      setNotice(null);

      try {
        await deleteWorldInfo(world.id);
        await refreshWorlds();
        setNotice({
          kind: "success",
          message: `已删除世界书：${world.name}。`,
        });
      } catch (deleteError: unknown) {
        setNotice({
          kind: "error",
          message:
            deleteError instanceof Error ? deleteError.message : String(deleteError),
        });
      } finally {
        setBusyWorldId(null);
      }
    },
    [refreshWorlds],
  );

  const handleOpenWorldDetail = useCallback(async (worldId: string) => {
    setIsDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await loadWorldInfoDetailSummary(worldId);

      setSelectedWorldDetail(detail);
    } catch (detailLoadError: unknown) {
      setSelectedWorldDetail(null);
      setDetailError(
        detailLoadError instanceof Error
          ? detailLoadError.message
          : String(detailLoadError),
      );
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const handleCloseWorldDetail = useCallback(() => {
    setSelectedWorldDetail(null);
    setDetailError(null);
  }, []);

  return (
    <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">
              世界书管理
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
              先把两种世界书方言稳定入库，再逐步做条目编辑与扫描。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              支持 SillyTavern 原生 <code>{"{entries:{}}"}</code> 世界书，也支持角色卡内嵌
              <code>character_book.entries[]</code> 方言。导入后会保留未知字段，列表先聚焦条目数量、
              启用状态和关键词样本。
            </p>
            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                读取世界书失败：{error}
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
              disabled={isImporting || isWorldActionBusy}
              type="button"
              onClick={handlePickFiles}
            >
              <Upload size={16} />
              {isImporting ? "导入中..." : "导入世界书"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryTile label="世界书" value={worlds.length} />
        <SummaryTile
          label="条目总数"
          value={worlds.reduce((total, world) => total + world.entryCount, 0)}
        />
        <SummaryTile
          label="启用条目"
          value={worlds.reduce(
            (total, world) => total + world.enabledEntryCount,
            0,
          )}
        />
        <SummaryTile
          label="常驻条目"
          value={worlds.reduce(
            (total, world) => total + world.constantEntryCount,
            0,
          )}
        />
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] shadow-sm">
          正在读取本地世界书...
        </div>
      ) : null}

      {!isLoading && !error && worlds.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 shadow-sm">
          <div className="mb-4 grid size-12 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
            <BookOpenText size={22} />
          </div>
          <h2 className="text-lg font-semibold">还没有世界书</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            可以导入 ST 原生世界书 JSON，或导入角色卡内嵌 <code>character_book</code> 的 portable
            JSON。后续会在这里继续接入条目编辑器与扫描预览。
          </p>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
            type="button"
            onClick={handlePickFiles}
          >
            <Upload size={16} />
            选择世界书 JSON
          </button>
        </div>
      ) : null}

      {!isLoading && worlds.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {worlds.map((world) => (
            <article
              key={world.id}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                  <Library size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">{world.name}</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {dialectLabels[world.dialect]}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniMetric label="条目" value={world.entryCount} />
                <MiniMetric label="启用" value={world.enabledEntryCount} />
                <MiniMetric label="常驻" value={world.constantEntryCount} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {world.sampleKeys.length > 0 ? (
                  world.sampleKeys.map((key, index) => (
                    <span
                      key={`${key}-${index}`}
                      className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                    >
                      {key}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                    未设置关键词
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isWorldActionBusy || isDetailLoading}
                  type="button"
                  onClick={() => void handleOpenWorldDetail(world.id)}
                >
                  <Eye size={14} />
                  查看详情
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isWorldActionBusy}
                  type="button"
                  onClick={() => void handleExportWorld(world.id)}
                >
                  <Download size={14} />
                  导出 JSON
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isWorldActionBusy}
                  type="button"
                  onClick={() => void handleDeleteWorld(world)}
                >
                  <Trash2 size={14} />
                  删除
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3 text-xs text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <FileJson2 size={14} />
                  JSON 已入库
                </span>
                <span>{formatDate(world.updatedAt)}</span>
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
          读取世界书详情失败：{detailError}
        </p>
      ) : null}

      {isDetailLoading ? (
        <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-2xl md:top-0">
          <p className="text-sm text-[var(--text-secondary)]">
            正在读取世界书详情...
          </p>
        </div>
      ) : null}

      {selectedWorldDetail ? (
        <WorldInfoDetailDrawer
          detail={selectedWorldDetail}
          onClose={handleCloseWorldDetail}
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

function WorldInfoDetailDrawer({
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
