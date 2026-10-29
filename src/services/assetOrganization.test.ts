import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { deleteDB } from "idb";
import { openMySillyDatabase, savePreset, getPreset } from "../lib/db";
import { filterAssets, loadAssetTags, saveAssetTags } from "./assetOrganization";

it("combines name and tag filters and sorts deterministically without mutating input", () => {
  const assets = [
    { id: "b", name: "月🌙 Beta", updatedAt: "2026-02" },
    { id: "a", name: "月🌙 Alpha", updatedAt: "2026-01" },
    { id: "c", name: "Other", updatedAt: "2026-03" },
  ];
  expect(filterAssets(assets, { query: " 月🌙 ", tag: "冒险", sort: "name" }, { a: ["冒险"], b: ["冒险"] }).map(a => a.id)).toEqual(["a", "b"]);
  expect(filterAssets(assets, { query: "BETA", tag: "", sort: "updated" }, {}).map(a => a.id)).toEqual(["b"]);
  expect(filterAssets(assets, { query: "", tag: "missing", sort: "updated" }, {})).toEqual([]);
  expect(assets.map(a => a.id)).toEqual(["b", "a", "c"]);
});
it("stores normalized local tags independently, preserving ST payload and other assets", async () => {
  const name = `tags-${crypto.randomUUID()}`;
  const db = await openMySillyDatabase(name);
  try {
    const preset = { id: "p", name: "P", createdAt: "a", updatedAt: "a", payload: { prompts: [], prompt_order: [], extensions: { custom: true } } };
    await savePreset(preset, db);
    await Promise.all([saveAssetTags("presets", "p", [" 冒险 ", "冒险", ""], db), saveAssetTags("presets", "q", ["日常"], db)]);
    expect(await loadAssetTags("presets", db)).toEqual({ p: ["冒险"], q: ["日常"] });
    expect(await getPreset("p", db)).toEqual(preset);
  } finally { db.close(); await deleteDB(name); }
});
