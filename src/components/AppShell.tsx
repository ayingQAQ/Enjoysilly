import { ChevronRight, Moon } from "lucide-react";

import { workspaceSections } from "../data/workspace";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import type { WorkspaceSectionId } from "../types/ui";

interface AppShellProps {
  children: React.ReactNode;
}

const sectionGroups: Array<{ label: string; ids: WorkspaceSectionId[] }> = [
  { label: "会话", ids: ["chat", "groups"] },
  { label: "资产", ids: ["characters", "worlds", "presets"] },
  { label: "工具", ids: ["regex", "quickReplies"] },
  { label: "系统", ids: ["settings"] },
];

export function AppShell({ children }: AppShellProps) {
  const activeSection = useWorkspaceStore((state) => state.activeSection);
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--border-soft)] bg-[var(--surface)] px-4 lg:px-5">
        <div className="flex items-center gap-2.5">
          <img
            alt="Enjoy Silly 图标"
            className="size-9 rounded-xl object-cover shadow-sm"
            src="/enjoy-silly-icon.png"
          />
          <div>
            <p className="text-sm font-semibold tracking-tight">Enjoy Silly</p>
            <p className="hidden text-xs text-[var(--text-muted)] sm:block">
              SillyTavern 兼容角色扮演工作台
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
            type="button"
            aria-label="切换主题占位"
          >
            <Moon size={17} />
          </button>
        </div>
      </header>

      <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 lg:hidden">
        {workspaceSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              className={[
                "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                isActive
                  ? "border-[var(--accent)] bg-[var(--accent-weak)] text-[var(--accent-strong)]"
                  : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]",
              ].join(" ")}
              type="button"
              onClick={() => setActiveSection(section.id)}
            >
              <Icon size={16} />
              {section.label}
            </button>
          );
        })}
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 border-r border-[var(--border-soft)] bg-[var(--surface)] lg:flex lg:flex-col">
          <nav aria-label="工作区导航" className="space-y-5 p-3 pt-5">
            {sectionGroups.map((group) => (
              <div key={group.label}>
                <p className="px-2 pb-1.5 text-[11px] font-medium tracking-[0.12em] text-[var(--text-muted)]">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {workspaceSections
                    .filter((section) => group.ids.includes(section.id))
                    .map((section) => {
                      const Icon = section.icon;
                      const isActive = activeSection === section.id;

                      return (
                        <button
                          key={section.id}
                          className={[
                            "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                            isActive
                              ? "bg-[var(--accent-weak)] text-[var(--accent-strong)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
                          ].join(" ")}
                          type="button"
                          onClick={() => setActiveSection(section.id)}
                        >
                          <Icon size={17} />
                          <span className="min-w-0 flex-1 text-sm font-medium">{section.label}</span>
                          {isActive ? <ChevronRight size={15} /> : null}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
