import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  Braces,
  CheckCircle2,
  FileJson2,
  Library,
  MessageSquareText,
  ScrollText,
  Upload,
} from "lucide-react";

import { workspaceSections } from "../data/workspace";
import { loadAssetStats, type AssetStats } from "../lib/assetStats";
import {
  importBundledSamplesToDatabase,
  type BundledSampleImportResult,
} from "../services/sampleImport";
import { useWorkspaceStore } from "../store/useWorkspaceStore";

const roadmapItems = [
  {
    title: "阶段 0",
    body: "脚手架、基础布局、Tailwind 与 Zustand",
    isCurrent: true,
  },
  {
    title: "阶段 1",
    body: "类型、IndexedDB、PNG / 预设 / 世界书 / 对话 IO",
    isCurrent: false,
  },
  {
    title: "阶段 2",
    body: "三大资产管理界面与导入导出 UI",
    isCurrent: false,
  },
  {
    title: "阶段 3",
    body: "提示词组装、宏、世界书简化扫描、API 流式",
    isCurrent: false,
  },
];

const emptyStats: AssetStats = {
  characters: 0,
  presets: 0,
  worlds: 0,
  chats: 0,
  regexScripts: 0,
  worldEntries: 0,
};

const statDescriptors = [
  { key: "characters", label: "角色卡", icon: Bot },
  { key: "presets", label: "预设", icon: ScrollText },
  { key: "worlds", label: "世界书", icon: Library },
  { key: "chats", label: "对话存档", icon: MessageSquareText },
  { key: "regexScripts", label: "正则脚本", icon: Braces },
  { key: "worldEntries", label: "世界书条目", icon: FileJson2 },
] as const;

const sampleResultLabels: Record<BundledSampleImportResult["assetKind"], string> = {
  character: "角色卡",
  preset: "预设",
  world: "世界书",
  chat: "对话",
};

interface SampleImportNotice {
  kind: "success" | "error";
  message: string;
}

export function DashboardScreen() {
  const activeSection = useWorkspaceStore((state) => state.activeSection);
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);
  const activeMeta = workspaceSections.find((section) => section.id === activeSection);
  const [assetStats, setAssetStats] = useState<AssetStats>(emptyStats);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isImportingSamples, setIsImportingSamples] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [sampleImportNotice, setSampleImportNotice] =
    useState<SampleImportNotice | null>(null);

  const refreshStats = useCallback(async (shouldApply: () => boolean = () => true) => {
    setIsLoadingStats(true);
    setStatsError(null);

    try {
      const stats = await loadAssetStats();

      if (shouldApply()) {
        setAssetStats(stats);
      }
    } catch (error: unknown) {
      if (shouldApply()) {
        setStatsError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (shouldApply()) {
        setIsLoadingStats(false);
      }
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    void refreshStats(() => isActive);

    return () => {
      isActive = false;
    };
  }, [refreshStats]);

  const handleImportSamples = useCallback(async () => {
    setIsImportingSamples(true);
    setSampleImportNotice(null);

    try {
      const imported = await importBundledSamplesToDatabase();
      await refreshStats();

      const importedKinds = imported.results
        .map((result) => sampleResultLabels[result.assetKind])
        .join("、");
      const warningCount = imported.results.reduce(
        (total, result) => total + result.warnings.length,
        0,
      );

      setSampleImportNotice({
        kind: "success",
        message: `已导入样本：${importedKinds}。统计已刷新${
          warningCount > 0 ? `，包含 ${warningCount} 条兼容性提示` : ""
        }。`,
      });
    } catch (error: unknown) {
      setSampleImportNotice({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsImportingSamples(false);
    }
  }, [refreshStats]);

  return (
    <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">
              当前模块 · {activeMeta?.label ?? "对话"}
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
              先把可维护的工作台骨架立稳，再逐步接入兼容层。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              阶段 1 已接入 IndexedDB 数据层；这里开始读取本地资产统计，为阶段 2
              的角色卡、世界书、预设管理界面做接线准备。
            </p>
            {statsError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                读取本地数据库失败：{statsError}
              </p>
            ) : null}
            {sampleImportNotice ? (
              <p
                aria-live="polite"
                className={[
                  "mt-3 rounded-lg border px-3 py-2 text-sm",
                  sampleImportNotice.kind === "success"
                    ? "border-[var(--accent-weak)] bg-[var(--surface-muted)] text-[var(--accent-strong)]"
                    : "border-red-200 bg-red-50 text-red-700",
                ].join(" ")}
              >
                {sampleImportNotice.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isImportingSamples}
              type="button"
              onClick={handleImportSamples}
            >
              <Upload size={16} />
              {isImportingSamples ? "导入样本中..." : "导入样本"}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)]"
              type="button"
            >
              查看规划
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {statDescriptors.map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              key={stat.label}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm"
            >
              <div className="mb-4 grid size-9 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
                <Icon size={18} />
              </div>
              <p className="text-2xl font-semibold">
                {isLoadingStats ? "..." : assetStats[stat.key]}
              </p>
              <p className="text-sm text-[var(--text-muted)]">{stat.label}</p>
            </article>
          );
        })}
      </div>
      {!isLoadingStats &&
      !statsError &&
      Object.values(assetStats).every((value) => value === 0) ? (
        <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-5 text-sm leading-7 text-[var(--text-secondary)]">
          本地数据库目前还没有资产。可以先导入内置样本，确认角色卡、内嵌世界书和预设能按 SillyTavern
          兼容路径入库。
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">阶段路线</h2>
            <span className="rounded-full bg-[var(--accent-weak)] px-3 py-1 text-xs text-[var(--accent-strong)]">
              按 plan.md 推进
            </span>
          </div>
          <div className="space-y-3">
            {roadmapItems.map((item) => (
              <div
                key={item.title}
                className="flex gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3"
              >
                <CheckCircle2
                  className={
                    item.isCurrent
                      ? "text-[var(--accent-strong)]"
                      : "text-[var(--text-muted)]"
                  }
                  size={18}
                />
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileJson2 size={18} className="text-[var(--accent-strong)]" />
            <h2 className="text-base font-semibold">兼容性守则</h2>
          </div>
          <ul className="space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
            <li>角色卡 PNG 读取优先 `ccv3`，回退 `chara`。</li>
            <li>世界书必须支持独立 `{`entries:{}`}` 与内嵌数组方言互转。</li>
            <li>预设只支持 ST 原生 Chat Completion，不执行第三方脚本。</li>
            <li>未知字段与 `extensions` 在导入导出中原样保留。</li>
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm lg:hidden">
        <h2 className="mb-3 text-base font-semibold">模块导航</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {workspaceSections.map((section) => (
            <button
              key={section.id}
              className={[
                "rounded-lg border px-3 py-2 text-left text-sm transition",
                activeSection === section.id
                  ? "border-[var(--accent)] bg-[var(--accent-weak)] text-[var(--accent-strong)]"
                  : "border-[var(--border-soft)] bg-[var(--surface-muted)]",
              ].join(" ")}
              type="button"
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
