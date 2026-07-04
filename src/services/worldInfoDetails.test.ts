import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { openMySillyDatabase, saveWorldInfo, type StoredWorldInfo } from "../lib/db";
import { importCharacterToDatabase } from "./characterImport";
import { createStoredWorldInfo } from "./worldInfoImport";
import {
  createWorldInfoDetailSummary,
  loadWorldInfoDetailSummary,
} from "./worldInfoDetails";
import { createWorldInfoJsonExport } from "./worldInfoExport";
import { parseWorldInfoJson } from "../lib/worldInfoIO";

const fixturesDir = join(process.cwd(), "test-fixtures");
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_world_info_details_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("world info detail summaries", () => {
  it("creates read-only summaries for native world info entries", () => {
    const stored: StoredWorldInfo = {
      id: "native",
      name: "原生世界书",
      createdAt: "2026-07-04T18:00:00.000Z",
      updatedAt: "2026-07-04T18:05:00.000Z",
      payload: {
        extra_root: "keep",
        entries: {
          "0": {
            uid: 7,
            key: ["大观园"],
            keysecondary: ["贾府"],
            comment: "地点",
            content: "  园中\n地点设定。  ",
            constant: true,
            selective: true,
            order: 10,
            position: 4,
            depth: 2,
            disable: false,
            probability: 80,
            useProbability: true,
            caseSensitive: false,
            displayIndex: 3,
            extra_entry: "keep",
          },
          "1": {
            key: ["停用"],
            content: "停用条目。",
            disable: true,
          },
        },
      },
    };
    const before = JSON.parse(JSON.stringify(stored));

    const summary = createWorldInfoDetailSummary(stored);

    expect(summary).toMatchObject({
      id: "native",
      name: "原生世界书",
      dialect: "native",
      entryCount: 2,
      enabledEntryCount: 1,
      disabledEntryCount: 1,
      constantEntryCount: 1,
      selectiveEntryCount: 1,
      rootPreservedFieldNames: ["extra_root"],
      entryPreservedFieldNames: ["extra_entry"],
    });
    expect(summary.entryPreviews[0]).toMatchObject({
      id: "7",
      sourceKey: "0",
      dialect: "native",
      title: "地点",
      keys: ["大观园"],
      secondaryKeys: ["贾府"],
      contentPreview: "园中 地点设定。",
      enabled: true,
      constant: true,
      selective: true,
      order: 10,
      positionLabel: "atDepth(4)",
      depth: 2,
      probability: 80,
      useProbability: true,
      caseSensitive: false,
      displayIndex: 3,
      preservedFieldNames: ["extra_entry"],
    });
    expect(summary.entryPreviews[1]).toMatchObject({
      id: "1",
      sourceKey: "1",
    });
    expect(stored).toEqual(before);
  });

  it("creates read-only summaries for portable character book entries", () => {
    const summary = createWorldInfoDetailSummary({
      id: "portable",
      name: "内嵌世界书",
      createdAt: "2026-07-04T18:10:00.000Z",
      updatedAt: "2026-07-04T18:10:00.000Z",
      payload: {
        name: "红楼世界",
        extra_root: "keep",
        entries: [
          {
            id: 9,
            keys: ["潇湘馆"],
            secondary_keys: ["黛玉"],
            name: "住所",
            content: "林黛玉居所。",
            enabled: false,
            constant: false,
            selective: true,
            insertion_order: 5,
            position: "before_char",
            case_sensitive: true,
            display_index: 2,
            extensions: {
              probability: 70,
            },
            extra_entry: "keep",
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      dialect: "portable",
      entryCount: 1,
      enabledEntryCount: 0,
      disabledEntryCount: 1,
      selectiveEntryCount: 1,
      rootPreservedFieldNames: ["extra_root"],
      entryPreservedFieldNames: ["extra_entry"],
    });
    expect(summary.entryPreviews[0]).toMatchObject({
      id: "9",
      sourceKey: "0",
      title: "住所",
      keys: ["潇湘馆"],
      secondaryKeys: ["黛玉"],
      enabled: false,
      order: 5,
      positionLabel: "before_char",
      caseSensitive: true,
      displayIndex: 2,
      extensionFieldNames: ["probability"],
      preservedFieldNames: ["extra_entry"],
    });
  });

  it("loads the real embedded Honglou character book detail summary", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    try {
      const importedCharacter = await importCharacterToDatabase(
        readFileSync(join(fixturesDir, "红楼.png")),
        "红楼.png",
        {
          database,
          id: "honglou",
          now: () => "2026-07-04T18:15:00.000Z",
        },
      );
      const characterBook = importedCharacter.imported.card.data.character_book;

      if (!characterBook) {
        throw new Error("Fixture is missing character_book.");
      }

      await saveWorldInfo(
        createStoredWorldInfo(characterBook, "红楼梦世界 · 内嵌世界书", {
          id: "honglou-world",
          now: () => "2026-07-04T18:15:00.000Z",
        }),
        database,
      );

      const summary = await loadWorldInfoDetailSummary("honglou-world", database);

      expect(summary).toMatchObject({
        id: "honglou-world",
        name: "红楼梦世界 · 内嵌世界书",
        dialect: "portable",
        entryCount: 10,
        enabledEntryCount: 10,
        constantEntryCount: 2,
      });
      expect(summary.entryPreviews[0].extensionFieldNames.length).toBeGreaterThan(0);
      expect(summary.entryPreviews[0].displayIndex).toBeDefined();
    } finally {
      database.close();
    }
  });

  it("reports a missing world info detail clearly", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    await expect(loadWorldInfoDetailSummary("missing", database)).rejects.toThrow(
      "找不到世界书：missing",
    );

    database.close();
  });

  it("skips malformed entries without breaking summaries", () => {
    const summary = createWorldInfoDetailSummary({
      id: "loose",
      name: "宽松世界书",
      createdAt: "2026-07-04T18:20:00.000Z",
      updatedAt: "2026-07-04T18:20:00.000Z",
      payload: {
        entries: [
          "not an entry",
          {
            content: "没有关键词。",
            enabled: true,
            custom_entry_field: "keep",
          },
        ],
      } as never,
    });

    expect(summary).toMatchObject({
      dialect: "portable",
      entryCount: 1,
      enabledEntryCount: 1,
      entryPreservedFieldNames: ["custom_entry_field"],
    });
    expect(summary.entryPreviews[0].sourceKey).toBe("1");
    expect(summary.entryPreviews[0]).toMatchObject({
      title: "条目 1",
      keys: [],
      contentPreview: "没有关键词。",
      preservedFieldNames: ["custom_entry_field"],
    });
  });

  it("does not change native or portable payloads before JSON export", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const nativePayload = {
      extra_root: "keep",
      entries: {
        "0": {
          key: ["native"],
          content: "native content",
          disable: false,
          extra_entry: "keep",
        },
      },
    };
    const portablePayload = {
      name: "portable book",
      extra_root: "keep",
      entries: [
        {
          keys: ["portable"],
          content: "portable content",
          enabled: true,
          extensions: {
            probability: 40,
          },
          extra_entry: "keep",
        },
      ],
    };

    await saveWorldInfo(
      {
        id: "native-export",
        name: "native export",
        createdAt: "2026-07-04T18:30:00.000Z",
        updatedAt: "2026-07-04T18:30:00.000Z",
        payload: nativePayload,
      },
      database,
    );
    await saveWorldInfo(
      {
        id: "portable-export",
        name: "portable export",
        createdAt: "2026-07-04T18:35:00.000Z",
        updatedAt: "2026-07-04T18:35:00.000Z",
        payload: portablePayload,
      },
      database,
    );

    await loadWorldInfoDetailSummary("native-export", database);
    await loadWorldInfoDetailSummary("portable-export", database);

    const nativeExport = await createWorldInfoJsonExport("native-export", database);
    const portableExport = await createWorldInfoJsonExport(
      "portable-export",
      database,
    );

    expect(
      parseWorldInfoJson(new TextDecoder().decode(nativeExport.bytes)),
    ).toEqual(nativePayload);
    expect(
      parseWorldInfoJson(new TextDecoder().decode(portableExport.bytes)),
    ).toEqual(portablePayload);

    database.close();
  });
});
