import "fake-indexeddb/auto";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { getCharacter, getWorldInfo, openMySillyDatabase } from "../lib/db";
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

    try {
      const result = await importCharacterToDatabase(bytes, "card.png", {
        database,
        id: "honglou",
        now: () => "2026-07-03T16:00:00.000Z",
      });

      expect(result.imported.format).toBe("png");
      expect(result.stored.sourceFileName).toBe("card.png");
      expect(result.stored.sourcePngBytes?.byteLength).toBe(bytes.byteLength);
      expect(result.stored.sourcePngBytes?.[0]).toBe(bytes[0]);
      expect(result.stored.sourcePngBytes?.[1]).toBe(bytes[1]);
      expect(result.embeddedWorldInfo).toMatchObject({
        id: "honglou__character_book",
        name: `${result.stored.name} · 内嵌世界书`,
      });
      expect(result.result).toMatchObject({
        assetKind: "character",
        fileName: "card.png",
        stored: result.stored,
      });
      expect(result.result.warnings.map((warning) => warning.code)).toContain(
        "unknown-fields-preserved",
      );

      const stored = await getCharacter("honglou", database);

      expect(stored?.id).toBe(result.stored.id);
      expect(stored?.sourcePngBytes?.byteLength).toBe(bytes.byteLength);

      const embeddedWorldInfo = await getWorldInfo(
        "honglou__character_book",
        database,
      );

      expect(embeddedWorldInfo?.payload).toEqual(
        result.imported.card.data.character_book,
      );
    } finally {
      database.close();
    }
  }, 30000);
});
