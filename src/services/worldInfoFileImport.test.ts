import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { listWorlds, openMySillyDatabase } from "../lib/db";
import { importWorldInfoFilesToDatabase } from "./worldInfoFileImport";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_world_info_file_import_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("world info file import service", () => {
  it("imports valid world info files and reports invalid files", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const nativeWorldJson = JSON.stringify({
      entries: {
        "0": {
          key: ["大观园"],
          content: "园中总名。",
        },
      },
    });
    const portableWorldJson = JSON.stringify({
      name: "内嵌世界书",
      entries: [
        {
          keys: ["潇湘馆"],
          content: "林黛玉居所。",
        },
      ],
    });

    const result = await importWorldInfoFilesToDatabase(
      [
        {
          fileName: "native-world.json",
          bytes: new TextEncoder().encode(nativeWorldJson),
        },
        {
          fileName: "portable-world.json",
          bytes: new TextEncoder().encode(portableWorldJson),
        },
        {
          fileName: "broken.json",
          bytes: new TextEncoder().encode("{"),
        },
      ],
      {
        database,
        now: () => "2026-07-04T13:00:00.000Z",
      },
    );

    expect(result.imported.map((item) => item.stored.name)).toEqual([
      "native-world",
      "内嵌世界书",
    ]);
    expect(result.failed).toEqual([
      {
        fileName: "broken.json",
        message: expect.any(String),
      },
    ]);
    await expect(listWorlds(database)).resolves.toHaveLength(2);

    database.close();
  });
});
