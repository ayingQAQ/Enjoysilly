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
