import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { openMySillyDatabase, saveWorldInfo } from "../lib/db";
import { parseWorldInfoJson } from "../lib/worldInfoIO";
import { importCharacterToDatabase } from "./characterImport";
import { createStoredWorldInfo } from "./worldInfoImport";
import {
  createWorldInfoJsonExport,
  createWorldInfoJsonFileName,
} from "./worldInfoExport";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_world_info_export_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("world info export service", () => {
  it("creates safe JSON export file names", () => {
    expect(createWorldInfoJsonFileName(' 大观园:/\\*?"<>| ')).toBe(
      "大观园_________.json",
    );
    expect(createWorldInfoJsonFileName("NUL")).toBe("_NUL.json");
    expect(createWorldInfoJsonFileName("...")).toBe("world-info.json");
  });

  it("exports native world info without changing payload fields", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const payload = {
      entries: {
        "0": {
          uid: 7,
          key: ["大观园"],
          content: "园中总名。",
          disable: false,
          displayIndex: 3,
        },
      },
      extra_root: "keep",
    };

    await saveWorldInfo(
      {
        id: "native",
        name: "原生世界书",
        createdAt: "2026-07-04T14:00:00.000Z",
        updatedAt: "2026-07-04T14:00:00.000Z",
        payload,
      },
      database,
    );

    const exported = await createWorldInfoJsonExport("native", database);
    const parsed = parseWorldInfoJson(new TextDecoder().decode(exported.bytes));

    expect(exported.fileName).toBe("原生世界书.json");
    expect(parsed).toEqual(payload);

    database.close();
  });

  it("exports portable world info without changing payload fields", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const payload = {
      name: "内嵌世界书",
      entries: [
        {
          keys: ["潇湘馆"],
          content: "林黛玉居所。",
          enabled: true,
          display_index: 5,
          extensions: {
            probability: 80,
          },
        },
      ],
    };

    await saveWorldInfo(
      {
        id: "portable",
        name: "内嵌世界书",
        createdAt: "2026-07-04T14:05:00.000Z",
        updatedAt: "2026-07-04T14:05:00.000Z",
        payload,
      },
      database,
    );

    const exported = await createWorldInfoJsonExport("portable", database);
    const parsed = parseWorldInfoJson(new TextDecoder().decode(exported.bytes));

    expect(exported.fileName).toBe("内嵌世界书.json");
    expect(parsed).toEqual(payload);

    database.close();
  });

  it("exports the real embedded Honglou character book without losing fields", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    try {
      const importedCharacter = await importCharacterToDatabase(
        readFileSync(join(fixturesDir, "红楼.png")),
        "红楼.png",
        {
          database,
          id: "honglou",
          now: () => "2026-07-04T14:10:00.000Z",
        },
      );
      const characterBook = importedCharacter.imported.card.data.character_book;

      if (!characterBook) {
        throw new Error("Fixture is missing character_book.");
      }

      await saveWorldInfo(
        createStoredWorldInfo(characterBook, "红楼梦世界 · 内嵌世界书", {
          id: "honglou-world",
          now: () => "2026-07-04T14:10:00.000Z",
        }),
        database,
      );

      const exported = await createWorldInfoJsonExport("honglou-world", database);
      const parsed = parseWorldInfoJson(new TextDecoder().decode(exported.bytes));

      expect(exported.fileName).toBe("红楼梦世界 · 内嵌世界书.json");
      expect(parsed).toEqual(characterBook);
      expect(parsed.entries).toHaveLength(10);
      expect(parsed.entries[0]).toHaveProperty("display_index");
      expect(parsed.entries[0]).toHaveProperty("extensions");
    } finally {
      database.close();
    }
  });

  it("reports a missing world info export clearly", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await expect(createWorldInfoJsonExport("missing", database)).rejects.toThrow(
      "找不到世界书：missing",
    );

    database.close();
  });
});
