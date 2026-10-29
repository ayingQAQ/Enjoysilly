import { expect, it } from "vitest";
import { getFilteredCharacters } from "./CharacterComponents";
import type { CharacterAssetSummary } from "../../services/assetCatalog";
it("combines exact tag selection with text search rather than matching unrelated descriptions", () => {
  const base = { spec: "chara_card_v2" as const, specVersion: "2", createdAt: "a", updatedAt: "a", worldEntryCount: 0 };
  const items: CharacterAssetSummary[] = [
    { ...base, id: "a", name: "月", description: "", tags: ["冒险"] },
    { ...base, id: "b", name: "月影", description: "冒险", tags: ["日常"] },
  ];
  expect(getFilteredCharacters(items, { query: "月", tag: "冒险", showWorldLinkedOnly: false, sortMode: "name" }).map(i => i.id)).toEqual(["a"]);
});
