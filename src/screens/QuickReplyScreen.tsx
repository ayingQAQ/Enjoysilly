import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  Eye,
  FileJson2,
  ListChecks,
  MessageSquare,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";

import { deleteQuickReplySet, listQuickReplySets, type StoredQuickReplySet } from "../lib/db";
import { downloadBytesToFile } from "../lib/browserDownload";
import { importQuickReplySetToDatabase } from "../services/quickReplyImport";
import { createQuickReplyFileName, encodeQuickReplySetJson } from "../lib/quickReplyIO";
import type { QuickReplyItem } from "../types/quickReply";

export function QuickReplyScreen() {
  const [sets, setSets] = useState<StoredQuickReplySet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedSet, setSelectedSet] = useState<StoredQuickReplySet | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (shouldApply: () => boolean = () => true) => {
    setIsLoading(true);
    setError(null);

    try {
      const list = await listQuickReplySets();
      if (shouldApply()) setSets(list);
    } catch (err: unknown) {
      if (shouldApply()) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (shouldApply()) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refresh(() => active);
    return () => { active = false; };
  }, [refresh]);

  const handleImportClick = useCallback(() => importRef.current?.click(), []);

  const handleImportChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    setError(null);

    try {
      const json = new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()));
      await importQuickReplySetToDatabase(json, file.name);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  }, [refresh]);

  const handleExport = useCallback((qrSet: StoredQuickReplySet) => {
    const bytes = encodeQuickReplySetJson(qrSet.payload);
    downloadBytesToFile(bytes, createQuickReplyFileName(qrSet.payload.name), "application/json");
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm("确定删除此快捷回复集吗？")) return;
    try {
      await deleteQuickReplySet(id);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [refresh]);

  return (
    <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">快捷回复</p>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
              管理快速回复集，导入导出 ST Quick Reply v2 JSON。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              点击回复按钮即可向对话输入框插入预设文本。当前版本支持标签和消息文本，
              自动执行与触发时机由导入/导出兼容层保留字段，暂不在 UI 中编辑。
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <input ref={importRef} className="hidden" type="file" accept=".json" onChange={(event) => void handleImportChange(event)} />
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--border-strong)] disabled:opacity-60"
              disabled={isImporting}
              type="button"
              onClick={handleImportClick}
            >
              {isImporting ? "导入中..." : <><Upload size={16} /> 导入 JSON</>}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--border-strong)] disabled:opacity-60"
              disabled={isLoading}
              type="button"
              onClick={() => void refresh()}
            >
              <ListChecks size={16} />
              {isLoading ? "读取中..." : "刷新"}
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="QR 集" value={sets.length} />
        <SummaryTile label="总条目" value={sets.reduce((sum, s) => sum + s.payload.qrList.length, 0)} />
        <SummaryTile label="含 isAuto" value={sets.reduce((sum, s) => sum + s.payload.qrList.filter(i => i.isAuto).length, 0)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">读取快捷回复集...</p>
      ) : sets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
            <MessageSquare size={22} />
          </div>
          <h2 className="text-lg font-semibold">还没有快捷回复集</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
            点击"导入 JSON"导入 ST Quick Reply v2 格式的快捷回复文件。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sets.map((qrSet) => (
            <article key={qrSet.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                  <FileJson2 size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{qrSet.name}</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {qrSet.payload.version ? `v${qrSet.payload.version} · ` : ""}{qrSet.payload.qrList.length} 条
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                {qrSet.payload.qrList.slice(0, 3).map((item, i) => (
                  <div key={i} className="truncate rounded bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">{item.label}</span>
                    {" "}{item.message.slice(0, 40)}
                    {item.isAuto ? <Zap size={12} className="ml-1 inline text-amber-500" /> : null}
                  </div>
                ))}
                {qrSet.payload.qrList.length > 3 ? (
                  <p className="px-2 text-xs text-[var(--text-muted)]">... 还有 {qrSet.payload.qrList.length - 3} 条</p>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)]"
                  type="button"
                  onClick={() => setSelectedSet(qrSet)}
                >
                  <Eye size={14} /> 查看详情
                </button>
                <div className="flex gap-1">
                  <button
                    className="rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1 text-xs transition hover:border-[var(--border-strong)]"
                    type="button"
                    onClick={() => handleExport(qrSet)}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 transition hover:border-red-300"
                    type="button"
                    onClick={() => void handleDelete(qrSet.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedSet ? (
        <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">QR 集详情</p>
              <h2 className="mt-2 text-xl font-semibold">{selectedSet.name}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {selectedSet.payload.version ? `v${selectedSet.payload.version} · ` : ""}{selectedSet.payload.qrList.length} 条回复
              </p>
            </div>
            <button
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] transition hover:border-[var(--border-strong)]"
              type="button"
              onClick={() => setSelectedSet(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-2">
              {selectedSet.payload.qrList.map((item, i) => (
                <div key={i} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {item.label}
                        {item.isAuto ? <Zap size={14} className="ml-1.5 inline text-amber-500" /> : null}
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--text-secondary)]">
                        {item.message || "空消息"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                    {item.isAuto ? <Tag text="自动执行" /> : <Tag text="手动" />}
                    {item.trigger ? <Tag text={`触发: ${item.trigger}`} /> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      ) : null}
    </section>
  );
}

function Tag({ text }: { text: string }) {
  return <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[var(--text-secondary)]">{text}</span>;
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
