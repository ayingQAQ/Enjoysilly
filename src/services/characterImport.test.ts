import "fake-indexeddb/auto";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { getCharacter, openMySillyDatabase } from "../lib/db";
import { createStoredCharacter, importCharacterToDatabase } from "./characterImport";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_character_import_${crypto.randomUUID()}`;
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

describe("character import service", () => {
  it("creates stable stored character metadata from a card", () => {
    const stored = createStoredCharacter(
      {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: {
          name: "测试角色",
        },
      },
      {
        id: "char-test",
        now: () => "2026-07-03T16:00:00.000Z",
      },
    );

    expect(stored).toMatchObject({
      id: "char-test",
      name: "测试角色",
      createdAt: "2026-07-03T16:00:00.000Z",
      updatedAt: "2026-07-03T16:00:00.000Z",
    });
  });

  it("imports a real PNG card and saves it to IndexedDB", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const bytes = readFileSync(findFixture(".png"));

    const result = await importCharacterToDatabase(bytes, "红楼.png", {
      database,
      id: "honglou",
      now: () => "2026-07-03T16:00:00.000Z",
    });

    expect(result.imported.format).toBe("png");
    expect(result.stored.name).toBe("红楼梦世界");
    expect(result.result).toMatchObject({
      assetKind: "character",
      fileName: "红楼.png",
      stored: result.stored,
    });
    expect(result.result.warnings.map((warning) => warning.code)).toContain(
      "unknown-fields-preserved",
    );

    await expect(getCharacter("honglou", database)).resolves.toEqual(
      result.stored,
    );

    database.close();
  });
});
