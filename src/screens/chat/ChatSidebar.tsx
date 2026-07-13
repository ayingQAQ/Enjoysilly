import { useState, type ChangeEvent, type ReactNode, type RefObject } from "react";
import {
  Archive,
  Bot,
  Download,
  Loader2,
  MessageSquare,
  PanelRightClose,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Upload,
  UserRound,
} from "lucide-react";

import type { CharacterAssetSummary, PresetAssetSummary } from "../../services/assetCatalog";
import type { ChatArchiveSummary } from "../../services/chatArchive";
import type { CharacterDetailSummary } from "../../services/characterDetails";
import type { PresetDetailSummary } from "../../services/presetDetails";
import {
  AssetSelectionSummary,
  ChatArchiveList,
  Field,
  GreetingPicker,
  NoticeText,
  PanelTitle,
  SelectField,
  TextAreaField,
} from "../ChatScreenPanels";

type ContextTab = "setup" | "archives" | "greetings";

interface ChatSidebarProps {
  activeCharacterName: string;
  archiveActionId: string | null;
  archiveError: string | null;
  archives: ChatArchiveSummary[];
  characterDescription: string;
  characterDetail: CharacterDetailSummary | null;
  characterDetailError: string | null;
  characterName: string;
  characters: CharacterAssetSummary[];
  canContinue: boolean;
  canExport: boolean;
  canImport: boolean;
  canSave: boolean;
  chatImportInputRef: RefObject<HTMLInputElement>;
  disabled: boolean;
  embeddedWorldInfoCount?: number;
  greetings: string[];
  isArchiveLoading: boolean;
  isAssetLoading: boolean;
  isImporting: boolean;
  isSaving: boolean;
  loadingArchiveId: string | null;
  localCharacterOptionId: string;
  loadedArchiveName: string | null;
  minimalPresetOptionId: string;
  model: string;
  personaDescription: string;
  presetDetail: PresetDetailSummary | null;
  presetDetailError: string | null;
  presets: PresetAssetSummary[];
  selectedArchiveId: string | null;
  selectedCharacterId: string;
  selectedPresetId: string;
  tokenCount: number;
  userName: string;
  assetError: string | null;
  onApplyGreeting: (greetingIndex: number) => void;
  onCharacterDescriptionChange: (value: string) => void;
  onCharacterNameChange: (value: string) => void;
  onChatImportChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onContinue: () => void;
  onDeleteArchive: (archive: ChatArchiveSummary) => void;
  onExport: () => void;
  onLoadArchive: (archiveId: string) => void;
  onNewChat: () => void;
  onPersonaDescriptionChange: (value: string) => void;
  onPickChatImport: () => void;
  onRenameArchive: (archive: ChatArchiveSummary) => void;
  onSelectedCharacterIdChange: (value: string) => void;
  onSelectedPresetIdChange: (value: string) => void;
  onSave: () => void;
  onUserNameChange: (value: string) => void;
}

const contextTabs: Array<{ id: ContextTab; label: string }> = [
  { id: "setup", label: "会话设定" },
  { id: "archives", label: "存档" },
  { id: "greetings", label: "问候" },
];

