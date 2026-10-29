import { Component, type ReactNode } from "react";

export class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="m-6 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold">页面加载失败</h2>
      <p className="my-3 text-sm text-[var(--text-secondary)]">请检查连接后重试，或切换到其他页面。本地数据库不会因此清空；未写入的编辑可能需要重新输入。</p>
      <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white" onClick={() => window.location.reload()}>重新加载页面</button>
    </section>;
  }
}
