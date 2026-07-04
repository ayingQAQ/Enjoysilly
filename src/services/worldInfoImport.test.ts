import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { getWorldInfo, openMySillyDatabase } from "../lib/db";
import {
  createStoredWorldInfo,
  importWorldInfoToDatabase,
} from "./worldInfoImport";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_world_import_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("world info import service", () => {
  it("creates stable stored world info metadata", () => {
    const stored = createStoredWorldInfo(
      {
        name: "随身世界书",
        entries: [
          {
            keys: ["潇湘馆"],
            content: "林黛玉居所。",
          },
        ],
      },
      "随身世界书",
      {
        id: "world-test",
        now: () => "2026-07-04T00:10:00.000Z",
      },
    );

    expect(stored).toMatchObject({
      id: "world-test",
      name: "随身世界书",
      createdAt: "2026-07-04T00:10:00.000Z",
      updatedAt: "2026-07-04T00:10:00.000Z",
    });
  });

  it("imports native world info JSON and saves it to IndexedDB", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        entries: {
          "0": {
            uid: 0,
            key: ["潇湘馆"],
            content: "林黛玉居所。",
            order: 10,
            disable: false,
          },
        },
      }),
    );

    const result = await importWorldInfoToDatabase(bytes, "world.json", {
      database,
      id: "world-native",
      now: () => "2026-07-04T00:10:00.000Z",
    });

    expect(result.stored.name).toBe("world");
    expect(result.worldInfo.entries).toHaveProperty("0");
    expect(result.result).toMatchObject({
      assetKind: "world",
      fileName: "world.json",
      stored: result.stored,
    });
    expect(result.result.warnings.map((warning) => warning.code)).toEqual([
      "unknown-fields-preserved",
    ]);

    await expect(getWorldInfo("world-native", database)).resolves.toEqual(
      result.stored,
    );

    database.close();
  });

  it("imports portable character_book JSON and uses its name", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        name: "内嵌世界书",
        entries: [
          {
            keys: ["宝玉"],
            content: "贾宝玉。",
          },
        ],
      }),
    );

    const result = await importWorldInfoToDatabase(bytes, "book.json", {
      database,
      id: "world-portable",
      now: () => "2026-07-04T00:10:00.000Z",
    });

    expect(result.stored.name).toBe("内嵌世界书");

    await expect(getWorldInfo("world-portable", database)).resolves.toEqual(
      result.stored,
    );

    database.close();
  });
});
