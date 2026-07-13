import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileJson2,
  ImagePlus,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
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
import {
  CharacterAvatar,
  CharacterDetailDrawer,
  DetailLine,
  formatSpec,
  getFilteredCharacters,
  getUniqueTagCount,
  IconActionButton,
  SummaryTile,
  type CharacterSortMode,
} from "./characters/CharacterComponents";

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
