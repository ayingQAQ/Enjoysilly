import { AlertTriangle, BadgeCheck, DatabaseBackup, PlugZap } from "lucide-react";

export function RightPanel() {
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="border-b border-[var(--border-soft)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          项目状态
        </p>
        <h2 className="mt-2 text-xl font-semibold">规划完成，脚手架启动</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          现在的目标是先建立稳定工程结构，再进入兼容性 IO 层。
        </p>
      </div>

      <div className="space-y-3 p-5">
        <InfoCard
          icon={BadgeCheck}
          title="已确认边界"
          body="纯浏览器、中文界面、OpenAI 兼容接口、ST 文件双向兼容。"
        />
        <InfoCard
          icon={PlugZap}
          title="CORS 提醒"
          body="浏览器直连接口需要端点支持 CORS；后续设置页会提供明确排查提示。"
        />
        <InfoCard
          icon={DatabaseBackup}
          title="本地数据"
          body="后续使用 IndexedDB 保存角色、预设、世界书、对话与设置。"
        />
        <InfoCard
          icon={AlertTriangle}
          title="待补样本"
          body="还缺独立世界书 JSON 与原生对话 JSONL，用于更完整的回归测试。"
        />
      </div>
    </div>
  );
}

interface InfoCardProps {
  icon: typeof BadgeCheck;
  title: string;
  body: string;
}

function InfoCard({ icon: Icon, title, body }: InfoCardProps) {
  return (
    <article className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={17} className="text-[var(--accent-strong)]" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </article>
  );
}
