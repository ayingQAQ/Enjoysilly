import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { loadAssetStats } from "../lib/assetStats";
import { getCharacter, getPreset, getWorldInfo, openMySillyDatabase } from "../lib/db";
import {
  bundledSampleIds,
  importBundledSamplesToDatabase,
} from "./sampleImport";

const fixturesDir = join(process.cwd(), "test-fixtures");
const fixedNow = "2026-07-04T10:00:00.000Z";
const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_sample_import_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

async function fetchFixtureBytes(path: string): Promise<Uint8Array> {
  const fileName = decodeURIComponent(path.split("/").at(-1) ?? "");

  if (!fileName) {
    throw new Error(`Invalid fixture path: ${path}`);
  }

  return readFileSync(join(fixturesDir, fileName));
}

describe("bundled sample import service", () => {
  it("imports real bundled samples and embedded world info idempotently", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());

    const firstImport = await importBundledSamplesToDatabase({
      database,
      fetchBytes: fetchFixtureBytes,
      now: () => fixedNow,
    });

    expect(firstImport.results.map((result) => result.assetKind).sort()).toEqual([
      "character",
      "preset",
      "world",
    ]);
    expect(firstImport.worldInfo?.worldInfo.entries).toHaveLength(10);

    await expect(
      getCharacter(bundledSampleIds.character, database),
    ).resolves.toMatchObject({
      id: bundledSampleIds.character,
      name: "红楼梦世界",
      createdAt: fixedNow,
      updatedAt: fixedNow,
    });
    await expect(getPreset(bundledSampleIds.preset, database)).resolves.toMatchObject({
      id: bundledSampleIds.preset,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    });
    await expect(getWorldInfo(bundledSampleIds.world, database)).resolves.toMatchObject({
      id: bundledSampleIds.world,
      name: "红楼梦世界 · 内嵌世界书",
      createdAt: fixedNow,
      updatedAt: fixedNow,
    });

    await expect(loadAssetStats(database)).resolves.toEqual({
      characters: 1,
      presets: 1,
      worlds: 1,
      chats: 0,
      regexScripts: 10,
      worldEntries: 10,
    });

    await importBundledSamplesToDatabase({
      database,
      fetchBytes: fetchFixtureBytes,
      now: () => fixedNow,
    });

    await expect(loadAssetStats(database)).resolves.toEqual({
      characters: 1,
      presets: 1,
      worlds: 1,
      chats: 0,
      regexScripts: 10,
      worldEntries: 10,
    });

    database.close();
  });
});
