import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { decodeCharacterCardFromPng } from "./png";
import {
  nativeEntryToPortable,
  nativeWorldInfoToPortableBook,
  portableBookToNativeWorldInfo,
  portableEntryToNative,
} from "./worldInfoIO";

const fixturesDir = join(process.cwd(), "test-fixtures");

function loadCardFixture() {
  const fileName = readdirSync(fixturesDir).find((name) =>
    name.endsWith(".png"),
  );

  if (!fileName) {
    throw new Error("Missing PNG card fixture.");
  }

  return decodeCharacterCardFromPng(readFileSync(join(fixturesDir, fileName)));
}

describe("world info dialect mapping", () => {
  it("maps embedded character_book fields to native world info fields", () => {
    const card = loadCardFixture();
    const entry = card.data.character_book?.entries[0];

    expect(entry).toBeDefined();

    const native = portableEntryToNative(entry!);

    expect(native).toMatchObject({
      key: ["记"],
      uid: 0,
      order: 10,
      disable: false,
      caseSensitive: false,
      position: 0,
      displayIndex: 1,
      selectiveLogic: 0,
      probability: 100,
      useProbability: true,
      scanDepth: 2,
      matchWholeWords: true,
    });
  });

  it("converts an embedded character_book to native entries keyed by uid", () => {
    const card = loadCardFixture();
    const book = card.data.character_book;

    expect(book).toBeDefined();

    const nativeBook = portableBookToNativeWorldInfo(book!);

    expect(Object.keys(nativeBook.entries)).toHaveLength(10);
    expect(nativeBook.entries["0"].key).toEqual(["记"]);
    expect(nativeBook.entries["0"].disable).toBe(false);
  });

  it("maps native world info fields back to portable character_book fields", () => {
    const portable = nativeEntryToPortable({
      uid: 42,
      key: ["潇湘馆"],
      keysecondary: ["竹影"],
      content: "林黛玉居所。",
      order: 7,
      disable: true,
      caseSensitive: true,
      position: 1,
      displayIndex: 5,
      probability: 80,
      useProbability: true,
      scanDepth: 3,
      matchWholeWords: false,
    });

    expect(portable).toMatchObject({
      keys: ["潇湘馆"],
      secondary_keys: ["竹影"],
      insertion_order: 7,
      enabled: false,
      case_sensitive: true,
      position: "after_char",
      id: 42,
      display_index: 5,
      extensions: {
        position: 1,
        probability: 80,
        useProbability: true,
        scan_depth: 3,
        match_whole_words: false,
      },
    });
  });

  it("converts native world info books to portable entry arrays", () => {
    const portableBook = nativeWorldInfoToPortableBook({
      entries: {
        "2": {
          uid: 2,
          key: ["后"],
          content: "second",
          order: 20,
          disable: false,
        },
        "1": {
          uid: 1,
          key: ["先"],
          content: "first",
          order: 10,
          disable: true,
        },
      },
    });

    expect(portableBook.entries.map((entry) => entry.id)).toEqual([1, 2]);
    expect(portableBook.entries[0]).toMatchObject({
      keys: ["先"],
      enabled: false,
    });
  });
});
