import {
  getSetting,
  saveSetting,
  type MySillyDatabaseConnection,
} from "../lib/db";
import type {
  ApiConnectionSettings,
  AppFontScale,
  AppSettings,
  AppTheme,
  UserPersona,
} from "../types/settings";
import type { LocalProfile } from "../types/localProfile";

export const appSettingsKey = "appSettings";
export const userPersonasKey = "userPersonas";

export const defaultApiBaseUrl = "http://127.0.0.1:8000/v1";
export const defaultApiModel = "gpt-4o-mini";
export const defaultPersonaName = "User";

export const defaultAppSettings: AppSettings = {
  api: {
    baseUrl: defaultApiBaseUrl,
    apiKey: "",
    model: defaultApiModel,
  },
  theme: "system",
  fontScale: "md",
};

export const defaultUserPersonas: UserPersona[] = [
  {
    id: "persona_default",
    name: defaultPersonaName,
    description: "",
    isDefault: true,
  },
];

export async function loadAppSettings(
  database?: MySillyDatabaseConnection,
): Promise<AppSettings> {
  const setting = await getSetting(appSettingsKey, database);

  return normalizeAppSettings(setting?.value);
}

export async function saveAppSettings(
  settings: AppSettings,
  options: {
    database?: MySillyDatabaseConnection;
    now?: Date;
  } = {},
): Promise<AppSettings> {
  const normalized = normalizeAppSettings(settings);

  await saveSetting(
    {
      key: appSettingsKey,
      value: normalized,
      updatedAt: (options.now ?? new Date()).toISOString(),
    },
    options.database,
  );

  return normalized;
}

export async function loadApiConnectionSettings(
  database?: MySillyDatabaseConnection,
): Promise<ApiConnectionSettings> {
  return (await loadAppSettings(database)).api;
}

export async function saveApiConnectionSettings(
  api: ApiConnectionSettings,
  options: {
    database?: MySillyDatabaseConnection;
    now?: Date;
  } = {},
): Promise<AppSettings> {
  const current = await loadAppSettings(options.database);

  return saveAppSettings(
    {
      ...current,
      api,
    },
    options,
  );
}

export async function loadUserPersonas(
  database?: MySillyDatabaseConnection,
): Promise<UserPersona[]> {
  const setting = await getSetting(userPersonasKey, database);

  return normalizeUserPersonas(setting?.value);
}

export async function saveUserPersonas(
  personas: UserPersona[],
  options: {
    database?: MySillyDatabaseConnection;
    now?: Date;
  } = {},
): Promise<UserPersona[]> {
  const normalized = normalizeUserPersonas(personas);

  await saveSetting(
    {
      key: userPersonasKey,
      value: normalized,
      updatedAt: (options.now ?? new Date()).toISOString(),
    },
    options.database,
  );

  return normalized;
}

export function selectDefaultPersona(personas: UserPersona[]): UserPersona {
  return normalizeUserPersonas(personas).find((persona) => persona.isDefault) ?? defaultUserPersonas[0];
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return structuredClone(defaultAppSettings);
  }

  const apiValue = isRecord(value.api) ? value.api : {};

  return {
    ...value,
    api: {
      ...apiValue,
      baseUrl: normalizeString(apiValue.baseUrl, defaultApiBaseUrl),
      apiKey: typeof apiValue.apiKey === "string" ? apiValue.apiKey : "",
      model: normalizeString(apiValue.model, defaultApiModel),
    },
    defaultPresetId: normalizeOptionalString(value.defaultPresetId),
    defaultWorldId: normalizeOptionalString(value.defaultWorldId),
    defaultQuickReplySetId: normalizeOptionalString(value.defaultQuickReplySetId),
    activeProfileId: normalizeOptionalString(value.activeProfileId),
    theme: normalizeTheme(value.theme),
    fontScale: normalizeFontScale(value.fontScale),
  };
}

