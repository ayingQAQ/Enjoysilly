import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Download, Palette, PlugZap, Save, Settings, Upload, UserRound, Wifi, X } from "lucide-react";

import {
  loadPresetAssetSummaries,
  loadWorldInfoAssetSummaries,
  type PresetAssetSummary,
  type WorldInfoAssetSummary,
} from "../services/assetCatalog";
import {
  testOpenAICompatibleConnection,
  type ConnectionTestResult,
} from "../services/apiConnection";
import { applyAppAppearance } from "../services/appAppearance";
import {
  defaultApiBaseUrl,
  defaultApiModel,
  loadAppSettings,
  loadUserPersonas,
  saveAppSettings,
  saveUserPersonas,
  selectDefaultPersona,
} from "../services/settingsStore";
import { listQuickReplySets, type StoredQuickReplySet } from "../lib/db";
import type { AppFontScale, AppSettings, AppTheme, UserPersona } from "../types/settings";
import { SelectField, SettingsPanel, TextField } from "./settings/SettingsFields";
import {
  createFormState,
  createInitialFormState,
  optionalId,
  type SettingsFormState,
} from "./settings/settingsForm";

export function SettingsScreen() {
  const [form, setForm] = useState<SettingsFormState>(() => createInitialFormState());
  const [presets, setPresets] = useState<PresetAssetSummary[]>([]);
  const [worlds, setWorlds] = useState<WorldInfoAssetSummary[]>([]);
  const [quickReplySets, setQuickReplySets] = useState<StoredQuickReplySet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState("读取设置中");
  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const assetCounts = useMemo(
    () => ({
      presets: presets.length,
      worlds: worlds.length,
      quickReplies: quickReplySets.length,
    }),
    [presets.length, quickReplySets.length, worlds.length],
  );

  const refresh = useCallback(async (shouldApply: () => boolean = () => true) => {
    setIsLoading(true);
    setError(null);

    try {
      const [settings, personas, presetList, worldList, quickReplyList] = await Promise.all([
        loadAppSettings(),
        loadUserPersonas(),
        loadPresetAssetSummaries(),
        loadWorldInfoAssetSummaries(),
        listQuickReplySets(),
      ]);
      const persona = selectDefaultPersona(personas);

      if (!shouldApply()) return;

      setPresets(presetList);
      setWorlds(worldList);
      setQuickReplySets(quickReplyList);
      setForm(createFormState(settings, persona, {
        presetIds: presetList.map((preset) => preset.id),
        worldIds: worldList.map((world) => world.id),
        quickReplySetIds: quickReplyList.map((set) => set.id),
      }));
      setModelOptions([]);
      setStatusText("设置已载入");
    } catch (err: unknown) {
      if (shouldApply()) {
        setError(err instanceof Error ? err.message : String(err));
        setStatusText("读取失败");
      }
    } finally {
      if (shouldApply()) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refresh(() => active);
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    applyAppAppearance({
      fontScale: form.fontScale,
      theme: form.theme,
    });
  }, [form.fontScale, form.theme]);

  const updateField = useCallback(
    <TKey extends keyof SettingsFormState>(key: TKey, value: SettingsFormState[TKey]) => {
      setForm((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await testOpenAICompatibleConnection({
        baseUrl: form.baseUrl,
        apiKey: form.apiKey || undefined,
        model: form.model || undefined,
        signal: controller.signal,
      });

      setTestResult(result);

      if (result.ok && result.models && result.models.length > 0) {
        setModelOptions(result.models);
        setForm((current) => {
          const selectedModel =
            result.selectedModel && result.models?.includes(result.selectedModel)
              ? result.selectedModel
              : result.models?.[0] ?? current.model;

          return {
            ...current,
            baseUrl: result.resolvedBaseUrl ?? current.baseUrl,
            model: selectedModel,
          };
        });
      }
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        diagnostic: "连接测试异常。",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsTesting(false);
    }
  }, [form.baseUrl, form.apiKey, form.model]);

  const handleExportBackup = useCallback(async () => {
    setIsExporting(true);
    setBackupMessage(null);
    try {
      const { createBackupZip } = await import("../services/backupExport");
      const zip = await createBackupZip();
      const blob = new Blob([zip as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my_silly_backup_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMessage("备份已导出。");
    } catch (err: unknown) {
      setBackupMessage(`导出失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleRestoreBackup = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!window.confirm("导入备份会新增资产数据，并按备份内容恢复 settings 同名 key，确定继续吗？")) return;

    setIsRestoring(true);
    setBackupMessage(null);
    try {
      const { restoreFromBackupZip } = await import("../services/backupImport");
      const buffer = await file.arrayBuffer();
      const result = await restoreFromBackupZip(new Uint8Array(buffer));
      setBackupMessage(
        `已恢复：角色 ${result.restored.characters}、世界书 ${result.restored.worlds}、预设 ${result.restored.presets}、对话 ${result.restored.chats}。` +
        (result.errors.length > 0 ? ` ${result.errors.length} 项失败。` : ""),
      );
      await refresh();
      applyAppAppearance(await loadAppSettings());
    } catch (err: unknown) {
      setBackupMessage(`恢复失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRestoring(false);
    }
  }, [refresh]);

  const handleSave = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const nextSettings: AppSettings = {
        api: {
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          model: form.model,
        },
        defaultPresetId: optionalId(form.defaultPresetId),
        defaultWorldId: optionalId(form.defaultWorldId),
        defaultQuickReplySetId: optionalId(form.defaultQuickReplySetId),
        theme: form.theme,
        fontScale: form.fontScale,
      };
      const nextPersona: UserPersona = {
        id: "persona_default",
        name: form.personaName,
        description: form.personaDescription,
        isDefault: true,
      };

      const [savedSettings, savedPersonas] = await Promise.all([
        saveAppSettings(nextSettings),
        saveUserPersonas([nextPersona]),
      ]);
      const savedPersona = selectDefaultPersona(savedPersonas);

      setForm(createFormState(savedSettings, savedPersona));
      applyAppAppearance(savedSettings);
      setStatusText("设置已保存");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatusText("保存失败");
    } finally {
      setIsSaving(false);
    }
  }, [form]);

  return (
    <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent-strong)]">设置</p>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
              管理 API、Persona、默认资产与界面偏好。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              管理 API 连接与测试、User Persona、默认资产、界面偏好以及数据备份恢复。
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--border-strong)] disabled:opacity-60"
            disabled={isLoading}
            type="button"
            onClick={() => void refresh()}
          >
            <Settings size={16} />
            {isLoading ? "读取中..." : "刷新"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[var(--text-secondary)]">
            {statusText}
          </span>
          <span className="text-[var(--text-muted)]">
            预设 {assetCounts.presets} · 世界书 {assetCounts.worlds} · 快捷回复 {assetCounts.quickReplies}
          </span>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={(event) => void handleSave(event)}>
        <div className="space-y-5">
          <SettingsPanel
            icon={<Wifi size={18} />}
            title="API 连接"
            subtitle="测试连接会读取 /models，成功后自动填入可用模型。"
          >
            <TextField
              label="API Base URL"
              value={form.baseUrl}
              placeholder={defaultApiBaseUrl}
              onChange={(value) => updateField("baseUrl", value)}
            />
            <TextField
              label="API Key"
              type="password"
              value={form.apiKey}
              placeholder="仅保存在本地 IndexedDB"
              onChange={(value) => updateField("apiKey", value)}
            />
            {modelOptions.length > 0 ? (
              <SelectField
                label="模型名"
                value={form.model}
                onChange={(value) => updateField("model", value)}
                options={modelOptions.map((modelName) => ({
                  value: modelName,
                  label: modelName,
                }))}
              />
            ) : (
              <TextField
                label="模型名"
                value={form.model}
                placeholder={defaultApiModel}
                onChange={(value) => updateField("model", value)}
              />
            )}
            <div className="flex items-center gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--border-strong)] disabled:opacity-60"
                disabled={isTesting || !form.baseUrl.trim()}
                type="button"
                onClick={() => void handleTestConnection()}
              >
                {isTesting ? "测试中..." : <><PlugZap size={16} /> 测试连接</>}
              </button>
              {isTesting ? (
                <button
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700"
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                >
                  <X size={14} /> 取消
                </button>
              ) : null}
            </div>
            {testResult ? (
              <div className={`rounded-lg border p-3 text-sm leading-6 ${testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                <p className="font-medium">{testResult.diagnostic}</p>
                {testResult.detail ? <p className="mt-1 text-xs opacity-80">{testResult.detail}</p> : null}
                {testResult.ok && testResult.selectedModel ? (
                  <p className="mt-1 text-xs opacity-80">
                    已选择模型：{testResult.selectedModel}
                  </p>
                ) : null}
              </div>
            ) : null}
          </SettingsPanel>

          <SettingsPanel
            icon={<UserRound size={18} />}
            title="User Persona"
            subtitle="作为 {{user}} 来源；用户名和描述会接入 ChatScreen 和 promptBuilder。"
          >
            <TextField
              label="用户名"
              value={form.personaName}
              placeholder="User"
              onChange={(value) => updateField("personaName", value)}
            />
            <label className="block text-sm">
              <span className="font-medium">用户描述</span>
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-3 text-sm outline-none focus:border-[var(--accent)]"
                value={form.personaDescription}
                placeholder="描述用户身份、口吻或偏好"
                onChange={(event) => updateField("personaDescription", event.target.value)}
              />
            </label>
          </SettingsPanel>
        </div>

        <aside className="space-y-5">
          <SettingsPanel
            icon={<Save size={18} />}
            title="默认资产"
            subtitle="保存默认预设、世界书、快捷回复集；聊天页面初始化时会读取这些默认值。"
          >
            <SelectField
              label="默认预设"
              value={form.defaultPresetId}
              onChange={(value) => updateField("defaultPresetId", value)}
              options={presets.map((preset) => ({ value: preset.id, label: preset.name }))}
              emptyLabel="不指定"
            />
            <SelectField
              label="默认世界书"
              value={form.defaultWorldId}
              onChange={(value) => updateField("defaultWorldId", value)}
              options={worlds.map((world) => ({ value: world.id, label: world.name }))}
              emptyLabel="不指定"
            />
            <SelectField
              label="默认快捷回复"
              value={form.defaultQuickReplySetId}
              onChange={(value) => updateField("defaultQuickReplySetId", value)}
              options={quickReplySets.map((set) => ({ value: set.id, label: set.name }))}
              emptyLabel="不指定"
            />
          </SettingsPanel>

          <SettingsPanel
            icon={<Palette size={18} />}
            title="界面偏好"
            subtitle="主题与字号会即时预览，保存后下次启动继续使用。"
          >
            <SelectField
              label="主题"
              value={form.theme}
              onChange={(value) => updateField("theme", value as AppTheme)}
              options={[
                { value: "system", label: "跟随系统" },
                { value: "dark", label: "暗色" },
                { value: "light", label: "亮色" },
              ]}
            />
            <SelectField
              label="字号"
              value={form.fontScale}
              onChange={(value) => updateField("fontScale", value as AppFontScale)}
              options={[
                { value: "sm", label: "紧凑" },
                { value: "md", label: "标准" },
                { value: "lg", label: "宽松" },
              ]}
            />
          </SettingsPanel>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
            disabled={isSaving || isLoading}
            type="submit"
          >
            <Save size={16} />
            {isSaving ? "保存中..." : "保存基础设置"}
          </button>
        </aside>
      </form>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-weak)] text-[var(--accent-strong)]">
            <Download size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold">数据备份与恢复</h2>
            <p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">
              导出全部数据为 zip 文件；恢复时资产会新增，settings 会按备份内容恢复同名 key。
              备份包含本地 settings，若保存了 API Key，请妥善保管备份文件。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--border-strong)] disabled:opacity-60"
            disabled={isExporting}
            type="button"
            onClick={() => void handleExportBackup()}
          >
            <Download size={16} />
            {isExporting ? "导出中..." : "导出备份"}
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--border-strong)]">
            <Upload size={16} />
            {isRestoring ? "恢复中..." : "从备份恢复"}
            <input
              ref={restoreInputRef}
              className="hidden"
              type="file"
              accept=".zip"
              disabled={isRestoring}
              onChange={(event) => void handleRestoreBackup(event)}
            />
          </label>
        </div>
        {backupMessage ? (
          <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${backupMessage.startsWith("恢复失败") || backupMessage.startsWith("导出失败") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {backupMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
