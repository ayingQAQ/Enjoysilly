import type { PreserveUnknownFields } from "./common";

/**
 * 会话绑定快照 —— 保存聊天时记录当时使用的完整上下文。
 * 写入 chat_metadata，使旧聊天在资产变更后仍知道当时用的是什么配置。
 */
export interface ChatBindingSnapshot extends PreserveUnknownFields {
  /** 当时使用的预设 ID */
  presetId?: string;
  /** 当时激活的世界书 ID 列表 */
  worldIds: string[];
  /** 当时使用的正则脚本来源：预设正则 + 角色卡内嵌正则 + 自有正则的 ID 列表 */
  regexSourceIds: string[];
  /** 当时可见的快速回复集 ID 列表 */
  quickReplySetIds: string[];
  /** 当时使用的 persona ID */
  personaId?: string;
}

/**
 * 本地工作区配置 —— 将散落在 settings 里的 defaultPresetId / defaultWorldId 等
 * 聚合为一个可命名、可切换的"工作区配置"。
 */
export interface LocalProfile extends PreserveUnknownFields {
  id: string;
  name: string;
  characterId?: string;
  groupId?: string;
  presetId?: string;
  worldIds: string[];
  regexScriptIds: string[];
  quickReplySetIds: string[];
  personaId?: string;
}

/**
 * chat_metadata 中与 ChatBindingSnapshot 对应的已知 key。
 * 为了避免与 ST 原生 chat_metadata 字段冲突，统一使用命名空间前缀。
 */
export const CHAT_BINDING_KEYS = {
  presetId: "presetId",
  worldIds: "worldIds",
  quickReplySetIds: "quickReplySetIds",
  personaId: "personaId",
  /** 非 ST 原生字段，my_silly 扩展 */
  regexSourceIds: "_ms_regexSourceIds",
  /** my_silly binding snapshot 版本号，用于未来迁移 */
  bindingVersion: "_ms_bindingVersion",
} as const;

export const CURRENT_BINDING_VERSION = 1;

/**
 * 从 chat_metadata 的 UnknownRecord 中提取 ChatBindingSnapshot。
 * 容忍缺失字段，不抛异常。
 */
export function extractChatBindingFromMetadata(
  metadata: Record<string, unknown> | undefined,
): ChatBindingSnapshot {
  if (!metadata) {
    return { worldIds: [], regexSourceIds: [], quickReplySetIds: [] };
  }

  return {
    presetId: readOptionalString(metadata[CHAT_BINDING_KEYS.presetId]),
    worldIds: readStringArray(metadata[CHAT_BINDING_KEYS.worldIds]),
    regexSourceIds: readStringArray(metadata[CHAT_BINDING_KEYS.regexSourceIds]),
    quickReplySetIds: readStringArray(
      metadata[CHAT_BINDING_KEYS.quickReplySetIds],
    ),
    personaId: readOptionalString(metadata[CHAT_BINDING_KEYS.personaId]),
  };
}

/**
 * 将 ChatBindingSnapshot 序列化为 chat_metadata 兼容的 UnknownRecord。
 */
export function serializeChatBindingToMetadata(
  binding: ChatBindingSnapshot,
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    [CHAT_BINDING_KEYS.bindingVersion]: CURRENT_BINDING_VERSION,
  };

  if (binding.presetId) {
    record[CHAT_BINDING_KEYS.presetId] = binding.presetId;
  }

  if (binding.worldIds.length > 0) {
    record[CHAT_BINDING_KEYS.worldIds] = [...binding.worldIds];
  }

  if (binding.quickReplySetIds.length > 0) {
    record[CHAT_BINDING_KEYS.quickReplySetIds] = [...binding.quickReplySetIds];
  }

  if (binding.regexSourceIds.length > 0) {
    record[CHAT_BINDING_KEYS.regexSourceIds] = [...binding.regexSourceIds];
  }

  if (binding.personaId) {
    record[CHAT_BINDING_KEYS.personaId] = binding.personaId;
  }

  return record;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}
