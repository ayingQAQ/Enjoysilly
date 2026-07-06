import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import {
  getQuickReplySet,
  openMySillyDatabase,
  resetDatabaseConnectionForTests,
} from "../lib/db";
import {
  createQuickReplySetExport,
  createStoredQuickReplySet,
  importQuickReplySetToDatabase,
} from "./quickReplyImport";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  resetDatabaseConnectionForTests();

  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_quick_reply_import_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("quickReplyImport", () => {
  it("creates stored quick reply sets with normalized names", () => {
    const stored = createStoredQuickReplySet(
      {
        name: "测试快捷回复",
        version: "2",
        qrList: [{ label: "问候", message: "你好" }],
      },
      "fallback.json",
    );

    expect(stored).toEqual(
      expect.objectContaining({
        name: "测试快捷回复",
        payload: expect.objectContaining({
          qrList: [{ label: "问候", message: "你好" }],
        }),
      }),
    );
  });

  it("imports a Quick Reply v2 set into the injected database", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const result = await importQuickReplySetToDatabase(
      JSON.stringify({
        version: 2,
        name: "数据库快捷回复",
        qrList: [{ label: "问候", message: "你好" }],
        unknownTop: "keep",
      }),
      "quick.json",
      {
        database,
      },
    );

    await expect(getQuickReplySet(result.stored.id, database)).resolves.toEqual(
      expect.objectContaining({
        name: "数据库快捷回复",
        payload: expect.objectContaining({
          unknownTop: "keep",
        }),
      }),
    );

    database.close();
  });

  it("exports a Quick Reply v2 set as JSON bytes", () => {
    const artifact = createQuickReplySetExport({
      name: "导出快捷回复",
      version: 2,
      qrList: [{ label: "问候", message: "你好" }],
    });

    expect(artifact.fileName).toBe("导出快捷回复.json");
    expect(JSON.parse(new TextDecoder().decode(artifact.bytes))).toEqual({
      name: "导出快捷回复",
      version: 2,
      qrList: [{ label: "问候", message: "你好" }],
    });
  });
});
