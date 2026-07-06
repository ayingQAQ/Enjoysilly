import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import {
  getRegexScript,
  openMySillyDatabase,
  resetDatabaseConnectionForTests,
} from "../lib/db";
import {
  createRegexScriptExport,
  importRegexScript,
  importRegexScriptToDatabase,
} from "./regexImport";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  resetDatabaseConnectionForTests();

  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_regex_import_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("regexImport", () => {
  it("creates stored regex entities without mutating the parsed script", () => {
    const json = JSON.stringify({
      scriptName: "导入正则",
      findRegex: "hello",
      replaceString: "world",
      placement: [1],
      extraField: "keep",
    });

    const [result] = importRegexScript(json, "regex.json", {
      characterId: "char-1",
    });

    expect(result.script).toEqual(
      expect.objectContaining({
        scriptName: "导入正则",
        extraField: "keep",
      }),
    );
    expect(result.stored).toEqual(
      expect.objectContaining({
        name: "导入正则",
        characterId: "char-1",
        payload: result.script,
      }),
    );
  });

  it("imports regex scripts into the injected database", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const [result] = await importRegexScriptToDatabase(
      JSON.stringify({
        scriptName: "数据库正则",
        findRegex: "hello",
        replaceString: "world",
      }),
      "regex.json",
      {
        database,
      },
    );

    await expect(getRegexScript(result.stored.id, database)).resolves.toEqual(
      result.stored,
    );

    database.close();
  });

  it("exports one ST regex script as JSON bytes", () => {
    const artifact = createRegexScriptExport({
      scriptName: "导出正则",
      findRegex: "hello",
      replaceString: "world",
    });

    expect(artifact.fileName).toBe("导出正则.json");
    expect(JSON.parse(new TextDecoder().decode(artifact.bytes))).toEqual({
      scriptName: "导出正则",
      findRegex: "hello",
      replaceString: "world",
    });
  });
});
