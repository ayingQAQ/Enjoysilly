import { describe, expect, it } from "vitest";

import {
  createRegexScriptFileName,
  parseRegexScriptsJson,
  serializeRegexScriptsJson,
} from "./regexIO";

describe("regexIO", () => {
  it("parses a single ST regex script while preserving unknown fields", () => {
    const parsed = parseRegexScriptsJson(
      JSON.stringify({
        scriptName: "思考",
        findRegex: "/<thought>([\\s\\S]*?)<\\/thought>/g",
        replaceString: "<details>$1</details>",
        placement: [2],
        disabled: false,
        customField: {
          keep: true,
        },
      }),
    );

    expect(parsed.warnings).toEqual([]);
    expect(parsed.scripts).toEqual([
      expect.objectContaining({
        scriptName: "思考",
        findRegex: "/<thought>([\\s\\S]*?)<\\/thought>/g",
        replaceString: "<details>$1</details>",
        placement: [2],
        customField: {
          keep: true,
        },
      }),
    ]);
  });

  it("skips malformed entries in an array and reports warnings", () => {
    const parsed = parseRegexScriptsJson(
      JSON.stringify([
        null,
        {
          scriptName: "有效正则",
          findRegex: "hello",
          replaceString: "world",
        },
      ]),
    );

    expect(parsed.warnings).toEqual([
      "Regex script entry 0 is not an object, skipping.",
    ]);
    expect(parsed.scripts).toHaveLength(1);
    expect(parsed.scripts[0].scriptName).toBe("有效正则");
  });

  it("serializes one script as a single object and keeps unknown fields", () => {
    const json = serializeRegexScriptsJson([
      {
        scriptName: "导出正则",
        findRegex: "hello",
        replaceString: "world",
        unknownField: "keep",
      },
    ]);

    expect(JSON.parse(json)).toEqual({
      scriptName: "导出正则",
      findRegex: "hello",
      replaceString: "world",
      unknownField: "keep",
    });
  });

  it("creates safe file names from script names", () => {
    expect(
      createRegexScriptFileName({
        scriptName: 'a<b>:"/\\|?*',
        findRegex: "x",
      }),
    ).toBe("a_b________.json");
  });
});
