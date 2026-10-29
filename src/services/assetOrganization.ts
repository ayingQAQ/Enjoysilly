import { getMySillyDatabase, type MySillyDatabaseConnection } from "../lib/db";

export type AssetKind = "worlds" | "presets";
export type AssetTags = Record<string, string[]>;
export interface AssetQuery { query: string; tag: string; sort: "updated" | "name" | "created" }
export function filterAssets<T extends { id: string; name: string; updatedAt: string; createdAt?: string }>(items: T[], query: AssetQuery, tags: AssetTags): T[] {
  const needle = query.query.trim().toLocaleLowerCase();
  return items.filter(item => item.name.toLocaleLowerCase().includes(needle) && (!query.tag || tags[item.id]?.includes(query.tag)))
    .sort((a, b) => (query.sort === "name" ? a.name.localeCompare(b.name, "zh-CN")
      : query.sort === "created" ? (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      : b.updatedAt.localeCompare(a.updatedAt)) || a.id.localeCompare(b.id));
}
const prefix = (kind: AssetKind) => `assetTags:v1:${kind}:`;
export async function loadAssetTags(kind: AssetKind, database?: MySillyDatabaseConnection): Promise<AssetTags> {
  const db = database ?? await getMySillyDatabase();
  const records = await db.getAll("settings", IDBKeyRange.bound(prefix(kind), `${prefix(kind)}\uffff`));
  return Object.fromEntries(records.filter(r => Array.isArray(r.value)).map(r => [r.key.slice(prefix(kind).length), (r.value as unknown[]).filter((t): t is string => typeof t === "string")]));
}
export async function saveAssetTags(kind: AssetKind, id: string, tags: string[], database?: MySillyDatabaseConnection): Promise<string[]> {
  const normalized = [...new Set(tags.map(t => t.trim()).filter(Boolean))];
  const db = database ?? await getMySillyDatabase();
  await db.put("settings", { key: `${prefix(kind)}${id}`, value: normalized, updatedAt: new Date().toISOString() });
  return normalized;
}
