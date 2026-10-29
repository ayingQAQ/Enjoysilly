import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { deleteDB } from "idb";
import { zipSync, unzipSync } from "fflate";
import { openMySillyDatabase, savePreset, saveWorldInfo, listPresets, listWorlds } from "../lib/db";
import { createBackupZip } from "./backupExport";
import { restoreFromBackupZip } from "./backupImport";
import { saveAssetTags, loadAssetTags } from "./assetOrganization";

it.each([false, true])("remaps local tags to restored asset IDs even with settings first=%s", async settingsFirst => {
  const sourceName = `tag-src-${crypto.randomUUID()}`, targetName = `tag-target-${crypto.randomUUID()}`;
  const source = await openMySillyDatabase(sourceName), target = await openMySillyDatabase(targetName);
  try {
    await savePreset({ id: "old-p", name: "P", createdAt: "a", updatedAt: "a", payload: { prompts: [], prompt_order: [] } }, source);
    await saveWorldInfo({ id: "old-w", name: "W", createdAt: "a", updatedAt: "a", payload: { entries: {} } }, source);
    await saveAssetTags("presets", "old-p", ["冒险"], source);
    await saveAssetTags("worlds", "old-w", ["中文🌙"], source);
    await saveAssetTags("presets", "old-p", ["保留目标数据"], target);
    let bytes = await createBackupZip(source);
    if (settingsFirst) {
      const entries = Object.entries(unzipSync(bytes)).sort(([a], [b]) => Number(b.startsWith("settings/")) - Number(a.startsWith("settings/")));
      bytes = zipSync(Object.fromEntries(entries));
    }
    const result = await restoreFromBackupZip(bytes, target);
    expect(result.errors).toEqual([]);
    const presets = await listPresets(target), worlds = await listWorlds(target);
    expect(presets[0].id).not.toBe("old-p");
    expect((await loadAssetTags("presets", target))[presets[0].id]).toEqual(["冒险"]);
    expect((await loadAssetTags("worlds", target))[worlds[0].id]).toEqual(["中文🌙"]);
    expect((await loadAssetTags("presets", target))["old-p"]).toEqual(["保留目标数据"]);
  } finally { source.close(); target.close(); await deleteDB(sourceName); await deleteDB(targetName); }
});
it.each(["missing", "invalid"])("does not attach orphan tags to existing assets after %s asset restore", async mode => {
  const sourceName = `tag-src-${crypto.randomUUID()}`, targetName = `tag-target-${crypto.randomUUID()}`;
  const source = await openMySillyDatabase(sourceName), target = await openMySillyDatabase(targetName);
  try {
    await savePreset({ id: "old", name: "P", createdAt: "a", updatedAt: "a", payload: { prompts: [], prompt_order: [] } }, source);
    await saveAssetTags("presets", "old", ["备份标签"], source);
    await saveAssetTags("presets", "old", ["已有标签"], target);
    const files = unzipSync(await createBackupZip(source));
    const path = Object.keys(files).find(p => p.startsWith("presets/"))!;
    if (mode === "missing") delete files[path]; else files[path] = new TextEncoder().encode("not-json");
    const result = await restoreFromBackupZip(zipSync(files), target);
    expect(result.errors.some(e => e.includes("标签") && e.includes("未恢复"))).toBe(true);
    expect(await loadAssetTags("presets", target)).toEqual({ old: ["已有标签"] });
  } finally { source.close(); target.close(); await deleteDB(sourceName); await deleteDB(targetName); }
});