export function ChatSidebar(props: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<ContextTab>("setup");
  const archiveDisabled = props.disabled;

  return (
    <aside className="flex min-h-[420px] min-w-0 flex-col rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 shadow-sm xl:h-full xl:min-h-0">
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 text-[var(--accent-strong)]">
            <SlidersHorizontal size={17} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">对话上下文</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              角色、预设和存档都在这里按需调整。
            </p>
          </div>
        </div>
        <button
          aria-label="收起对话上下文"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          type="button"
          onClick={props.onClose}
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      <div aria-label="对话上下文标签" className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--surface-muted)] p-1" role="tablist">
        {contextTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              aria-selected={isActive}
              className={[
                "rounded-md px-2 py-2 text-xs font-medium transition",
                isActive
                  ? "bg-[var(--surface)] text-[var(--accent-strong)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              ].join(" ")}
              role="tab"
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pt-3 xl:pr-2">
        <details className="mb-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[var(--text-primary)]">
            <span className="inline-flex items-center gap-2"><MessageSquare size={15} />会话信息</span>
          </summary>
          <div className="mt-3 space-y-1 border-t border-[var(--border-soft)] pt-3 text-xs leading-6 text-[var(--text-secondary)]">
            <p>{props.activeCharacterName} · {props.userName} · 约 {props.tokenCount} token</p>
            <p>模型：{props.model.trim() || "未设置"}</p>
            {props.loadedArchiveName ? <p>已加载：{props.loadedArchiveName}</p> : null}
          </div>
        </details>
        <details className="mb-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <MessageSquare size={15} />
            对话操作
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border-soft)] pt-3">
            <input
              ref={props.chatImportInputRef}
              accept=".jsonl,application/json,text/plain"
              className="hidden"
              type="file"
              onChange={props.onChatImportChange}
            />
            <ChatActionButton
              disabled={!props.canImport}
              icon={props.isImporting ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}
              label="导入"
              onClick={props.onPickChatImport}
            />
            <ChatActionButton disabled={!props.canExport} icon={<Download size={15} />} label="导出" onClick={props.onExport} />
            <ChatActionButton disabled={!props.canContinue} icon={<RotateCcw size={15} />} label="继续" onClick={props.onContinue} />
            <ChatActionButton
              disabled={!props.canSave}
              icon={props.isSaving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
              label="保存"
              onClick={props.onSave}
            />
            <ChatActionButton disabled={props.disabled} icon={<Plus size={15} />} label="新建" onClick={props.onNewChat} />
          </div>
        </details>
        {activeTab === "setup" ? (
          <div className="space-y-4" role="tabpanel">
            <PanelTitle
              icon={<Bot size={17} />}
              title="本次对话对象"
              subtitle="选择本轮使用的角色与 ST 原生预设。"
            />
            <SelectField
              disabled={props.disabled || props.isAssetLoading}
              label="角色"
              options={[
                { label: "默认角色", value: props.localCharacterOptionId },
                ...props.characters.map((character) => ({
                  label: character.name,
                  value: character.id,
                })),
              ]}
              value={props.selectedCharacterId}
              onChange={props.onSelectedCharacterIdChange}
            />
            <SelectField
              disabled={props.disabled || props.isAssetLoading}
              label="预设"
              options={[
                { label: "默认 Chat Completion 预设", value: props.minimalPresetOptionId },
                ...props.presets.map((preset) => ({ label: preset.name, value: preset.id })),
              ]}
              value={props.selectedPresetId}
              onChange={props.onSelectedPresetIdChange}
            />
            {props.assetError ? <NoticeText kind="error" text={props.assetError} /> : null}
            {props.characterDetailError ? <NoticeText kind="error" text={props.characterDetailError} /> : null}
            {props.presetDetailError ? <NoticeText kind="error" text={props.presetDetailError} /> : null}
            <AssetSelectionSummary
              characterDetail={props.characterDetail}
              isAssetLoading={props.isAssetLoading}
              presetDetail={props.presetDetail}
            />
            {props.embeddedWorldInfoCount ? (
              <NoticeText kind="muted" text={`已启用角色卡内嵌世界书：${props.embeddedWorldInfoCount} 条。`} />
            ) : null}

            <details className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-[var(--text-primary)]">
                <span className="inline-flex items-center gap-2"><UserRound size={15} />当前身份</span>
              </summary>
              <div className="mt-4 space-y-4 border-t border-[var(--border-soft)] pt-4">
                <Field label="用户名" value={props.userName} onChange={props.onUserNameChange} />
                {props.selectedCharacterId === props.localCharacterOptionId ? (
                  <>
                    <Field label="角色名" value={props.characterName} onChange={props.onCharacterNameChange} />
                    <TextAreaField label="角色描述" value={props.characterDescription} onChange={props.onCharacterDescriptionChange} />
                  </>
                ) : null}
                <TextAreaField label="用户 persona" value={props.personaDescription} onChange={props.onPersonaDescriptionChange} />
              </div>
            </details>
          </div>
        ) : null}

        {activeTab === "archives" ? (
          <div className="space-y-4" role="tabpanel">
            <PanelTitle
              icon={<Archive size={17} />}
              title="本地存档"
              subtitle="管理已保存的对话，并可导入和导出 ST JSONL。"
            />
            {props.archiveError ? <NoticeText kind="error" text={props.archiveError} /> : null}
            <ChatArchiveList
              archives={props.archives}
              isLoading={props.isArchiveLoading}
              actionArchiveId={props.archiveActionId}
              loadingArchiveId={props.loadingArchiveId}
              selectedArchiveId={props.selectedArchiveId}
              onLoad={props.onLoadArchive}
              onRename={props.onRenameArchive}
              onDelete={props.onDeleteArchive}
              disabled={archiveDisabled}
            />
          </div>
        ) : null}

        {activeTab === "greetings" ? (
          <div className="space-y-4" role="tabpanel">
            <PanelTitle
              icon={<MessageSquare size={17} />}
              title="首条问候"
              subtitle="从 first_mes 与 alternate_greetings 选择开场。"
            />
            <GreetingPicker
              disabled={props.disabled}
              greetings={props.greetings}
              onApply={props.onApplyGreeting}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

interface ChatActionButtonProps {
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

function ChatActionButton({ disabled, icon, label, onClick }: ChatActionButtonProps) {
  return (
    <button
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
