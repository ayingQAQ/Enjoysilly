import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  decodeCharacterCardFromPng,
  readPngTextChunks,
  writeCharacterCardToPng,
} from "./png";

const fixturesDir = join(process.cwd(), "test-fixtures");
const characterFixturePath = join(fixturesDir, "红楼.png");

describe("PNG character card parsing", () => {
  it("reads SillyTavern chara tEXt chunks from the real card fixture", () => {
    const bytes = readFileSync(characterFixturePath);
    const textChunks = readPngTextChunks(bytes);

    expect(textChunks).toHaveLength(1);
    expect(textChunks[0]).toMatchObject({ keyword: "chara" });
  });

  it("decodes the real card fixture without losing measured fields", () => {
    const bytes = readFileSync(characterFixturePath);
    const card = decodeCharacterCardFromPng(bytes);

    expect(card.spec).toBe("chara_card_v2");
    expect(card.spec_version).toBe("2.0");
    expect(card.data.name).toBe("红楼梦世界");
    expect(card.data).toHaveProperty("avatar");
    expect(card.data.character_book?.entries).toHaveLength(10);
    expect(card.data.character_book?.entries[0]).toHaveProperty(
      "display_index",
    );
  });

  it("replaces the character card tEXt chunk while preserving image chunks", () => {
    const bytes = readFileSync(characterFixturePath);
    const card = decodeCharacterCardFromPng(bytes);
    const updatedCard = {
      ...card,
      data: {
        ...card.data,
        name: "红楼梦世界 · 往返测试",
      },
    };

    const encoded = writeCharacterCardToPng(bytes, updatedCard);
    const decoded = decodeCharacterCardFromPng(encoded);
    const textChunks = readPngTextChunks(encoded);

    expect(decoded.data.name).toBe("红楼梦世界 · 往返测试");
    expect(decoded.data).toHaveProperty("avatar");
    expect(decoded.data.character_book?.entries).toHaveLength(10);
    expect(textChunks.filter((chunk) => chunk.keyword === "chara")).toHaveLength(
      1,
    );
    expect(encoded[0]).toBe(0x89);
    expect(encoded[1]).toBe(0x50);
  });
});
