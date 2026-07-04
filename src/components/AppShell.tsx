import { ChevronRight, Database, Moon, PanelRight, Search } from "lucide-react";

import { demoCharacters, workspaceSections } from "../data/workspace";
import { useWorkspaceStore } from "../store/useWorkspaceStore";

interface AppShellProps {
  children: React.ReactNode;
  rightPanel: React.ReactNode;
}

export function AppShell({ children, rightPanel }: AppShellProps) {
  const activeSection = useWorkspaceStore((state) => state.activeSection);
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);
  const isRightPanelOpen = useWorkspaceStore((state) => state.isRightPanelOpen);
  const toggleRightPanel = useWorkspaceStore((state) => state.toggleRightPanel);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)]">
      <header className="flex h-16 items-center border-b border-[var(--border-soft)] bg-[var(--surface)] px-5">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-[var(--accent)] text-white shadow-sm">
            <Database size={18} />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">墨 · my_silly</p>
            <p className="text-xs text-[var(--text-muted)]">
              SillyTavern 兼容工作台
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-[var(--text-secondary)] sm:block">
            阶段 0 · 脚手架
          </div>
          <button
            className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
            type="button"
            aria-label="切换主题占位"
          >
            <Moon size={17} />
          </button>
          <button
            className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] lg:hidden"
            type="button"
            aria-label="打开详情面板"
            onClick={toggleRightPanel}
          >
            <PanelRight size={18} />
          </button>
        </div>
      </header>

      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="hidden min-h-0 border-r border-[var(--border-soft)] bg-[var(--surface)] lg:flex lg:flex-col">
          <div className="p-4">
            <label className="flex items-center gap-2 rounded-lg border border-transparent bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-muted)] focus-within:border-[var(--accent)]">
              <Search size={16} />
              <input
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--text-muted)]"
                placeholder="搜索角色 / 预设"
              />
            </label>
          </div>

          <nav className="space-y-1 px-3">
            {workspaceSections.map((section) => {
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
                  <Icon size={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{section.label}</span>
                    <span className="block truncate text-xs opacity-70">
                      {section.description}
                    </span>
                  </span>
                  {isActive ? <ChevronRight size={16} /> : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-[var(--border-soft)] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              测试样本
            </p>
            <div className="space-y-2">
              {demoCharacters.map((character) => (
                <div
                  key={character.id}
                  className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3"
                >
                  <div className="flex items-start gap-3">
                    {character.avatarUrl ? (
                      <img
                        className="size-10 rounded-md object-cover"
                        src={character.avatarUrl}
                        alt=""
                      />
                    ) : (
                      <div className="grid size-10 place-items-center rounded-md bg-[var(--accent-weak)] text-xs font-semibold text-[var(--accent-strong)]">
                        JSON
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {character.name}
                      </p>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {character.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-h-0 overflow-auto">{children}</main>

        <aside
          className={[
            "fixed inset-y-16 right-0 z-20 w-80 border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl transition lg:static lg:inset-auto lg:block lg:w-auto lg:shadow-none",
            isRightPanelOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          ].join(" ")}
        >
          {rightPanel}
        </aside>
      </div>
    </div>
  );
}