export function normalizeUserPersonas(value: unknown): UserPersona[] {
  if (!Array.isArray(value)) {
    return structuredClone(defaultUserPersonas);
  }

  let hasDefault = false;
  const personas = value
    .filter(isRecord)
    .map((persona, index) => ({
      ...persona,
      id: normalizeString(persona.id, `persona_${index + 1}`),
      name: normalizeString(persona.name, defaultPersonaName),
      description: typeof persona.description === "string" ? persona.description : "",
      isDefault: persona.isDefault === true,
    }))
    .map((persona) => {
      if (!persona.isDefault) {
        return persona;
      }

      if (hasDefault) {
        return {
          ...persona,
          isDefault: false,
        };
      }

      hasDefault = true;

      return persona;
    });

  if (personas.length === 0) {
    return structuredClone(defaultUserPersonas);
  }

  if (!personas.some((persona) => persona.isDefault)) {
    personas[0] = {
      ...personas[0],
      isDefault: true,
    };
  }

  return personas;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeTheme(value: unknown): AppTheme {
  return value === "dark" || value === "light" || value === "system"
    ? value
    : defaultAppSettings.theme;
}

function normalizeFontScale(value: unknown): AppFontScale {
  return value === "sm" || value === "md" || value === "lg"
    ? value
    : defaultAppSettings.fontScale;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ─── LocalProfile — 本地工作区配置 ──────────────────────────────────

export const localProfilesKey = "localProfiles";

export const defaultLocalProfiles: LocalProfile[] = [
  {
    id: "profile_default",
    name: "默认工作区",
    worldIds: [],
    regexScriptIds: [],
    quickReplySetIds: [],
  },
];

export async function loadLocalProfiles(
  database?: MySillyDatabaseConnection,
): Promise<LocalProfile[]> {
  const setting = await getSetting(localProfilesKey, database);
  return normalizeLocalProfiles(setting?.value);
}

export async function saveLocalProfile(
  profile: LocalProfile,
  options: {
    database?: MySillyDatabaseConnection;
    now?: Date;
  } = {},
): Promise<LocalProfile[]> {
  const profiles = await loadLocalProfiles(options.database);
  const existingIndex = profiles.findIndex((p) => p.id === profile.id);
  const normalized = normalizeOneLocalProfile(profile);

  if (existingIndex >= 0) {
    profiles[existingIndex] = normalized;
  } else {
    profiles.push(normalized);
  }

  await persistLocalProfiles(profiles, options);
  return profiles;
}

export async function deleteLocalProfile(
  profileId: string,
  options: {
    database?: MySillyDatabaseConnection;
    now?: Date;
  } = {},
): Promise<LocalProfile[]> {
  const profiles = await loadLocalProfiles(options.database);
  const filtered = profiles.filter((p) => p.id !== profileId);

  if (filtered.length === profiles.length) {
    return profiles;
  }

  const profilesWithFallback = ensureDefaultProfile(filtered);

  await persistLocalProfiles(profilesWithFallback, options);
  return profilesWithFallback;
}

export function selectActiveLocalProfile(
  profiles: LocalProfile[],
  activeProfileId?: string,
): LocalProfile {
  const normalized = normalizeLocalProfiles(profiles);

  if (activeProfileId) {
    const match = normalized.find((p) => p.id === activeProfileId);
    if (match) return match;
  }

  return normalized[0] ?? defaultLocalProfiles[0];
}

async function persistLocalProfiles(
  profiles: LocalProfile[],
  options: {
    database?: MySillyDatabaseConnection;
    now?: Date;
  },
): Promise<void> {
  await saveSetting(
    {
      key: localProfilesKey,
      value: profiles,
      updatedAt: (options.now ?? new Date()).toISOString(),
    },
    options.database,
  );
}

export function normalizeLocalProfiles(value: unknown): LocalProfile[] {
  if (!Array.isArray(value)) {
    return structuredClone(defaultLocalProfiles);
  }

  const profiles = value
    .filter(isRecord)
    .map((item) => normalizeOneLocalProfile(item as Partial<LocalProfile>));

  return ensureDefaultProfile(profiles);
}

function normalizeOneLocalProfile(
  profile: Partial<LocalProfile>,
): LocalProfile {
  return {
    id: typeof profile.id === "string" && profile.id.trim().length > 0
      ? profile.id.trim()
      : `profile_${crypto.randomUUID().slice(0, 8)}`,
    name: typeof profile.name === "string" && profile.name.trim().length > 0
      ? profile.name.trim()
      : "未命名工作区",
    characterId: typeof profile.characterId === "string"
      ? profile.characterId
      : undefined,
    groupId: typeof profile.groupId === "string"
      ? profile.groupId
      : undefined,
    presetId: typeof profile.presetId === "string"
      ? profile.presetId
      : undefined,
    worldIds: Array.isArray(profile.worldIds)
      ? profile.worldIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [],
    regexScriptIds: Array.isArray(profile.regexScriptIds)
      ? profile.regexScriptIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [],
    quickReplySetIds: Array.isArray(profile.quickReplySetIds)
      ? profile.quickReplySetIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [],
    personaId: typeof profile.personaId === "string"
      ? profile.personaId
      : undefined,
  };
}

function ensureDefaultProfile(profiles: LocalProfile[]): LocalProfile[] {
  if (profiles.length === 0) {
    return structuredClone(defaultLocalProfiles);
  }

  return profiles;
}
