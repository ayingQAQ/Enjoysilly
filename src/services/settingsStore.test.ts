import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import {
  getSetting,
  openMySillyDatabase,
  resetDatabaseConnectionForTests,
  saveSetting,
} from "../lib/db";
import {
  appSettingsKey,
  defaultApiBaseUrl,
  defaultApiModel,
  defaultPersonaName,
  loadApiConnectionSettings,
  loadAppSettings,
  loadUserPersonas,
  saveApiConnectionSettings,
  saveAppSettings,
  saveUserPersonas,
  selectDefaultPersona,
  userPersonasKey,
} from "./settingsStore";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  resetDatabaseConnectionForTests();

  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_settings_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("settingsStore", () => {
  it("returns default app settings from an empty database", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await expect(loadAppSettings(database)).resolves.toEqual({
      api: {
        baseUrl: defaultApiBaseUrl,
        apiKey: "",
        model: defaultApiModel,
      },
      theme: "system",
      fontScale: "md",
    });

    database.close();
  });

  it("saves and loads normalized app settings without deleting unknown setting keys", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    await saveSetting(
      {
        key: "futureSetting",
        value: { keep: true },
        updatedAt: "2026-07-06T00:00:00.000Z",
      },
      database,
    );

    const saved = await saveAppSettings(
      {
        api: {
          baseUrl: "  http://localhost:11434/v1  ",
          apiKey: "secret",
          model: "  qwen-test  ",
          apiUnknown: "keep",
        },
        defaultPresetId: " preset-1 ",
        defaultWorldId: "",
        defaultQuickReplySetId: "qr-1",
        theme: "dark",
        fontScale: "lg",
        unknownTop: "keep",
      },
      {
        database,
        now: new Date("2026-07-06T01:02:03.000Z"),
      },
    );

    expect(saved).toEqual({
      api: {
        baseUrl: "http://localhost:11434/v1",
        apiKey: "secret",
        model: "qwen-test",
        apiUnknown: "keep",
      },
      defaultPresetId: "preset-1",
      defaultWorldId: undefined,
      defaultQuickReplySetId: "qr-1",
      theme: "dark",
      fontScale: "lg",
      unknownTop: "keep",
    });
    await expect(loadApiConnectionSettings(database)).resolves.toEqual(saved.api);
    await expect(getSetting("futureSetting", database)).resolves.toEqual(
      expect.objectContaining({ value: { keep: true } }),
    );

    database.close();
  });

  it("updates only the api block when saving api connection settings", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    await saveAppSettings(
      {
        api: {
          baseUrl: defaultApiBaseUrl,
          apiKey: "",
          model: defaultApiModel,
        },
        defaultPresetId: "preset-1",
        theme: "light",
        fontScale: "sm",
      },
      { database },
    );

    const updated = await saveApiConnectionSettings(
      {
        baseUrl: "http://127.0.0.1:3000/v1",
        apiKey: "key",
        model: "local-model",
      },
      { database },
    );

    expect(updated).toEqual({
      api: {
        baseUrl: "http://127.0.0.1:3000/v1",
        apiKey: "key",
        model: "local-model",
      },
      defaultPresetId: "preset-1",
      theme: "light",
      fontScale: "sm",
    });

    database.close();
  });

  it("saves personas and selects a stable default persona", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const saved = await saveUserPersonas(
      [
        {
          id: "persona-a",
          name: "  见山  ",
          description: "测试用户",
          unknownPersona: "keep",
        },
        {
          id: "persona-b",
          name: "备用",
          isDefault: true,
        },
      ],
      { database },
    );

    expect(saved[0]).toEqual(
      expect.objectContaining({
        id: "persona-a",
        name: "见山",
        description: "测试用户",
        unknownPersona: "keep",
        isDefault: false,
      }),
    );
    expect(selectDefaultPersona(saved)).toEqual(
      expect.objectContaining({ id: "persona-b", name: "备用" }),
    );
    await expect(loadUserPersonas(database)).resolves.toEqual(saved);
    await expect(getSetting(userPersonasKey, database)).resolves.toEqual(
      expect.objectContaining({ key: userPersonasKey }),
    );

    database.close();
  });

  it("falls back to a default persona for invalid stored data", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    await saveSetting(
      {
        key: userPersonasKey,
        value: [],
        updatedAt: "2026-07-06T00:00:00.000Z",
      },
      database,
    );

    await expect(loadUserPersonas(database)).resolves.toEqual([
      {
        id: "persona_default",
        name: defaultPersonaName,
        description: "",
        isDefault: true,
      },
    ]);
    await expect(getSetting(appSettingsKey, database)).resolves.toBeUndefined();

    database.close();
  });

  it("keeps only the first default persona when normalizing personas", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const saved = await saveUserPersonas(
      [
        { id: "persona-a", name: "A", isDefault: true },
        { id: "persona-b", name: "B", isDefault: true },
      ],
      { database },
    );

    expect(saved).toEqual([
      expect.objectContaining({ id: "persona-a", isDefault: true }),
      expect.objectContaining({ id: "persona-b", isDefault: false }),
    ]);
    expect(selectDefaultPersona(saved).id).toBe("persona-a");

    database.close();
  });
});
