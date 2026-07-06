import {
  Bot,
  Braces,
  Library,
  MessageSquareText,
  ScrollText,
  Settings,
  UsersRound,
  Zap,
} from "lucide-react";

import type { WorkspaceSection } from "../types/ui";

export const workspaceSections: WorkspaceSection[] = [
  {
    id: "chat",
    label: "对话",
    description: "实时角色扮演、Swipe 与存档",
    icon: MessageSquareText,
  },
  {
    id: "characters",
    label: "角色卡",
    description: "PNG / JSON 双向兼容",
    icon: Bot,
  },
  {
    id: "worlds",
    label: "世界书",
    description: "两种方言互转与扫描",
    icon: Library,
  },
  {
    id: "presets",
    label: "预设",
    description: "ST 原生 Chat Completion",
    icon: ScrollText,
  },
  {
    id: "regex",
    label: "正则脚本",
    description: "从 preset extensions 读取",
    icon: Braces,
  },
  {
    id: "quickReplies",
    label: "快速回复",
    description: "按钮套组与常用指令",
    icon: Zap,
  },
  {
    id: "groups",
    label: "分组聊天",
    description: "多角色轮流发言",
    icon: UsersRound,
  },
  {
    id: "settings",
    label: "设置",
    description: "接口、Persona 与备份",
    icon: Settings,
  },
];
