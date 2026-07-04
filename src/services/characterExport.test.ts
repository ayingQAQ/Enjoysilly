import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { parseCharacterCardJson } from "../lib/cardIO";
import { openMySillyDatabase, saveCharacter } from "../lib/db";
import { importCharacterToDatabase } from "./characterImport";
import {
  createCharacterJsonExport,
  createCharacterJsonFileName,
} from "./characterExport";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_character_export_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("character export service", () => {
  it("creates safe JSON export file names", () => {
    expect(createCharacterJsonFileName(' 林黛玉:/\\*?"<>| ')).toBe(
      "林黛玉_________.json",
    );
    expect(createCharacterJsonFileName("   ")).toBe("character.json");
    expect(createCharacterJsonFileName("CON")).toBe("_CON.json");
    expect(createCharacterJsonFileName("...")).toBe("character.json");
  });

  it("exports a stored character as round-trippable JSON bytes", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-07-04T12:00:00.000Z";

    await saveCharacter(
      {
        id: "char-1",
        name: "林黛玉",
        createdAt: now,
        updatedAt: now,
        payload: {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: {
            name: "林黛玉",
            avatar: "avatar.png",
            extensions: {
              keep: true,
            },
          },
          root_unknown: "keep",
        },
      },
      database,
    );

    const exported = await createCharacterJsonExport("char-1", database);
    const json = new TextDecoder().decode(exported.bytes);
    const parsed = parseCharacterCardJson(json);

    expect(exported.fileName).toBe("林黛玉.json");
    expect(exported.stored.name).toBe("林黛玉");
    expect(parsed).toEqual({
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "林黛玉",
        avatar: "avatar.png",
        extensions: {
          keep: true,
        },
      },
      root_unknown: "keep",
    });

    database.close();
  });

  it("exports a real PNG fixture card without losing embedded book fields", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    try {
      const imported = await importCharacterToDatabase(
        readFileSync(join(fixturesDir, "红楼.png")),
        "红楼.png",
        {
          database,
          id: "honglou",
          now: () => "2026-07-04T12:05:00.000Z",
        },
      );

      const exported = await createCharacterJsonExport("honglou", database);
      const parsed = parseCharacterCardJson(
        new TextDecoder().decode(exported.bytes),
      );

      expect(exported.fileName).toBe("红楼梦世界.json");
      expect(parsed).toEqual(imported.imported.card);
      expect(parsed.data.avatar).toBe(imported.imported.card.data.avatar);
      expect(parsed.data.character_book?.entries).toHaveLength(10);
      expect(parsed.data.character_book?.entries[0]).toHaveProperty(
        "display_index",
      );
    } finally {
      database.close();
    }
  });

  it("reports a missing character export clearly", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await expect(createCharacterJsonExport("missing", database)).rejects.toThrow(
      "找不到角色卡：missing",
    );

    database.close();
  });
});
