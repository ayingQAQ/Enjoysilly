import type { ReactNode } from "react";
import {
  FileJson2,
  Loader2,
  MessageSquare,
  Pencil,
  Trash2,
} from "lucide-react";

import type { CharacterDetailSummary } from "../services/characterDetails";
import type { ChatArchiveSummary } from "../services/chatArchive";
import type { PresetDetailSummary } from "../services/presetDetails";
export { ChatBubble } from "./chat/ChatMessageBubble";
export type { ChatHtmlCardAction } from "./chat/ChatMessageBubble";


export function EmptyChatState() {
  return (
    <div className="grid min-h-[180px] place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-5 text-center">
      <div>
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
          <MessageSquare size={19} />
        </div>
        <h2 className="text-base font-semibold">还没有消息</h2>
        <p className="mt-2 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
          选择角色后会自动载入首条问候；也可以直接输入消息开始对话。
        </p>
      </div>
    </div>
  );
}

export function SummaryTile({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-muted)] px-3 py-2">
      <p
        className={[
          "truncate font-semibold",
          compact ? "text-sm" : "text-xl",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

export function PanelTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <div className="mt-0.5 text-[var(--accent-strong)]">{icon}</div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export function AssetSelectionSummary({
  characterDetail,
  isAssetLoading,
  presetDetail,
}: {
  characterDetail: CharacterDetailSummary | null;
  isAssetLoading: boolean;
  presetDetail: PresetDetailSummary | null;
}) {
  const lines = [
    characterDetail
      ? `角色：${characterDetail.name} · ${characterDetail.specVersion} · 世界书 ${
          characterDetail.embeddedBook?.entryCount ?? 0
        }`
      : "角色：默认角色",
    presetDetail
      ? `预设：${presetDetail.name} · prompt ${presetDetail.promptCount} · regex ${presetDetail.regexScriptCount}`
      : "预设：默认 Chat Completion 预设",
  ];

  return (
    <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]">
      <div className="mb-2 flex items-center gap-2 font-medium text-[var(--text-primary)]">
        <FileJson2 size={14} />
        {isAssetLoading ? "正在读取本地资产" : "当前发送资产"}
      </div>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export function GreetingPicker({
  disabled,
  greetings,
  onApply,
}: {
  disabled: boolean;
  greetings: string[];
  onApply: (greetingIndex: number) => void;
}) {
  if (greetings.length === 0) {
    return (
      <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]">
        当前角色没有可用的首条问候。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {greetings.map((greeting, index) => (
        <button
          key={`${index}-${greeting.slice(0, 24)}`}
          className="block w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 text-left text-xs leading-5 transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="button"
          onClick={() => onApply(index)}
        >
          <span className="mb-1 block font-medium text-[var(--text-primary)]">
            {index === 0 ? "first_mes" : `alternate ${index}`}
          </span>
          <span className="line-clamp-2 text-[var(--text-secondary)]">
            {greeting}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ChatArchiveList({
  actionArchiveId,
  archives,
  disabled,
  isLoading,
  loadingArchiveId,
  selectedArchiveId,
  onDelete,
  onLoad,
  onRename,
}: {
  actionArchiveId: string | null;
  archives: ChatArchiveSummary[];
  disabled: boolean;
  isLoading: boolean;
  loadingArchiveId: string | null;
  selectedArchiveId: string | null;
  onDelete: (archive: ChatArchiveSummary) => void;
  onLoad: (archiveId: string) => void;
  onRename: (archive: ChatArchiveSummary) => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]">
        正在读取本地存档...
      </div>
    );
  }

  if (archives.length === 0) {
    return (
      <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]">
        当前筛选下还没有已保存的对话。
      </div>
    );
  }

  return (
    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {archives.map((archive) => {
        const isSelected = archive.id === selectedArchiveId;
        const isLoadingArchive = archive.id === loadingArchiveId;
        const isActingArchive = archive.id === actionArchiveId;
        const isDisabled =
          disabled || Boolean(loadingArchiveId) || Boolean(actionArchiveId);

        return (
          <div
            key={archive.id}
            className={[
              "rounded-lg border p-3 text-xs leading-5",
              isSelected
                ? "border-[var(--accent)] bg-[var(--accent-weak)]"
                : "border-[var(--border-soft)] bg-[var(--surface-muted)]",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--text-primary)]">
                  {archive.name}
                </p>
                <p className="mt-1 text-[var(--text-muted)]">
                  {archive.characterName ?? "未知角色"} · {archive.messageCount} 行
                </p>
              </div>
              <button
                className="shrink-0 rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDisabled}
                type="button"
                onClick={() => onLoad(archive.id)}
              >
                {isLoadingArchive ? "读取中" : isSelected ? "已加载" : "加载"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDisabled}
                type="button"
                onClick={() => onRename(archive)}
              >
                {isActingArchive ? (
                  <Loader2 className="animate-spin" size={12} />
                ) : (
                  <Pencil size={12} />
                )}
                重命名
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDisabled}
                type="button"
                onClick={() => onDelete(archive)}
              >
                {isActingArchive ? (
                  <Loader2 className="animate-spin" size={12} />
                ) : (
                  <Trash2 size={12} />
                )}
                删除
              </button>
            </div>
            {archive.lastMessagePreview ? (
              <p className="mt-2 max-h-10 overflow-hidden text-[var(--text-secondary)]">
                {archive.lastMessagePreview}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function NoticeText({
  kind,
  text,
}: {
  kind: "error" | "muted";
  text: string;
}) {
  return (
    <p
      className={[
        "rounded-lg border px-3 py-2 text-xs leading-6",
        kind === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
      ].join(" ")}
    >
      {text}
    </p>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password";
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-[var(--text-primary)]">{label}</span>
      <input
        className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function SelectField({
  disabled = false,
  label,
  options,
  value,
  onChange,
}: {
  disabled?: boolean;
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-[var(--text-primary)]">{label}</span>
      <select
        className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-[var(--text-primary)]">{label}</span>
      <textarea
        className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[var(--accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
