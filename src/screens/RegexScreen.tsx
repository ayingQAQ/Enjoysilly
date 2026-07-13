import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Braces,
  Download,
  Eye,
  FileJson2,
  ListChecks,
  Regex,
  ScrollText,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";

import { deleteRegexScript, listRegexScripts, type StoredRegexScript } from "../lib/db";
import { downloadBytesToFile } from "../lib/browserDownload";
import {
  createRegexCatalogFilterSummary,
  filterRegexCatalogItems,
  hasRegexCatalogFilters,
  loadRegexCatalogSummary,
  type RegexCatalogItem,
  type RegexCatalogSummary,
  type RegexCatalogFlagFilter,
  type RegexCatalogStatusFilter,
} from "../services/regexCatalog";
import { importRegexScriptToDatabase } from "../services/regexImport";
import { encodeRegexScriptsJson, createRegexScriptFileName } from "../lib/regexIO";
import {
  createPlacementFilterOptions,
  FactPill,
  formatDate,
  formatDepthRange,
  MiniMetric,
  PreviewLine,
  Badge,
  RegexDetailDrawer,
  SelectFilter,
  SummaryTile,
} from "./regex/RegexComponents";

const placementFilterAllValue = "__all_placements__";

export function RegexScreen() {
  const [catalog, setCatalog] = useState<RegexCatalogSummary | null>(null);
  const [selectedItem, setSelectedItem] = useState<RegexCatalogItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<RegexCatalogStatusFilter>("all");
  const [flagFilter, setFlagFilter] = useState<RegexCatalogFlagFilter>("all");
  const [placementFilter, setPlacementFilter] = useState<number | "all">("all");

  const [ownScripts, setOwnScripts] = useState<StoredRegexScript[]>([]);
  const [isOwnLoading, setIsOwnLoading] = useState(true);
  const [ownError, setOwnError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const regexImportRef = useRef<HTMLInputElement>(null);

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

  const refreshOwnScripts = useCallback(async (shouldApply: () => boolean = () => true) => {
    setIsOwnLoading(true);
    setOwnError(null);

    try {
      const scripts = await listRegexScripts();
      if (shouldApply()) setOwnScripts(scripts);
    } catch (loadError: unknown) {
      if (shouldApply()) setOwnError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (shouldApply()) setIsOwnLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    void refreshCatalog(() => isActive);
    void refreshOwnScripts(() => isActive);

    return () => {
      isActive = false;
    };
  }, [refreshCatalog, refreshOwnScripts]);

  const allItems = catalog?.items ?? [];
  const placementFilterOptions = createPlacementFilterOptions(allItems);
  const items = filterRegexCatalogItems(allItems, {
    flag: flagFilter,
    placement: placementFilter,
    query,
    status: statusFilter,
  });
  const filterOptions = {
    flag: flagFilter,
    placement: placementFilter,
    query,
    status: statusFilter,
  };
  const isFiltering = hasRegexCatalogFilters(filterOptions);
  const filterSummary = createRegexCatalogFilterSummary({
    ...filterOptions,
    shownCount: items.length,
    totalCount: allItems.length,
  });

  const handleClearFilters = useCallback(() => {
    setQuery("");
    setStatusFilter("all");
    setFlagFilter("all");
    setPlacementFilter("all");
  }, []);

  const handleImportClick = useCallback(() => {
    regexImportRef.current?.click();
  }, []);

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setIsImporting(true);
      setOwnError(null);

      try {
        const json = new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()));
        await importRegexScriptToDatabase(json, file.name);
        await refreshOwnScripts();
      } catch (err: unknown) {
        setOwnError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsImporting(false);
      }
    },
    [refreshOwnScripts],
  );

  const handleExportOwn = useCallback((script: StoredRegexScript) => {
    const bytes = encodeRegexScriptsJson([script.payload]);
    downloadBytesToFile(bytes, createRegexScriptFileName(script.payload), "application/json");
  }, []);

  const handleDeleteOwn = useCallback(
    async (id: string) => {
      if (!window.confirm("确定删除此自有正则脚本吗？")) return;
      try {
        await deleteRegexScript(id);
        await refreshOwnScripts();
      } catch (err: unknown) {
        setOwnError(err instanceof Error ? err.message : String(err));
      }
    },
    [refreshOwnScripts],
  );

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
              上方目录从已导入预设只读聚合；下方“自有正则”支持导入导出 ST 正则
              JSON。页面不会编辑来源 preset，也不会运行 TavernHelper / JS-Slash-Runner。
              原始 preset payload 和 extensions 仍由预设兼容层原样保留。
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
        <SummaryTile label="当前显示" value={items.length} />
        <SummaryTile label="ST 启用" value={catalog?.enabledScriptCount ?? 0} />
        <SummaryTile label="ST disabled" value={catalog?.disabledScriptCount ?? 0} />
      </div>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
          <label className="block text-sm">
            <span className="font-medium text-[var(--text-primary)]">
              搜索脚本 / 来源 / 正则内容
            </span>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              placeholder="例如 scriptName、findRegex、replaceString..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <SelectFilter
            label="ST 状态"
            value={statusFilter}
            options={[
              { label: "全部", value: "all" },
              { label: "仅 enabled", value: "enabled" },
              { label: "仅 disabled", value: "disabled" },
            ]}
            onChange={(value) =>
              setStatusFilter(value as RegexCatalogStatusFilter)
            }
          />
          <SelectFilter
            label="惰性标记"
            value={flagFilter}
            options={[
              { label: "全部", value: "all" },
              { label: "runOnEdit", value: "runOnEdit" },
              { label: "promptOnly", value: "promptOnly" },
              { label: "markdownOnly", value: "markdownOnly" },
            ]}
            onChange={(value) => setFlagFilter(value as RegexCatalogFlagFilter)}
          />
          <SelectFilter
            label="placement"
            value={
              placementFilter === "all"
                ? placementFilterAllValue
                : String(placementFilter)
            }
            options={[
              { label: "全部", value: placementFilterAllValue },
              ...placementFilterOptions,
            ]}
            onChange={(value) =>
              setPlacementFilter(
                value === placementFilterAllValue ? "all" : Number(value),
              )
            }
          />
        </div>
        <div className="mt-3 flex flex-col gap-2 text-xs leading-6 text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            筛选只作用于当前浏览器内的只读目录，不会修改来源 preset，也不会编译或执行正则。
          </p>
          <button
            className="self-start rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-1.5 font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
            disabled={!isFiltering}
            type="button"
            onClick={handleClearFilters}
          >
            清空筛选
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)] shadow-sm">
          正在从本地预设读取 extensions.regex_scripts...
        </div>
      ) : null}

      {!isLoading && !error && allItems.length === 0 ? (
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

      {!isLoading && !error && allItems.length > 0 && items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 shadow-sm">
          <div className="mb-4 grid size-12 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
            <ListChecks size={22} />
          </div>
          <h2 className="text-lg font-semibold">没有匹配当前筛选的正则脚本</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            当前目录共有 {allItems.length} 条脚本，但没有脚本匹配搜索和筛选条件。
            清空搜索或切回“全部”即可恢复完整目录。
          </p>
        </div>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">{filterSummary}</p>
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
                  <MiniMetric
                    label="未知字段"
                    value={item.unknownFieldNames.length}
                  />
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
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Regex size={16} className="text-[var(--accent-strong)]" />
              自有正则
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              管理 my_silly 自有正则脚本，支持 ST 正则 JSON 导入导出，可绑定角色。
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <input
              ref={regexImportRef}
              className="hidden"
              type="file"
              accept=".json"
              onChange={(event) => void handleImportChange(event)}
            />
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isImporting}
              type="button"
              onClick={handleImportClick}
            >
              {isImporting ? "导入中..." : <><Upload size={14} /> 导入 JSON</>}
            </button>
          </div>
        </div>
        {ownError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{ownError}</p>
        ) : null}
        {isOwnLoading ? (
          <p className="text-xs text-[var(--text-muted)]">读取自有正则...</p>
        ) : ownScripts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-soft)] p-4 text-center text-xs text-[var(--text-muted)]">
            还没有自有正则脚本。点击"导入 JSON"导入 ST 正则格式文件。
          </div>
        ) : (
          <div className="space-y-2">
            {ownScripts.map((script) => (
              <div
                key={script.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2"
              >
                <div className="min-w-0 text-xs">
                  <p className="font-medium text-[var(--text-primary)]">{script.name}</p>
                  <p className="truncate text-[var(--text-muted)]">
                    findRegex: {script.payload.findRegex?.slice(0, 60) || "空"} · replace: {script.payload.replaceString?.slice(0, 40) || "空"}
                    {script.characterId ? ` · 绑定角色` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    className="rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1 text-xs transition hover:border-[var(--border-strong)]"
                    type="button"
                    onClick={() => handleExportOwn(script)}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 transition hover:border-red-300"
                    type="button"
                    onClick={() => void handleDeleteOwn(script.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedItem ? (
        <RegexDetailDrawer
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </section>
  );
}
