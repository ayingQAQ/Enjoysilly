import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpenText,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import type { WorldInfoDetailSummary } from "../../services/worldInfoDetails";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import {
  createNewWorldInfoEntryDraft,
  createWorldInfoEditDraft,
  validateWorldInfoEditDraft,
  type WorldInfoEditDraft,
  type WorldInfoEntryDraft,
} from "../../services/worldInfoEdit";

export function WorldInfoEditorDrawer({
  detail,
  onClose,
  onSave,
}: {
  detail: WorldInfoDetailSummary;
  onClose: () => void;
  onSave: (draft: WorldInfoEditDraft) => Promise<void>;
}) {
  const initialDraft = useMemo(
    () => createWorldInfoEditDraft(detail.stored),
    [detail.stored],
  );
  const [draft, setDraft] = useState(initialDraft);
  const [selectedDraftId, setSelectedDraftId] = useState(
    initialDraft.entries[0]?.draftId ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const errors = validateWorldInfoEditDraft(draft);
  const selectedIndex = draft.entries.findIndex(
    (entry) => entry.draftId === selectedDraftId,
  );
  const selectedEntry = draft.entries[selectedIndex];
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const errorCount = Object.keys(errors.entries).length + (errors.name ? 1 : 0);

  const requestClose = async () => {
    if (await confirmLeave()) onClose();
  };

  const updateSelectedEntry = <K extends keyof WorldInfoEntryDraft>(
    field: K,
    value: WorldInfoEntryDraft[K],
  ) => {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.draftId === selectedDraftId
          ? { ...entry, [field]: value }
          : entry,
      ),
    }));
    setSaveError(null);
  };

  const addEntry = () => {
    const entry = createNewWorldInfoEntryDraft(draft.dialect);

    setDraft((current) => ({
      ...current,
      entries: [...current.entries, entry],
    }));
    setSelectedDraftId(entry.draftId);
    setSaveError(null);
  };

  const deleteSelectedEntry = () => {
    if (!selectedEntry) return;

    if (
      !selectedEntry.isNew &&
      !window.confirm(`确定删除条目“${getEntryTitle(selectedEntry, selectedIndex)}”吗？`)
    ) {
      return;
    }

    const nextEntries = draft.entries.filter(
      (entry) => entry.draftId !== selectedEntry.draftId,
    );
    setDraft((current) => ({ ...current, entries: nextEntries }));
    setSelectedDraftId(
      nextEntries[Math.min(selectedIndex, nextEntries.length - 1)]?.draftId ?? "",
    );
  };

  const moveSelectedEntry = (offset: -1 | 1) => {
    const targetIndex = selectedIndex + offset;

    if (selectedIndex < 0 || targetIndex < 0 || targetIndex >= draft.entries.length) {
      return;
    }

    setDraft((current) => {
      const entries = [...current.entries];
      [entries[selectedIndex], entries[targetIndex]] = [
        entries[targetIndex],
        entries[selectedIndex],
      ];
      return { ...current, entries };
    });
  };

  const handleSave = async () => {
    if (errorCount > 0 || isSaving) return false;

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(draft);
      return true;
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const confirmLeave = useUnsavedChanges({ label: "世界书编辑器", dirty: isDirty, busy: isSaving, save: handleSave });

  return (
    <aside
      aria-label="编辑世界书"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-6xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl"
    >
      <fieldset disabled={isSaving} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              世界书编辑器
            </p>
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
              {draft.dialect === "native" ? "ST 原生方言" : "角色卡内嵌方言"}
            </span>
          </div>
          <h2 className="mt-1 truncate text-xl font-semibold">{detail.name}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            编辑器按原方言差异写回；未修改字段、未知字段与 extensions 不会被重建。
          </p>
        </div>
        <button
          aria-label="关闭世界书编辑器"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] transition hover:border-[var(--border-strong)]"
          type="button"
          onClick={requestClose}
        >
          <X size={16} />
        </button>
      </header>

      <div className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)] px-5 py-3">
        <label className="block max-w-xl text-sm">
          <span className="font-medium">世界书名称</span>
          <input
            aria-invalid={Boolean(errors.name)}
            className="mt-1.5 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 outline-none transition focus:border-[var(--accent)]"
            value={draft.name}
            onChange={(event) => {
              setDraft((current) => ({ ...current, name: event.target.value }));
              setSaveError(null);
            }}
          />
          {errors.name ? (
            <span className="mt-1 block text-xs text-red-600">{errors.name}</span>
          ) : null}
        </label>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[270px_minmax(0,1fr)]">
        <nav className="min-h-0 overflow-y-auto border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 px-1 pb-3">
            <div>
              <p className="text-sm font-semibold">条目目录</p>
              <p className="text-xs text-[var(--text-muted)]">{draft.entries.length} 条</p>
            </div>
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-2 text-xs font-medium text-white transition hover:bg-[var(--accent-strong)]"
              type="button"
              onClick={addEntry}
            >
              <Plus size={14} />
              新增
            </button>
          </div>

          <div className="space-y-1.5">
            {draft.entries.map((entry, index) => {
              const selected = entry.draftId === selectedDraftId;
              const entryErrors = errors.entries[entry.draftId];

              return (
                <button
                  key={entry.draftId}
                  className={[
                    "w-full rounded-lg border px-3 py-2.5 text-left transition",
                    selected
                      ? "border-[var(--accent)] bg-[var(--surface)] shadow-sm"
                      : "border-transparent hover:border-[var(--border-soft)] hover:bg-[var(--surface)]",
                  ].join(" ")}
                  type="button"
                  onClick={() => setSelectedDraftId(entry.draftId)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {getEntryTitle(entry, index)}
                    </span>
                    <span
                      className={[
                        "size-2 shrink-0 rounded-full",
                        entryErrors
                          ? "bg-red-500"
                          : entry.enabled
                            ? "bg-emerald-500"
                            : "bg-[var(--text-muted)]",
                      ].join(" ")}
                    />
                  </span>
                  <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">
                    {entry.keys.join(" · ") || (entry.constant ? "常驻条目" : "无关键词")}
                  </span>
                </button>
              );
            })}
          </div>

          {draft.entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-4 text-center">
              <BookOpenText className="mx-auto text-[var(--text-muted)]" size={22} />
              <p className="mt-2 text-sm text-[var(--text-muted)]">世界书暂时为空</p>
              <button
                className="mt-3 text-sm font-medium text-[var(--accent-strong)]"
                type="button"
                onClick={addEntry}
              >
                创建第一条
              </button>
            </div>
          ) : null}
        </nav>

        <div
          aria-label="世界书条目编辑区"
          className="min-h-0 overflow-y-auto p-4 sm:p-5"
        >
          {selectedEntry ? (
            <div className="mx-auto max-w-4xl">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">
                    条目 {selectedIndex + 1} / {draft.entries.length}
                  </p>
                  <h3 className="mt-0.5 font-semibold">
                    {getEntryTitle(selectedEntry, selectedIndex)}
                  </h3>
                </div>
                <div className="flex gap-1.5">
                  <IconButton
                    disabled={selectedIndex <= 0}
                    label="上移条目"
                    onClick={() => moveSelectedEntry(-1)}
                  >
                    <ArrowUp size={15} />
                  </IconButton>
                  <IconButton
                    disabled={selectedIndex >= draft.entries.length - 1}
                    label="下移条目"
                    onClick={() => moveSelectedEntry(1)}
                  >
                    <ArrowDown size={15} />
                  </IconButton>
                  <IconButton danger label="删除条目" onClick={deleteSelectedEntry}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>

              <EditorSection title="内容与触发词">
                <TextField
                  label="条目标题 comment"
                  value={selectedEntry.comment}
                  onChange={(value) => updateSelectedEntry("comment", value)}
                />
                <TextAreaField
                  label="注入内容 content"
                  rows={9}
                  value={selectedEntry.content}
                  onChange={(value) => updateSelectedEntry("content", value)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <KeywordField
                    label="主关键词 key / keys"
                    values={selectedEntry.keys}
                    onChange={(value) => updateSelectedEntry("keys", value)}
                  />
                  <KeywordField
                    label="次要关键词 keysecondary"
                    values={selectedEntry.secondaryKeys}
                    onChange={(value) => updateSelectedEntry("secondaryKeys", value)}
                  />
                </div>
              </EditorSection>

              <EditorSection title="启用与匹配">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <ToggleField
                    checked={selectedEntry.enabled}
                    label="启用"
                    onChange={(value) => updateSelectedEntry("enabled", value)}
                  />
                  <ToggleField
                    checked={selectedEntry.constant}
                    label="常驻 constant"
                    onChange={(value) => updateSelectedEntry("constant", value)}
                  />
                  <ToggleField
                    checked={selectedEntry.selective}
                    label="selective"
                    onChange={(value) => updateSelectedEntry("selective", value)}
                  />
                  <ToggleField
                    checked={selectedEntry.vectorized}
                    label="vectorized"
                    onChange={(value) => updateSelectedEntry("vectorized", value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <NumberField
                    label="插入顺序 order"
                    value={selectedEntry.order}
                    onChange={(value) => updateSelectedEntry("order", value)}
                  />
                  <SelectField
                    label="注入位置 position"
                    value={selectedEntry.position === null ? "" : String(selectedEntry.position)}
                    options={positionOptions}
                    onChange={(value) =>
                      updateSelectedEntry("position", value === "" ? null : Number(value))
                    }
                  />
                  <NullableBooleanField
                    label="大小写敏感"
                    value={selectedEntry.caseSensitive}
                    onChange={(value) => updateSelectedEntry("caseSensitive", value)}
                  />
                  <NullableBooleanField
                    label="完整词匹配"
                    value={selectedEntry.matchWholeWords}
                    onChange={(value) => updateSelectedEntry("matchWholeWords", value)}
                  />
                  <SelectField
                    label="selective 逻辑"
                    value={
                      selectedEntry.selectiveLogic === null
                        ? ""
                        : String(selectedEntry.selectiveLogic)
                    }
                    options={selectiveLogicOptions}
                    onChange={(value) =>
                      updateSelectedEntry(
                        "selectiveLogic",
                        value === "" ? null : Number(value),
                      )
                    }
                  />
                  <NumberField
                    error={errors.entries[selectedEntry.draftId]?.probability}
                    label="触发概率 0–100"
                    max={100}
                    min={0}
                    value={selectedEntry.probability}
                    onChange={(value) => updateSelectedEntry("probability", value)}
                  />
                  <ToggleField
                    checked={selectedEntry.useProbability}
                    label="启用概率门控"
                    onChange={(value) => updateSelectedEntry("useProbability", value)}
                  />
                  <NumberField
                    label="at-depth 深度"
                    min={0}
                    value={selectedEntry.depth}
                    onChange={(value) => updateSelectedEntry("depth", value)}
                  />
                </div>
              </EditorSection>

              <details className="group rounded-lg border border-[var(--border-soft)]">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    递归、分组与时效设置
                    <span className="text-xs font-normal text-[var(--text-muted)] group-open:hidden">
                      展开高级字段
                    </span>
                  </span>
                </summary>
                <div className="space-y-5 border-t border-[var(--border-soft)] p-4">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <ToggleField
                      checked={selectedEntry.excludeRecursion}
                      label="不参与递归触发"
                      onChange={(value) => updateSelectedEntry("excludeRecursion", value)}
                    />
                    <ToggleField
                      checked={selectedEntry.preventRecursion}
                      label="激活后阻止递归"
                      onChange={(value) => updateSelectedEntry("preventRecursion", value)}
                    />
                    <ToggleField
                      checked={selectedEntry.delayUntilRecursion}
                      label="仅递归轮激活"
                      onChange={(value) =>
                        updateSelectedEntry("delayUntilRecursion", value)
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <TextField
                      label="分组 group"
                      value={selectedEntry.group}
                      onChange={(value) => updateSelectedEntry("group", value)}
                    />
                    <NumberField
                      label="分组权重"
                      value={selectedEntry.groupWeight}
                      onChange={(value) => updateSelectedEntry("groupWeight", value)}
                    />
                    <ToggleField
                      checked={selectedEntry.groupOverride}
                      label="覆盖同组"
                      onChange={(value) => updateSelectedEntry("groupOverride", value)}
                    />
                    <NullableBooleanField
                      label="使用分组评分"
                      value={selectedEntry.useGroupScoring}
                      onChange={(value) => updateSelectedEntry("useGroupScoring", value)}
                    />
                    <NumberField
                      label="扫描深度"
                      min={0}
                      value={selectedEntry.scanDepth}
                      onChange={(value) => updateSelectedEntry("scanDepth", value)}
                    />
                    <NumberField
                      label="sticky"
                      min={0}
                      value={selectedEntry.sticky}
                      onChange={(value) => updateSelectedEntry("sticky", value)}
                    />
                    <NumberField
                      label="cooldown"
                      min={0}
                      value={selectedEntry.cooldown}
                      onChange={(value) => updateSelectedEntry("cooldown", value)}
                    />
                    <NumberField
                      label="delay"
                      min={0}
                      value={selectedEntry.delay}
                      onChange={(value) => updateSelectedEntry("delay", value)}
                    />
                    <NumberField
                      label="角色 role"
                      value={selectedEntry.role}
                      onChange={(value) => updateSelectedEntry("role", value)}
                    />
                    <TextField
                      label="自动化 ID"
                      value={selectedEntry.automationId}
                      onChange={(value) => updateSelectedEntry("automationId", value)}
                    />
                  </div>
                </div>
              </details>

              <p className="mt-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
                当前条目来源：{selectedEntry.sourceKey ?? "新建"}。portable 方言没有顶层等价的高级字段会写入
                extensions；其他未知扩展保持原样。
              </p>
            </div>
          ) : (
            <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] text-center">
              <div>
                <BookOpenText className="mx-auto text-[var(--text-muted)]" size={30} />
                <p className="mt-3 text-sm text-[var(--text-secondary)]">选择或新建一个条目开始编辑</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4">
        {saveError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            保存失败：{saveError}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            {errorCount > 0
              ? `有 ${errorCount} 处需要修正`
              : isDirty
                ? "有尚未保存的修改"
                : "当前内容未修改"}
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-[var(--border-soft)] px-4 py-2 text-sm font-medium transition hover:border-[var(--border-strong)]"
              type="button"
              onClick={requestClose}
            >
              取消
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isDirty || errorCount > 0 || isSaving}
              type="button"
              onClick={() => void handleSave()}
            >
              <Save size={16} />
              {isSaving ? "保存中…" : "保存世界书"}
            </button>
          </div>
        </div>
      </footer>
      </fieldset>
    </aside>
  );
}

const positionOptions = [
  { value: "", label: "继承 / 未设" },
  { value: "0", label: "before · 角色定义前" },
  { value: "1", label: "after · 角色定义后" },
  { value: "2", label: "ANTop" },
  { value: "3", label: "ANBottom" },
  { value: "4", label: "at-depth" },
  { value: "5", label: "EMTop" },
  { value: "6", label: "EMBottom" },
  { value: "7", label: "outlet" },
];

const selectiveLogicOptions = [
  { value: "", label: "未设" },
  { value: "0", label: "AND_ANY" },
  { value: "1", label: "NOT_ALL" },
  { value: "2", label: "NOT_ANY" },
  { value: "3", label: "AND_ALL" },
];

function EditorSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="mb-4 rounded-lg border border-[var(--border-soft)] p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="mt-1.5 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 outline-none transition focus:border-[var(--accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  error,
  label,
  onChange,
  rows,
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        aria-invalid={Boolean(error)}
        className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 leading-6 outline-none transition focus:border-[var(--accent)]"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function KeywordField({
  label,
  onChange,
  values,
}: {
  label: string;
  onChange: (value: string[]) => void;
  values: string[];
}) {
  return (
    <TextAreaField
      label={label}
      rows={4}
      value={values.join("\n")}
      onChange={(value) => onChange(value.split("\n"))}
    />
  );
}

function NumberField({
  error,
  label,
  max,
  min,
  onChange,
  value,
}: {
  error?: string;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number | null) => void;
  value: number | null;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        aria-invalid={Boolean(error)}
        className="mt-1.5 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 outline-none transition focus:border-[var(--accent)]"
        max={max}
        min={min}
        type="number"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <select
        className="mt-1.5 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 outline-none transition focus:border-[var(--accent)]"
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

function NullableBooleanField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: boolean | null) => void;
  value: boolean | null;
}) {
  return (
    <SelectField
      label={label}
      options={[
        { value: "", label: "继承 / 未设" },
        { value: "true", label: "是" },
        { value: "false", label: "否" },
      ]}
      value={value === null ? "" : String(value)}
      onChange={(next) =>
        onChange(next === "" ? null : next === "true")
      }
    />
  );
}

function ToggleField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm">
      <input
        checked={checked}
        className="size-4 accent-[var(--accent)]"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function IconButton({
  children,
  danger = false,
  disabled = false,
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
        "grid size-9 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40",
        danger
          ? "border-red-200 bg-red-50 text-red-700 hover:border-red-300"
          : "border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)]",
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

function getEntryTitle(entry: WorldInfoEntryDraft, index: number): string {
  return (
    entry.comment.trim() ||
    entry.keys.find((key) => key.trim())?.trim() ||
    `条目 ${index + 1}`
  );
}
