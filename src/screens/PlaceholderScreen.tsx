import type { WorkspaceSection } from "../types/ui";

interface PlaceholderScreenProps {
  section: WorkspaceSection;
}

export function PlaceholderScreen({ section }: PlaceholderScreenProps) {
  const Icon = section.icon;

  return (
    <section className="mx-auto flex min-h-full max-w-5xl flex-col justify-center px-5 py-8 lg:px-8">
      <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="mb-5 grid size-12 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
          <Icon size={22} />
        </div>
        <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">
          {section.label}
        </p>
        <h1 className="max-w-2xl text-2xl font-semibold tracking-tight">
          这个模块会按阶段逐步接入真实数据。
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
          当前先完成角色卡、世界书、预设这些兼容资产的管理闭环；其余页面会沿用同一套
          IndexedDB 查询、导入结果和错误展示模型。
        </p>
      </div>
    </section>
  );
}
