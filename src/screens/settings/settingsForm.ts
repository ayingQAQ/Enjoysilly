import {
  defaultApiBaseUrl,
  defaultApiModel,
} from "../../services/settingsStore";
import type {
  AppFontScale,
  AppSettings,
  AppTheme,
  UserPersona,
} from "../../types/settings";

export interface SettingsFormState {
  baseUrl: string;
  apiKey: string;
  model: string;
  personaName: string;
  personaDescription: string;
  defaultPresetId: string;
  defaultWorldId: string;
  defaultQuickReplySetId: string;
  theme: AppTheme;
  fontScale: AppFontScale;
}

export const emptySelection = "";

export function createInitialFormState(): SettingsFormState {
  return createFormState(
    {
      api: { baseUrl: defaultApiBaseUrl, apiKey: "", model: defaultApiModel },
      theme: "system",
      fontScale: "md",
    },
    {
      id: "persona_default",
      name: "User",
      description: "",
      isDefault: true,
    },
  );
}

export function createFormState(
  settings: AppSettings,
  persona: UserPersona,
  availableIds?: {
    presetIds: string[];
    worldIds: string[];
    quickReplySetIds: string[];
  },
): SettingsFormState {
  return {
    baseUrl: settings.api.baseUrl,
    apiKey: settings.api.apiKey ?? "",
    model: settings.api.model,
    personaName: persona.name,
    personaDescription: persona.description ?? "",
    defaultPresetId: keepExistingAssetId(settings.defaultPresetId, availableIds?.presetIds),
    defaultWorldId: keepExistingAssetId(settings.defaultWorldId, availableIds?.worldIds),
    defaultQuickReplySetId: keepExistingAssetId(
      settings.defaultQuickReplySetId,
      availableIds?.quickReplySetIds,
    ),
    theme: settings.theme,
    fontScale: settings.fontScale,
  };
}

function keepExistingAssetId(
  selectedId: string | undefined,
  availableIds: string[] | undefined,
): string {
  if (!selectedId) return emptySelection;
  if (!availableIds) return selectedId;
  return availableIds.includes(selectedId) ? selectedId : emptySelection;
}

export function optionalId(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
