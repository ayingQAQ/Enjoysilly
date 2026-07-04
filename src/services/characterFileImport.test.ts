import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { listCharacters, openMySillyDatabase } from "../lib/db";
import { importCharacterFilesToDatabase } from "./characterFileImport";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_character_file_import_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("character file import service", () => {
  it("imports valid character files and reports invalid files without aborting", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const result = await importCharacterFilesToDatabase(
      [
        {
          fileName: "红楼.png",
          bytes: readFileSync(join(fixturesDir, "红楼.png")),
        },
        {
          fileName: "notes.txt",
          bytes: new TextEncoder().encode("not a card"),
        },
      ],
      {
        database,
        now: () => "2026-07-04T11:00:00.000Z",
      },
    );

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0].stored).toMatchObject({
      name: "红楼梦世界",
      createdAt: "2026-07-04T11:00:00.000Z",
      updatedAt: "2026-07-04T11:00:00.000Z",
    });
    expect(result.failed).toEqual([
      {
        fileName: "notes.txt",
        message: "Unsupported character card file extension: notes.txt",
      },
    ]);
    await expect(listCharacters(database)).resolves.toHaveLength(1);

    database.close();
  });
});
