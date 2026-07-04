import type { LucideIcon } from "lucide-react";

export type WorkspaceSectionId =
  | "chat"
  | "characters"
  | "worlds"
  | "presets"
  | "regex"
  | "quickReplies"
  | "groups"
  | "settings";

export interface WorkspaceSection {
  id: WorkspaceSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface DemoCharacter {
  id: string;
  name: string;
  subtitle: string;
  avatarUrl: string;
  tags: string[];
  lastMessage: string;
  updatedAt: string;
}
