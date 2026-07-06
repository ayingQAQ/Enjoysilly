import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  Download,
  Eye,
  FileJson2,
  ImagePlus,
  Search,
  SlidersHorizontal,
  Star,
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
import {
  createCharacterJsonExport,
  createCharacterPngExport,
} from "../services/characterExport";
import { importCharacterFilesToDatabase } from "../services/characterFileImport";

interface CharacterNotice {
  kind: "success" | "error";
  message: string;
}

type CharacterSortMode = "updated" | "name" | "worldEntries";

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
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<CharacterSortMode>("updated");
  const [showWorldLinkedOnly, setShowWorldLinkedOnly] = useState(false);
  const isCharacterActionBusy = busyCharacterId !== null;
  const filteredCharacters = getFilteredCharacters(characters, {
    query,
    showWorldLinkedOnly,
    sortMode,
  });

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

  const handleExportCharacterPng = useCallback(async (characterId: string) => {
    setBusyCharacterId(characterId);
    setNotice(null);

    try {
      const exported = await createCharacterPngExport(characterId);

      downloadBytesToFile(exported.bytes, exported.fileName, "image/png");
      setNotice({
        kind: "success",
        message:
          exported.source === "original"
            ? `已导出角色卡 PNG：${exported.fileName}。`
            : `已使用默认封面导出角色卡 PNG：${exported.fileName}。`,
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
    <section className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-5 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">
              角色卡
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              角色库
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              管理本地 SillyTavern PNG / JSON 角色卡，保留未知字段、extensions
              与内嵌世界书，导入后可查看详情并按原始 payload 导出。
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
          <div className="flex shrink-0 flex-wrap gap-3">
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
        <SummaryTile label="全部角色" value={characters.length} />
        <SummaryTile
          label="内嵌世界书"
          value={characters.filter((character) => character.worldEntryCount > 0).length}
        />
        <SummaryTile
          label="标签数量"
          value={getUniqueTagCount(characters)}
        />
      </div>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">搜索角色</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              size={18}
            />
            <input
              className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[var(--accent)]"
              placeholder="搜索角色名、描述或标签"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              <SlidersHorizontal size={16} />
              <span className="sr-only">排序</span>
              <select
                className="bg-transparent text-[var(--text-primary)] outline-none"
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as CharacterSortMode)
                }
              >
                <option value="updated">最近更新</option>
                <option value="name">名称 A-Z</option>
                <option value="worldEntries">世界书条目</option>
              </select>
            </label>
            <button
              className={[
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                showWorldLinkedOnly
                  ? "border-[var(--accent)] bg-[var(--accent-weak)] text-[var(--accent-strong)]"
                  : "border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
              ].join(" ")}
              type="button"
              onClick={() => setShowWorldLinkedOnly((value) => !value)}
            >
              <Star size={16} />
              有世界书
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">角色列表</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                显示 {filteredCharacters.length} / {characters.length} 个角色
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)]"
              type="button"
              onClick={handlePickFiles}
            >
              <Upload size={16} />
              导入
            </button>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-5 text-sm text-[var(--text-secondary)]">
              正在读取本地角色卡...
            </div>
          ) : null}

          {!isLoading && !error && characters.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center">
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                <ImagePlus size={24} />
              </div>
              <h3 className="text-lg font-semibold">还没有角色卡</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-[var(--text-secondary)]">
                导入 SillyTavern `.png` 角色卡或独立 `.json` 角色卡后，这里会显示头像、
                标签、描述摘要和内嵌世界书状态。
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

          {!isLoading && characters.length > 0 && filteredCharacters.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center">
              <h3 className="text-lg font-semibold">没有匹配的角色</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                调整搜索关键词或关闭“有世界书”筛选后再试。
              </p>
            </div>
          ) : null}

          {!isLoading && filteredCharacters.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filteredCharacters.map((character) => (
                <article
                  key={character.id}
                  className="group rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"
                >
                  <button
                    className="mx-auto block rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    disabled={isCharacterActionBusy || isDetailLoading}
                    type="button"
                    onClick={() => void handleOpenCharacterDetail(character.id)}
                  >
                    <CharacterAvatar character={character} />
                  </button>
                  <h3 className="mt-3 truncate text-sm font-semibold">
                    {character.name}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatSpec(character.spec, character.specVersion)}
                  </p>
                  <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[var(--text-secondary)]">
                    {character.description || "未填写描述摘要"}
                  </p>

                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {character.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="max-w-full truncate rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                      >
                        {tag}
                      </span>
                    ))}
                    {character.worldEntryCount > 0 ? (
                      <span className="rounded-full bg-[var(--accent-weak)] px-2 py-0.5 text-[11px] text-[var(--accent-strong)]">
                        世界书 {character.worldEntryCount}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-1.5 border-t border-[var(--border-soft)] pt-3">
                    <IconActionButton
                      disabled={isCharacterActionBusy || isDetailLoading}
                      label="查看详情"
                      onClick={() => void handleOpenCharacterDetail(character.id)}
                    >
                      <Eye size={14} />
                    </IconActionButton>
                    <IconActionButton
                      disabled={isCharacterActionBusy}
                      label="导出 JSON"
                      onClick={() => void handleExportCharacter(character.id)}
                    >
                      <Download size={14} />
                    </IconActionButton>
                    <IconActionButton
                      disabled={isCharacterActionBusy}
                      label="导出 PNG"
                      onClick={() => void handleExportCharacterPng(character.id)}
                    >
                      <ImagePlus size={14} />
                    </IconActionButton>
                    <IconActionButton
                      danger
                      disabled={isCharacterActionBusy}
                      label="删除"
                      onClick={() => void handleDeleteCharacter(character)}
                    >
                      <Trash2 size={14} />
                    </IconActionButton>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm xl:sticky xl:top-5 xl:self-start">
          <h2 className="text-base font-semibold">库概览</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            角色数据全部保存在浏览器本地。当前页面只展示与导入导出，不会改写角色卡内容。
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <DetailLine label="角色数量" value={characters.length} />
            <DetailLine
              label="带世界书"
              value={characters.filter((character) => character.worldEntryCount > 0).length}
            />
            <DetailLine
              label="世界书条目"
              value={characters.reduce(
                (total, character) => total + character.worldEntryCount,
                0,
              )}
            />
            <DetailLine label="当前筛选" value={filteredCharacters.length} />
          </div>
        </aside>
      </div>

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

function CharacterAvatar({ character }: { character: CharacterAssetSummary }) {
  return (
    <div className="grid size-20 place-items-center overflow-hidden rounded-full border border-[var(--border-soft)] bg-[var(--accent-weak)] text-xl font-semibold text-[var(--accent-strong)] shadow-sm sm:size-24">
      {character.avatarUrl ? (
        <img
          alt={`${character.name} 头像`}
          className="size-full object-cover"
          src={character.avatarUrl}
        />
      ) : character.name.trim().length > 0 ? (
        character.name.trim().slice(0, 1)
      ) : (
        <Bot size={28} />
      )}
    </div>
  );
}

function IconActionButton({
  children,
  danger = false,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={[
        "grid min-h-9 place-items-center rounded-lg border text-[var(--text-primary)] transition disabled:cursor-not-allowed disabled:opacity-50",
        danger
          ? "border-red-200 bg-red-50 text-red-700 hover:border-red-300"
          : "border-[var(--border-soft)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)]",
      ].join(" ")}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
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

function getFilteredCharacters(
  characters: CharacterAssetSummary[],
  options: {
    query: string;
    showWorldLinkedOnly: boolean;
    sortMode: CharacterSortMode;
  },
): CharacterAssetSummary[] {
  const query = options.query.trim().toLocaleLowerCase("zh-CN");
  const filtered = characters.filter((character) => {
    if (options.showWorldLinkedOnly && character.worldEntryCount === 0) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      character.name,
      character.description,
      character.specVersion,
      ...character.tags,
    ]
      .join("\n")
      .toLocaleLowerCase("zh-CN");

    return haystack.includes(query);
  });

  return filtered.sort((a, b) => {
    if (options.sortMode === "name") {
      return a.name.localeCompare(b.name, "zh-CN");
    }

    if (options.sortMode === "worldEntries") {
      return (
        b.worldEntryCount - a.worldEntryCount ||
        a.name.localeCompare(b.name, "zh-CN")
      );
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function getUniqueTagCount(characters: CharacterAssetSummary[]): number {
  return new Set(characters.flatMap((character) => character.tags)).size;
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
