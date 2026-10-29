import { useEffect, useMemo, useState } from "react";
import { BookOpenText, ImageUp, Plus, Save, Trash2, X } from "lucide-react";

import type { CharacterDetailSummary } from "../../services/characterDetails";
import {
  createCharacterEditDraft,
  validateCharacterAvatarPng,
  type CharacterAvatarReplacement,
  validateCharacterEditDraft,
  type CharacterEditDraft,
} from "../../services/characterEdit";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";

export function CharacterEditorDrawer({
  detail,
  onClose,
  onSave,
}: {
  detail: CharacterDetailSummary;
  onClose: () => void;
  onSave: (
    draft: CharacterEditDraft,
    avatarReplacement?: CharacterAvatarReplacement,
  ) => Promise<void>;
}) {
  const initialDraft = useMemo(
    () => createCharacterEditDraft(detail.stored),
    [detail.stored],
  );
  const [draft, setDraft] = useState(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarReplacement, setAvatarReplacement] =
    useState<CharacterAvatarReplacement>();
  const [avatarPreviewFile, setAvatarPreviewFile] = useState<File>();
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const openWorldEditor = useWorkspaceStore((state) => state.openWorldEditor);
  const avatarPreviewUrl = useMemo(
    () => (avatarPreviewFile ? URL.createObjectURL(avatarPreviewFile) : undefined),
    [avatarPreviewFile],
  );
  const errors = validateCharacterEditDraft(draft);
  const isDirty =
    JSON.stringify(draft) !== JSON.stringify(initialDraft) ||
    Boolean(avatarReplacement);

  useEffect(
    () => () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    },
    [avatarPreviewUrl],
  );

  const updateField = <K extends keyof CharacterEditDraft>(
    field: K,
    value: CharacterEditDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaveError(null);
  };

  const requestClose = async () => {
    if (await confirmLeave()) onClose();
  };

  const handleSave = async () => {
    if (errors.name || isSaving) {
      return false;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(draft, avatarReplacement);
      return true;
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const confirmLeave = useUnsavedChanges({ label: "角色卡编辑器", dirty: isDirty, busy: isSaving, save: handleSave });

  const handleOpenEmbeddedBook = () => {
    openWorldEditor(`${detail.id}__character_book`);
  };

  return (
    <aside
      aria-label="编辑角色卡"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl"
    >
      <fieldset disabled={isSaving} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            角色卡编辑器
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold">{detail.name}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            只改写发生变化的可编辑字段；未知字段、extensions、内嵌世界书和未主动替换的
            PNG 载体会原样保留。
          </p>
        </div>
        <button
          aria-label="关闭角色卡编辑器"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] transition hover:border-[var(--border-strong)]"
          type="button"
          onClick={requestClose}
        >
          <X size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <EditorSection
          description="上传新的 PNG 会替换导出角色卡的图片载体，不会读取或执行图片中的文本元数据。"
          title="角色头像"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] text-sm text-[var(--text-muted)]">
              {avatarPreviewUrl ? (
                <img
                  alt="新头像预览"
                  className="size-full object-cover"
                  src={avatarPreviewUrl}
                />
              ) : (
                "保持原图"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium transition hover:border-[var(--border-strong)]">
                <ImageUp size={16} />
                选择 PNG 头像
                <input
                  className="hidden"
                  type="file"
                  accept="image/png,.png"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";

                    if (!file) {
                      return;
                    }

                    void file.arrayBuffer().then(
                      (buffer) => {
                        const bytes = new Uint8Array(buffer);

                        try {
                          validateCharacterAvatarPng(bytes);
                          setAvatarReplacement({ bytes, fileName: file.name });
                          setAvatarPreviewFile(file);
                          setAvatarError(null);
                        } catch (error: unknown) {
                          setAvatarReplacement(undefined);
                          setAvatarPreviewFile(undefined);
                          setAvatarError(
                            error instanceof Error ? error.message : String(error),
                          );
                        }
                      },
                      () => setAvatarError("无法读取所选图片。"),
                    );
                  }}
                />
              </label>
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                仅支持 PNG，最大 15 MB，最长边 8192 像素。
                {avatarReplacement
                  ? ` 已选择：${avatarReplacement.fileName}`
                  : detail.stored.sourceFileName
                    ? ` 当前载体：${detail.stored.sourceFileName}`
                    : " 当前使用默认载体。"}
              </p>
              {avatarError ? (
                <p className="mt-2 text-xs text-red-600">{avatarError}</p>
              ) : null}
              {avatarReplacement ? (
                <button
                  className="mt-2 text-xs font-medium text-[var(--accent-strong)] underline-offset-2 hover:underline"
                  type="button"
                  onClick={() => {
                    setAvatarReplacement(undefined);
                    setAvatarPreviewFile(undefined);
                    setAvatarError(null);
                  }}
                >
                  撤销头像替换
                </button>
              ) : null}
            </div>
          </div>
        </EditorSection>

        <EditorSection
          description="名称与人物设定会直接参与后续对话资产编排。"
          title="基础设定"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              error={errors.name}
              label="角色名称"
              required
              value={draft.name}
              onChange={(value) => updateField("name", value)}
            />
            {detail.spec === "chara_card_v3" ? (
              <TextField
                label="昵称"
                value={draft.nickname}
                onChange={(value) => updateField("nickname", value)}
              />
            ) : null}
          </div>
          <TextAreaField
            label="角色描述 description"
            rows={7}
            value={draft.description}
            onChange={(value) => updateField("description", value)}
          />
          <TextAreaField
            label="性格 personality"
            rows={5}
            value={draft.personality}
            onChange={(value) => updateField("personality", value)}
          />
          <TextAreaField
            label="场景 scenario"
            rows={5}
            value={draft.scenario}
            onChange={(value) => updateField("scenario", value)}
          />
        </EditorSection>

        <EditorSection
          description="首条消息、备用问候和对话示例决定角色如何开始与延续对话。"
          title="对话内容"
        >
          <TextAreaField
            label="首条消息 first_mes"
            rows={7}
            value={draft.firstMessage}
            onChange={(value) => updateField("firstMessage", value)}
          />
          <ListField
            addLabel="添加备用问候"
            label="备用问候 alternate_greetings"
            values={draft.alternateGreetings}
            onChange={(values) => updateField("alternateGreetings", values)}
          />
          {detail.spec === "chara_card_v3" ? (
            <ListField
              addLabel="添加群组问候"
              label="群组专用问候 group_only_greetings"
              values={draft.groupOnlyGreetings}
              onChange={(values) => updateField("groupOnlyGreetings", values)}
            />
          ) : null}
          <TextAreaField
            label="对话示例 mes_example"
            rows={7}
            value={draft.messageExample}
            onChange={(value) => updateField("messageExample", value)}
          />
        </EditorSection>

        <EditorSection
          description="这些字段影响提示词编排与资产来源信息，修改前请确认用途。"
          title="高级字段"
        >
          <TextAreaField
            label="系统提示词 system_prompt"
            rows={6}
            value={draft.systemPrompt}
            onChange={(value) => updateField("systemPrompt", value)}
          />
          <TextAreaField
            label="历史后指令 post_history_instructions"
            rows={6}
            value={draft.postHistoryInstructions}
            onChange={(value) => updateField("postHistoryInstructions", value)}
          />
          <TextAreaField
            label="创作者备注 creator_notes"
            rows={5}
            value={draft.creatorNotes}
            onChange={(value) => updateField("creatorNotes", value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="创作者 creator"
              value={draft.creator}
              onChange={(value) => updateField("creator", value)}
            />
            <TextField
              label="角色版本 character_version"
              value={draft.characterVersion}
              onChange={(value) => updateField("characterVersion", value)}
            />
          </div>
          <TextAreaField
            hint="每行一个标签；保存时会去除空白项和重复项。"
            label="标签 tags"
            rows={4}
            value={draft.tags.join("\n")}
            onChange={(value) => updateField("tags", value.split("\n"))}
          />
        </EditorSection>

        <section className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
          <h3 className="font-semibold text-[var(--text-primary)]">兼容性保护</h3>
          <p className="mt-1">
            当前卡为 {detail.specVersion}；检测到根级未知字段 {detail.rootUnknownFieldNames.length}
            个、数据级未知字段 {detail.dataUnknownFieldNames.length} 个、extensions 字段
            {detail.extensionFieldNames.length} 个。这些内容不会在编辑时被规范化或删除。
          </p>
          {detail.stored.payload.data.character_book ? (
            <button
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]"
              type="button"
              onClick={handleOpenEmbeddedBook}
            >
              <BookOpenText size={16} />
              打开内嵌世界书编辑器
            </button>
          ) : null}
        </section>
      </div>

      <footer className="border-t border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4">
        {saveError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            保存失败：{saveError}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            {isDirty ? "有尚未保存的修改" : "当前内容未修改"}
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
              disabled={!isDirty || Boolean(errors.name) || isSaving}
              type="button"
              onClick={() => void handleSave()}
            >
              <Save size={16} />
              {isSaving ? "保存中…" : "保存角色卡"}
            </button>
          </div>
        </div>
      </footer>
      </fieldset>
    </aside>
  );
}

function EditorSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="mb-5 rounded-lg border border-[var(--border-soft)] p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function TextField({
  error,
  label,
  onChange,
  required = false,
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      <input
        aria-invalid={Boolean(error)}
        className="mt-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 outline-none transition focus:border-[var(--accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function TextAreaField({
  hint,
  label,
  onChange,
  rows,
  value,
}: {
  hint?: string;
  label: string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {hint ? <span className="ml-2 text-xs text-[var(--text-muted)]">{hint}</span> : null}
      <textarea
        className="mt-2 w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 leading-6 outline-none transition focus:border-[var(--accent)]"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ListField({
  addLabel,
  label,
  onChange,
  values,
}: {
  addLabel: string;
  label: string;
  onChange: (values: string[]) => void;
  values: string[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <button
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)]"
          type="button"
          onClick={() => onChange([...values, ""])}
        >
          <Plus size={14} />
          {addLabel}
        </button>
      </div>
      {values.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-4 text-sm text-[var(--text-muted)]">
          暂无内容。
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {values.map((value, index) => (
            <div key={index} className="flex items-start gap-2">
              <textarea
                aria-label={`${label} ${index + 1}`}
                className="min-h-24 flex-1 resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[var(--accent)]"
                value={value}
                onChange={(event) =>
                  onChange(
                    values.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  )
                }
              />
              <button
                aria-label={`删除第 ${index + 1} 条`}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:border-red-300"
                type="button"
                onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
