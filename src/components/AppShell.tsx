import { ChevronRight, Database, Moon, Search } from "lucide-react";

import { workspaceSections } from "../data/workspace";
import { useWorkspaceStore } from "../store/useWorkspaceStore";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const activeSection = useWorkspaceStore((state) => state.activeSection);
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--app-bg)] text-[var(--text-primary)]">
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
          <button
            className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
            type="button"
            aria-label="切换主题占位"
          >
            <Moon size={17} />
          </button>
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto border-b border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 lg:hidden">
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

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
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
        </aside>

        <main className="min-h-0 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
