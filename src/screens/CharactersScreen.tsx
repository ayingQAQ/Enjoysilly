import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  Download,
  Eye,
  FileJson2,
  ImagePlus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { downloadBytesToFile } from "../lib/browserDownload";
import { deleteCharacter } from "../lib/db";
import {
  loadCharacterAssetSummaries,
  type CharacterAssetSummary,
} from "../services/assetCatalog";
import {
  loadCharacterDetailSummary,
  type CharacterDetailSummary,
} from "../services/characterDetails";
import { createCharacterJsonExport } from "../services/characterExport";
import { importCharacterFilesToDatabase } from "../services/characterFileImport";

interface CharacterNotice {
  kind: "success" | "error";
  message: string;
}

export function CharactersScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [characters, setCharacters] = useState<CharacterAssetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [busyCharacterId, setBusyCharacterId] = useState<string | null>(null);
  const [selectedCharacterDetail, setSelectedCharacterDetail] =
    useState<CharacterDetailSummary | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<CharacterNotice | null>(null);
  const isCharacterActionBusy = busyCharacterId !== null;

  const refreshCharacters = useCallback(
    async (shouldApply: () => boolean = () => true) => {
      setIsLoading(true);
      setError(null);

      try {
        const summaries = await loadCharacterAssetSummaries();

        if (shouldApply()) {
          setCharacters(summaries);
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

    void refreshCharacters(() => isActive);

    return () => {
      isActive = false;
    };
  }, [refreshCharacters]);

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
        const result = await importCharacterFilesToDatabase(importItems);

        await refreshCharacters();

        if (result.failed.length > 0) {
          setNotice({
            kind: result.imported.length > 0 ? "success" : "error",
            message: `成功导入 ${result.imported.length} 个角色卡，失败 ${result.failed.length} 个：${result.failed
              .map((failure) => `${failure.fileName}（${failure.message}）`)
              .join("；")}`,
          });
        } else {
          setNotice({
            kind: "success",
            message: `已导入 ${result.imported.length} 个角色卡，未知字段和 extensions 已保留。`,
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
    [refreshCharacters],
  );

  const handleExportCharacter = useCallback(async (characterId: string) => {
    setBusyCharacterId(characterId);
    setNotice(null);

    try {
      const exported = await createCharacterJsonExport(characterId);

      downloadBytesToFile(exported.bytes, exported.fileName, "application/json");
      setNotice({
        kind: "success",
        message: `已导出角色卡 JSON：${exported.fileName}。`,
      });
    } catch (exportError: unknown) {
      setNotice({
        kind: "error",
        message:
          exportError instanceof Error ? exportError.message : String(exportError),
      });
    } finally {
      setBusyCharacterId(null);
    }
  }, []);

  const handleDeleteCharacter = useCallback(
    async (character: CharacterAssetSummary) => {
      const shouldDelete = window.confirm(
        `确定删除角色卡“${character.name}”吗？这只会删除 my_silly 本地 IndexedDB 记录。`,
      );

      if (!shouldDelete) {
        return;
      }

      setBusyCharacterId(character.id);
      setNotice(null);

      try {
        await deleteCharacter(character.id);
        await refreshCharacters();
        setNotice({
          kind: "success",
          message: `已删除角色卡：${character.name}。`,
        });
      } catch (deleteError: unknown) {
        setNotice({
          kind: "error",
          message:
            deleteError instanceof Error ? deleteError.message : String(deleteError),
        });
      } finally {
        setBusyCharacterId(null);
      }
    },
    [refreshCharacters],
  );

  const handleOpenCharacterDetail = useCallback(async (characterId: string) => {
    setIsDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await loadCharacterDetailSummary(characterId);

      setSelectedCharacterDetail(detail);
    } catch (detailLoadError: unknown) {
      setSelectedCharacterDetail(null);
      setDetailError(
        detailLoadError instanceof Error
          ? detailLoadError.message
          : String(detailLoadError),
      );
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const handleCloseCharacterDetail = useCallback(() => {
    setSelectedCharacterDetail(null);
    setDetailError(null);
  }, []);

  return (
    <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">
              角色卡管理
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
              从真实 SillyTavern PNG / JSON 角色卡开始，建立资产列表闭环。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              当前页面读取 IndexedDB 中的角色卡记录；导入会走兼容层解析，保留未知字段、
              `extensions` 与内嵌世界书，后续导出会沿用同一份原始 payload。
            </p>
            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                读取角色卡失败：{error}
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
              accept=".png,.json,application/json,image/png"
              multiple
              onChange={handleFileChange}
            />
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isImporting || isCharacterActionBusy}
              type="button"
              onClick={handlePickFiles}
            >
              <Upload size={16} />
              {isImporting ? "导入中..." : "导入角色卡"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="角色卡" value={characters.length} />
        <SummaryTile
          label="内嵌世界书"
          value={characters.filter((character) => character.worldEntryCount > 0).length}
        />
        <SummaryTile
          label="世界书条目"
          value={characters.reduce(
            (total, character) => total + character.worldEntryCount,
            0,
          )}
        />
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] shadow-sm">
          正在读取本地角色卡...
        </div>
      ) : null}

      {!isLoading && !error && characters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 shadow-sm">
          <div className="mb-4 grid size-12 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
            <ImagePlus size={22} />
          </div>
          <h2 className="text-lg font-semibold">还没有角色卡</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            可以导入 SillyTavern 导出的 `.png` 角色卡或独立 `.json` 角色卡。导入后这里会显示
            spec、标签、描述摘要和内嵌世界书条目数。
          </p>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
            type="button"
            onClick={handlePickFiles}
          >
            <Upload size={16} />
            选择角色卡文件
          </button>
        </div>
      ) : null}

      {!isLoading && characters.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {characters.map((character) => (
            <article
              key={character.id}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-base font-semibold text-[var(--accent-strong)]">
                  {character.name.slice(0, 1) || <Bot size={20} />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">
                    {character.name}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatSpec(character.spec, character.specVersion)}
                  </p>
                </div>
              </div>

              <p className="min-h-12 text-sm leading-6 text-[var(--text-secondary)]">
                {character.description || "这个角色卡没有提供描述摘要。"}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {character.tags.length > 0 ? (
                  character.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                    未设置标签
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCharacterActionBusy || isDetailLoading}
                  type="button"
                  onClick={() => void handleOpenCharacterDetail(character.id)}
                >
                  <Eye size={14} />
                  查看详情
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCharacterActionBusy}
                  type="button"
                  onClick={() => void handleExportCharacter(character.id)}
                >
                  <Download size={14} />
                  导出 JSON
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCharacterActionBusy}
                  type="button"
                  onClick={() => void handleDeleteCharacter(character)}
                >
                  <Trash2 size={14} />
                  删除
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3 text-xs text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <FileJson2 size={14} />
                  世界书 {character.worldEntryCount} 条
                </span>
                <span>{formatDate(character.updatedAt)}</span>
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
          读取角色卡详情失败：{detailError}
        </p>
      ) : null}

      {isDetailLoading ? (
        <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-2xl md:top-0">
          <p className="text-sm text-[var(--text-secondary)]">
            正在读取角色卡详情...
          </p>
        </div>
      ) : null}

      {selectedCharacterDetail ? (
        <CharacterDetailDrawer
          detail={selectedCharacterDetail}
          onClose={handleCloseCharacterDetail}
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

function CharacterDetailDrawer({
  detail,
  onClose,
}: {
  detail: CharacterDetailSummary;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="角色卡详情"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            只读预览
          </p>
          <h2 className="mt-2 truncate text-xl font-semibold">{detail.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            这里仅展示角色卡 payload 摘要；未知字段、extensions 和内嵌世界书仍保存在原始
            payload 中，不在本页规范化或写回。
          </p>
        </div>
        <button
          aria-label="关闭角色卡详情"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-primary)] transition hover:border-[var(--border-strong)]"
          type="button"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <MiniMetric label="Spec" value={formatSpec(detail.spec, detail.specVersion)} />
          <MiniMetric label="标签" value={detail.tags.length} />
          <MiniMetric label="备用问候" value={detail.alternateGreetingCount} />
          <MiniMetric
            label="内嵌世界书"
            value={detail.embeddedBook?.entryCount ?? 0}
          />
        </div>

        <section className="mt-5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <h3 className="text-sm font-semibold">结构信号</h3>
          <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
            <DetailLine label="头像字段" value={detail.hasAvatar ? "存在" : "未设"} />
            <DetailLine label="creator" value={detail.creator ?? "未设"} />
            <DetailLine
              label="character_version"
              value={detail.characterVersion ?? "未设"}
            />
            <DetailLine
              label="group_only_greetings"
              value={detail.groupOnlyGreetingCount}
            />
            <DetailLine
              label="extensions 字段"
              value={formatFieldNames(detail.extensionFieldNames)}
            />
            <DetailLine
              label="保留字段信号"
              value={formatPreservedFields(detail)}
            />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">文本预览</h3>
          <div className="mt-3 space-y-3">
            <TextPreviewCard label="description" value={detail.textPreviews.description} />
            <TextPreviewCard label="personality" value={detail.textPreviews.personality} />
            <TextPreviewCard label="scenario" value={detail.textPreviews.scenario} />
            <TextPreviewCard label="first_mes" value={detail.textPreviews.firstMessage} />
            <TextPreviewCard label="system_prompt" value={detail.textPreviews.systemPrompt} />
            <TextPreviewCard
              label="post_history_instructions"
              value={detail.textPreviews.postHistoryInstructions}
            />
            <TextPreviewCard
              label="mes_example"
              value={detail.textPreviews.messageExample}
            />
            <TextPreviewCard
              label="creator_notes"
              value={detail.textPreviews.creatorNotes}
            />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">内嵌世界书</h3>
          {detail.embeddedBook ? (
            <EmbeddedBookPreview book={detail.embeddedBook} />
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-[var(--border-strong)] p-4 text-sm text-[var(--text-muted)]">
              这个角色卡没有内嵌 character_book。
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-muted)] px-2 py-2 text-center">
      <p className="truncate text-base font-semibold">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function TextPreviewCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-[var(--border-soft)] p-3">
      <h4 className="font-mono text-xs text-[var(--text-muted)]">{label}</h4>
      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
        {value || "未设"}
      </p>
    </article>
  );
}

function EmbeddedBookPreview({
  book,
}: {
  book: NonNullable<CharacterDetailSummary["embeddedBook"]>;
}) {
  return (
    <article className="mt-3 rounded-lg border border-[var(--border-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{book.name}</h4>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            启用 {book.enabledEntryCount}/{book.entryCount} · 常驻{" "}
            {book.constantEntryCount} · selective {book.selectiveEntryCount}
          </p>
        </div>
        <div className="grid size-10 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
          <BookOpen size={18} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {book.sampleKeys.length > 0 ? (
          book.sampleKeys.map((key, index) => (
            <span
              key={`${key}-${index}`}
              className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
            >
              {key}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
            无关键词样本
          </span>
        )}
      </div>

      {book.sampleComments.length > 0 ? (
        <p className="mt-4 text-xs leading-6 text-[var(--text-muted)]">
          条目标题：{book.sampleComments.join(" · ")}
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
        保留条目字段：
        {book.entryUnknownFieldNames.length > 0
          ? book.entryUnknownFieldNames.join("、")
          : "无"}
      </p>
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
      <span className="break-all text-right font-medium text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

function formatSpec(spec: CharacterAssetSummary["spec"], specVersion: string): string {
  return spec === "chara_card_v3" ? `V3 · ${specVersion}` : `V2 · ${specVersion}`;
}

function formatFieldNames(values: string[]): string {
  return values.length > 0 ? values.join(" / ") : "无";
}

function formatPreservedFields(detail: CharacterDetailSummary): string {
  const parts = [
    detail.rootUnknownFieldNames.length > 0
      ? `root:${detail.rootUnknownFieldNames.join("/")}`
      : "",
    detail.dataUnknownFieldNames.length > 0
      ? `data:${detail.dataUnknownFieldNames.join("/")}`
      : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "无";
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
