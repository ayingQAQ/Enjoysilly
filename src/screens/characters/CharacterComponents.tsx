import type { ReactNode } from "react";
import { BookOpen, Bot, X } from "lucide-react";

import type { CharacterAssetSummary } from "../../services/assetCatalog";
import type { CharacterDetailSummary } from "../../services/characterDetails";

export type CharacterSortMode = "updated" | "name" | "worldEntries";

export function CharacterAvatar({ character }: { character: CharacterAssetSummary }) {
  return (
    <div className="grid size-20 place-items-center overflow-hidden rounded-full border border-[var(--border-soft)] bg-[var(--accent-weak)] text-xl font-semibold text-[var(--accent-strong)] shadow-sm sm:size-24">
      {character.avatarUrl ? (
        <img
          alt={`${character.name} 头像`}
          className="size-full object-cover"
          src={character.avatarUrl}
        />
      ) : character.name.trim().length > 0 ? (
        character.name.trim().slice(0, 1)
      ) : (
        <Bot size={28} />
      )}
    </div>
  );
}

export function IconActionButton({
  children,
  danger = false,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={[
        "grid min-h-9 place-items-center rounded-lg border text-[var(--text-primary)] transition disabled:cursor-not-allowed disabled:opacity-50",
        danger
          ? "border-red-200 bg-red-50 text-red-700 hover:border-red-300"
          : "border-[var(--border-soft)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)]",
      ].join(" ")}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

export function CharacterDetailDrawer({
  detail,
  onClose,
}: {
  detail: CharacterDetailSummary;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="角色卡详情"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            只读预览
          </p>
          <h2 className="mt-2 truncate text-xl font-semibold">{detail.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            这里仅展示角色卡 payload 摘要；未知字段、extensions 和内嵌世界书仍保存在原始
            payload 中，不在本页规范化或写回。
          </p>
        </div>
        <button
          aria-label="关闭角色卡详情"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-primary)] transition hover:border-[var(--border-strong)]"
          type="button"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <MiniMetric label="Spec" value={formatSpec(detail.spec, detail.specVersion)} />
          <MiniMetric label="标签" value={detail.tags.length} />
          <MiniMetric label="备用问候" value={detail.alternateGreetingCount} />
          <MiniMetric
            label="内嵌世界书"
            value={detail.embeddedBook?.entryCount ?? 0}
          />
        </div>

        <section className="mt-5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <h3 className="text-sm font-semibold">结构信号</h3>
          <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
            <DetailLine label="头像字段" value={detail.hasAvatar ? "存在" : "未设"} />
            <DetailLine label="creator" value={detail.creator ?? "未设"} />
            <DetailLine
              label="character_version"
              value={detail.characterVersion ?? "未设"}
            />
            <DetailLine
              label="group_only_greetings"
              value={detail.groupOnlyGreetingCount}
            />
            <DetailLine
              label="extensions 字段"
              value={formatFieldNames(detail.extensionFieldNames)}
            />
            <DetailLine
              label="保留字段信号"
              value={formatPreservedFields(detail)}
            />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">文本预览</h3>
          <div className="mt-3 space-y-3">
            <TextPreviewCard label="description" value={detail.textPreviews.description} />
            <TextPreviewCard label="personality" value={detail.textPreviews.personality} />
            <TextPreviewCard label="scenario" value={detail.textPreviews.scenario} />
            <TextPreviewCard label="first_mes" value={detail.textPreviews.firstMessage} />
            <TextPreviewCard label="system_prompt" value={detail.textPreviews.systemPrompt} />
            <TextPreviewCard
              label="post_history_instructions"
              value={detail.textPreviews.postHistoryInstructions}
            />
            <TextPreviewCard
              label="mes_example"
              value={detail.textPreviews.messageExample}
            />
            <TextPreviewCard
              label="creator_notes"
              value={detail.textPreviews.creatorNotes}
            />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">内嵌世界书</h3>
          {detail.embeddedBook ? (
            <EmbeddedBookPreview book={detail.embeddedBook} />
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-[var(--border-strong)] p-4 text-sm text-[var(--text-muted)]">
              这个角色卡没有内嵌 character_book。
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-muted)] px-2 py-2 text-center">
      <p className="truncate text-base font-semibold">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function TextPreviewCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-[var(--border-soft)] p-3">
      <h4 className="font-mono text-xs text-[var(--text-muted)]">{label}</h4>
      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
        {value || "未设"}
      </p>
    </article>
  );
}

function EmbeddedBookPreview({
  book,
}: {
  book: NonNullable<CharacterDetailSummary["embeddedBook"]>;
}) {
  return (
    <article className="mt-3 rounded-lg border border-[var(--border-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{book.name}</h4>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            启用 {book.enabledEntryCount}/{book.entryCount} · 常驻{" "}
            {book.constantEntryCount} · selective {book.selectiveEntryCount}
          </p>
        </div>
        <div className="grid size-10 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
          <BookOpen size={18} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {book.sampleKeys.length > 0 ? (
          book.sampleKeys.map((key, index) => (
            <span
              key={`${key}-${index}`}
              className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
            >
              {key}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
            无关键词样本
          </span>
        )}
      </div>

      {book.sampleComments.length > 0 ? (
        <p className="mt-4 text-xs leading-6 text-[var(--text-muted)]">
          条目标题：{book.sampleComments.join(" · ")}
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
        保留条目字段：
        {book.entryUnknownFieldNames.length > 0
          ? book.entryUnknownFieldNames.join("、")
          : "无"}
      </p>
    </article>
  );
}

export function DetailLine({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface)] px-3 py-2">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="break-all text-right font-medium text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

export function formatSpec(spec: CharacterAssetSummary["spec"], specVersion: string): string {
  return spec === "chara_card_v3" ? `V3 · ${specVersion}` : `V2 · ${specVersion}`;
}

function formatFieldNames(values: string[]): string {
  return values.length > 0 ? values.join(" / ") : "无";
}

function formatPreservedFields(detail: CharacterDetailSummary): string {
  const parts = [
    detail.rootUnknownFieldNames.length > 0
      ? `root:${detail.rootUnknownFieldNames.join("/")}`
      : "",
    detail.dataUnknownFieldNames.length > 0
      ? `data:${detail.dataUnknownFieldNames.join("/")}`
      : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "无";
}

export function getFilteredCharacters(
  characters: CharacterAssetSummary[],
  options: {
    query: string;
    showWorldLinkedOnly: boolean;
    sortMode: CharacterSortMode;
  },
): CharacterAssetSummary[] {
  const query = options.query.trim().toLocaleLowerCase("zh-CN");
  const filtered = characters.filter((character) => {
    if (options.showWorldLinkedOnly && character.worldEntryCount === 0) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      character.name,
      character.description,
      character.specVersion,
      ...character.tags,
    ]
      .join("\n")
      .toLocaleLowerCase("zh-CN");

    return haystack.includes(query);
  });

  return filtered.sort((a, b) => {
    if (options.sortMode === "name") {
      return a.name.localeCompare(b.name, "zh-CN");
    }

    if (options.sortMode === "worldEntries") {
      return (
        b.worldEntryCount - a.worldEntryCount ||
        a.name.localeCompare(b.name, "zh-CN")
      );
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function getUniqueTagCount(characters: CharacterAssetSummary[]): number {
  return new Set(characters.flatMap((character) => character.tags)).size;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
