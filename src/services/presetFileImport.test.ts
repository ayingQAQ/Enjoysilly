import "fake-indexeddb/auto";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { listPresets, openMySillyDatabase } from "../lib/db";
import { importPresetFilesToDatabase } from "./presetFileImport";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_preset_file_import_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

function findPresetFixture(): string {
  const fileName = readdirSync(fixturesDir).find((name) =>
    name.endsWith(".json"),
  );

  if (!fileName) {
    throw new Error("Missing preset fixture.");
  }

  return join(fixturesDir, fileName);
}

describe("preset file import service", () => {
  it("imports native ST presets and rejects unsupported script-like JSON", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const validBytes = readFileSync(findPresetFixture());
    const unsupportedBytes = new TextEncoder().encode(
      JSON.stringify({
        id: "script-preset",
        name: "第三方脚本预设",
        content: "injectScript(() => {})",
        buttons: [],
      }),
    );

    const result = await importPresetFilesToDatabase(
      [
        {
          fileName: "native-preset.json",
          bytes: validBytes,
        },
        {
          fileName: "script-preset.json",
          bytes: unsupportedBytes,
        },
      ],
      {
        database,
        now: () => "2026-07-04T12:00:00.000Z",
      },
    );

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0].preset.prompts).toHaveLength(50);
    expect(result.imported[0].regexScripts).toHaveLength(10);
    expect(result.failed).toEqual([
      {
        fileName: "script-preset.json",
        message: "JSON is not a supported SillyTavern Chat Completion preset.",
      },
    ]);
    await expect(listPresets(database)).resolves.toHaveLength(1);

    database.close();
  });
});
