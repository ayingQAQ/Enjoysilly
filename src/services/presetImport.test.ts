import "fake-indexeddb/auto";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { getPreset, openMySillyDatabase } from "../lib/db";
import { createStoredPreset, importPresetToDatabase } from "./presetImport";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_preset_import_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

function findFixture(extension: string): string {
  const fileName = readdirSync(fixturesDir).find((name) =>
    name.endsWith(extension),
  );

  if (!fileName) {
    throw new Error(`Missing ${extension} fixture.`);
  }

  return join(fixturesDir, fileName);
}

describe("preset import service", () => {
  it("creates stable stored preset metadata", () => {
    const stored = createStoredPreset(
      {
        prompts: [],
        prompt_order: [],
        extensions: {
          tavern_helper: { keep: true },
        },
      },
      "测试预设",
      {
        id: "preset-test",
        now: () => "2026-07-04T00:10:00.000Z",
      },
    );

    expect(stored).toMatchObject({
      id: "preset-test",
      name: "测试预设",
      createdAt: "2026-07-04T00:10:00.000Z",
      updatedAt: "2026-07-04T00:10:00.000Z",
    });
    expect(stored.payload.extensions?.tavern_helper).toEqual({ keep: true });
  });

  it("imports the real preset and saves it to IndexedDB", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const bytes = readFileSync(findFixture(".json"));

    const result = await importPresetToDatabase(bytes, "preset.json", {
      database,
      id: "preset-real",
      name: "小猫之神",
      now: () => "2026-07-04T00:10:00.000Z",
    });

    expect(result.preset.prompts).toHaveLength(50);
    expect(result.regexScripts).toHaveLength(10);
    expect(result.result).toMatchObject({
      assetKind: "preset",
      fileName: "preset.json",
      stored: result.stored,
    });
    expect(result.result.warnings.map((warning) => warning.code)).toEqual([
      "unknown-fields-preserved",
      "regex-scripts-detected",
      "unsupported-third-party-data-preserved",
    ]);

    await expect(getPreset("preset-real", database)).resolves.toEqual(
      result.stored,
    );

    database.close();
  });
});
