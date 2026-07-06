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
