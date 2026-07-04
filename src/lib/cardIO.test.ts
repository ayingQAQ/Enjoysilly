import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  encodeCharacterCardJson,
  exportCharacterCardToPng,
  importCharacterCardFromBytes,
  isCharacterCard,
  parseCharacterCardJson,
  serializeCharacterCardJson,
} from "./cardIO";

const fixturesDir = join(process.cwd(), "test-fixtures");

function findFixture(extension: string): string {
  const fileName = readdirSync(fixturesDir).find((name) =>
    name.endsWith(extension),
  );

  if (!fileName) {
    throw new Error(`Missing ${extension} fixture.`);
  }

  return join(fixturesDir, fileName);
}

describe("character card IO", () => {
  it("imports a PNG character card through the unified entry point", () => {
    const filePath = findFixture(".png");
    const imported = importCharacterCardFromBytes(
      readFileSync(filePath),
      "红楼.png",
    );

    expect(imported.format).toBe("png");
    expect(imported.card.data.name).toBe("红楼梦世界");
    expect(imported.card.data.character_book?.entries).toHaveLength(10);
  });

  it("parses character card JSON while preserving unknown fields", () => {
    const source = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "测试角色",
        description: "描述",
        avatar: "avatar.png",
        extensions: {
          custom: true,
        },
      },
      unknownRoot: "keep",
    };

    const parsed = parseCharacterCardJson(JSON.stringify(source));

    expect(isCharacterCard(parsed)).toBe(true);
    expect(parsed).toEqual(source);
  });

  it("serializes character card JSON without dropping unknown fields", () => {
    const source = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "测试角色",
        avatar: "avatar.png",
        extensions: {
          custom: true,
        },
      },
      unknownRoot: "keep",
    };
    const parsed = parseCharacterCardJson(JSON.stringify(source));
    const serialized = serializeCharacterCardJson(parsed);
    const encoded = encodeCharacterCardJson(parsed);

    expect(JSON.parse(serialized)).toEqual(source);
    expect(new TextDecoder().decode(encoded)).toBe(serialized);
  });

  it("exports a PNG character card through the card IO layer", () => {
    const filePath = findFixture(".png");
    const bytes = readFileSync(filePath);
    const imported = importCharacterCardFromBytes(bytes, "红楼.png");
    const updated = {
      ...imported.card,
      data: {
        ...imported.card.data,
        name: "红楼梦世界 · cardIO",
      },
    };

    const exported = exportCharacterCardToPng(bytes, updated);
    const reimported = importCharacterCardFromBytes(exported, "红楼.png");

    expect(reimported.card.data.name).toBe("红楼梦世界 · cardIO");
    expect(reimported.card.data.character_book?.entries).toHaveLength(10);
  });
});
