import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { NativeWorldInfoEntry, PortableWorldInfoEntry } from "../types/worldinfo";
import { decodeCharacterCardFromPng } from "./png";
import { scanWorldInfo } from "./worldInfoScan";

const fixturesDir = join(process.cwd(), "test-fixtures");

function loadEmbeddedWorldInfoEntries(): PortableWorldInfoEntry[] {
  const fileName = readdirSync(fixturesDir).find((name) =>
    name.toLowerCase().endsWith(".png"),
  );

  if (!fileName) {
    throw new Error("Missing PNG card fixture.");
  }

  const card = decodeCharacterCardFromPng(readFileSync(join(fixturesDir, fileName)));

  return card.data.character_book?.entries ?? [];
}

describe("world info scan", () => {
  it("injects enabled constant and keyword matched native entries by bucket", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        uid: 1,
        key: ["unused"],
        content: "Constant before",
        constant: true,
        order: 20,
        position: 0,
      },
      {
        uid: 2,
        key: ["library"],
        content: "Keyword after",
        order: 10,
        position: 1,
      },
      {
        uid: 3,
        key: ["hidden"],
        content: "Disabled",
        disable: true,
        constant: true,
        order: 1,
        position: 0,
      },
      {
        uid: 4,
        key: ["archive"],
        content: "At depth",
        order: 15,
        position: 4,
        depth: 2,
      },
    ];

    const result = scanWorldInfo(entries, [
      "We enter the library.",
      "The archive is downstairs.",
    ]);

    expect(result.before.map((entry) => entry.content)).toEqual([
      "Constant before",
    ]);
    expect(result.after.map((entry) => entry.content)).toEqual([
      "Keyword after",
    ]);
    expect(result.atDepth).toMatchObject([
      {
        content: "At depth",
        depth: 2,
        matchedKeys: ["archive"],
        reasons: ["keyword"],
      },
    ]);
  });

  it("supports portable entries, case sensitivity, and entry scan depth", () => {
    const entries: PortableWorldInfoEntry[] = [
      {
        id: 1,
        keys: ["Needle"],
        content: "Case insensitive match",
        insertion_order: 2,
        position: "before_char",
      },
      {
        id: 2,
        keys: ["Needle"],
        content: "Case sensitive miss",
        insertion_order: 1,
        position: "before_char",
        case_sensitive: true,
      },
      {
        id: 3,
        keys: ["old clue"],
        content: "Scan depth miss",
        insertion_order: 3,
        position: "after_char",
        extensions: {
          scan_depth: 1,
        },
      },
    ];

    const result = scanWorldInfo(entries, ["old clue", "needle"]);

    expect(result.before.map((entry) => entry.content)).toEqual([
      "Case insensitive match",
    ]);
    expect(result.after).toEqual([]);
  });

  it("uses global scan depth and message objects", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["first"],
        content: "First message hit",
        order: 1,
      },
      {
        key: ["second"],
        content: "Second message hit",
        order: 2,
      },
    ];

    const result = scanWorldInfo(
      entries,
      [
        { name: "User", mes: "first" },
        { name: "Character", mes: "second" },
      ],
      { scanDepth: 1 },
    );

    expect(result.before.map((entry) => entry.content)).toEqual([
      "Second message hit",
    ]);
  });

  it("scans real embedded character book entries without mutating payload", () => {
    const entries = loadEmbeddedWorldInfoEntries();
    const originalEntries = structuredClone(entries);
    const firstKey = entries[0]?.keys[0];

    expect(firstKey).toBeTruthy();

    const result = scanWorldInfo(entries, [`mention ${firstKey}`]);
    const allScannedEntries = [
      ...result.before,
      ...result.after,
      ...result.atDepth,
    ];

    expect(allScannedEntries.length).toBeGreaterThan(0);
    expect(allScannedEntries.some((entry) => entry.matchedKeys.includes(firstKey!)))
      .toBe(true);
    expect(entries).toEqual(originalEntries);
  });
});
