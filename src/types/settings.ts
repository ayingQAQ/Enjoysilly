import type { PreserveUnknownFields } from "./common";

export type AppTheme = "dark" | "light" | "system";
export type AppFontScale = "sm" | "md" | "lg";

export interface ApiConnectionSettings extends PreserveUnknownFields {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export interface UserPersona extends PreserveUnknownFields {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface AppSettings extends PreserveUnknownFields {
  api: ApiConnectionSettings;
  defaultPresetId?: string;
  defaultWorldId?: string;
  defaultQuickReplySetId?: string;
  activeProfileId?: string;
  theme: AppTheme;
  fontScale: AppFontScale;
}
