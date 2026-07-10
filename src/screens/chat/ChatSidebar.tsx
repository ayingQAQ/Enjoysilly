import { Archive, Bot, MessageSquare, UserRound } from "lucide-react";

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

interface ChatSidebarProps {
  archiveActionId: string | null;
  archiveError: string | null;
  archives: ChatArchiveSummary[];
  characterDescription: string;
  characterDetail: CharacterDetailSummary | null;
  characterDetailError: string | null;
  characterName: string;
  characters: CharacterAssetSummary[];
  disabled: boolean;
  embeddedWorldInfoCount?: number;
  greetings: string[];
  isArchiveLoading: boolean;
  isAssetLoading: boolean;
  loadingArchiveId: string | null;
  localCharacterOptionId: string;
  minimalPresetOptionId: string;
  personaDescription: string;
  presetDetail: PresetDetailSummary | null;
  presetDetailError: string | null;
  presets: PresetAssetSummary[];
  selectedArchiveId: string | null;
  selectedCharacterId: string;
  selectedPresetId: string;
  userName: string;
  assetError: string | null;
  onApplyGreeting: (greetingIndex: number) => void;
  onCharacterDescriptionChange: (value: string) => void;
  onCharacterNameChange: (value: string) => void;
  onDeleteArchive: (archive: ChatArchiveSummary) => void;
  onLoadArchive: (archiveId: string) => void;
  onPersonaDescriptionChange: (value: string) => void;
  onRenameArchive: (archive: ChatArchiveSummary) => void;
  onSelectedCharacterIdChange: (value: string) => void;
  onSelectedPresetIdChange: (value: string) => void;
  onUserNameChange: (value: string) => void;
}

export function ChatSidebar(props: ChatSidebarProps) {
  const archiveDisabled = props.disabled;

  return (
    <aside className="flex w-full min-h-0 flex-col gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm">
      <PanelTitle
        icon={<UserRound size={17} />}
        title="本次对话对象"
        subtitle="选择本轮要使用的角色与 ST 原生预设；接口配置请在设置页管理。"
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
      {props.characterDetailError ? (
        <NoticeText kind="error" text={props.characterDetailError} />
      ) : null}
      {props.presetDetailError ? (
        <NoticeText kind="error" text={props.presetDetailError} />
      ) : null}
      <AssetSelectionSummary
        characterDetail={props.characterDetail}
        isAssetLoading={props.isAssetLoading}
        presetDetail={props.presetDetail}
      />
      {props.embeddedWorldInfoCount ? (
        <NoticeText
          kind="muted"
          text={`已启用角色卡内嵌世界书：${props.embeddedWorldInfoCount} 条。`}
        />
      ) : null}

      <div className="border-t border-[var(--border-soft)] pt-4">
        <PanelTitle
          icon={<Archive size={17} />}
          title="本地存档"
          subtitle="对话会自动保存到 chats store；导入导出仍保持 ST JSONL 兼容。"
        />
      </div>
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

      <div className="border-t border-[var(--border-soft)] pt-4">
        <PanelTitle
          icon={<MessageSquare size={17} />}
          title="首条问候"
          subtitle="从角色卡 first_mes 与 alternate_greetings 生成 ST 兼容首条消息。"
        />
      </div>
      <GreetingPicker
        disabled={props.disabled}
        greetings={props.greetings}
        onApply={props.onApplyGreeting}
      />

      <div className="border-t border-[var(--border-soft)] pt-4">
        <PanelTitle
          icon={<Bot size={17} />}
          title="当前身份"
          subtitle="未选择导入角色时，可在这里设置临时角色与用户 persona。"
        />
      </div>
      <Field label="用户名" value={props.userName} onChange={props.onUserNameChange} />
      {props.selectedCharacterId === props.localCharacterOptionId ? (
        <>
          <Field
            label="角色名"
            value={props.characterName}
            onChange={props.onCharacterNameChange}
          />
          <TextAreaField
            label="角色描述"
            value={props.characterDescription}
            onChange={props.onCharacterDescriptionChange}
          />
        </>
      ) : null}
      <TextAreaField
        label="用户 persona"
        value={props.personaDescription}
        onChange={props.onPersonaDescriptionChange}
      />

      <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]">
        选中的预设仅按 ST 原生 Chat Completion 结构参与 prompt 组装；不会执行
        TavernHelper、JS-Slash-Runner 或正则脚本。导入 JSONL 会保存到本地 chats
        store，并替换当前页面消息；普通对话会自动保存。
      </div>
    </aside>
  );
}
