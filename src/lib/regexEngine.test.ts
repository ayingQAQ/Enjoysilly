import { describe, expect, it } from "vitest";

import {
  executeRegexScript,
  executeRegexScripts,
  executeRegexScriptsAsync,
} from "./regexEngine";

describe("regexEngine", () => {
  describe("executeRegexScript", () => {
    it("replaces text using findRegex and replaceString", () => {
      const result = executeRegexScript("hello world", {
        findRegex: "world",
        replaceString: "there",
      });

      expect(result.text).toBe("hello there");
      expect(result.error).toBeUndefined();
    });

    it("replaces {{match}} with the full match", () => {
      const result = executeRegexScript("say hello", {
        findRegex: "hello",
        replaceString: "_{{match}}_",
      });

      expect(result.text).toBe("say _hello_");
    });

    it("replaces $1 with the first capture group", () => {
      const result = executeRegexScript("Name: Alice", {
        findRegex: "Name: (\\w+)",
        replaceString: "User: $1",
      });

      expect(result.text).toBe("User: Alice");
    });

    it("replaces $1 and higher capture groups", () => {
      const result = executeRegexScript("swap: first, second", {
        findRegex: "swap: (\\w+), (\\w+)",
        replaceString: "$2, $1",
      });

      expect(result.text).toBe("second, first");
    });

    it("replaces non-existent capture groups with empty string", () => {
      const result = executeRegexScript("hello", {
        findRegex: "(hello)",
        replaceString: "$1 $2 $3",
      });

      expect(result.text).toBe("hello  ");
    });

    it("applies trimStrings to strip spaces from the replacement result", () => {
      const result = executeRegexScript("before  hello world  after", {
        findRegex: "\\s*hello world\\s*",
        replaceString: "{{match}}",
        trimStrings: [" ", "\n"],
      });

      expect(result.text).toBe("beforehello worldafter");
    });

    it("handles global flag - replaces all occurrences", () => {
      const result = executeRegexScript("a a a", {
        findRegex: "a",
        replaceString: "b",
      });

      expect(result.text).toBe("b b b");
    });

    it("parses ST regex literal strings and preserves flags", () => {
      const result = executeRegexScript("Hello\nWORLD", {
        findRegex: "/hello\\nworld/i",
        replaceString: "matched",
      });

      expect(result.text).toBe("matched");
    });

    it("parses escaped slashes in ST regex literal strings", () => {
      const result = executeRegexScript("path a/b and a/b", {
        findRegex: "/a\\/b/g",
        replaceString: "slash",
      });

      expect(result.text).toBe("path slash and slash");
    });

    it("returns original text for empty findRegex", () => {
      const result = executeRegexScript("hello", {
        findRegex: "",
        replaceString: "x",
      });

      expect(result.text).toBe("hello");
    });

    it("returns original text for empty replaceString", () => {
      const result = executeRegexScript("hello world", {
        findRegex: "world",
        replaceString: "",
      });

      expect(result.text).toBe("hello ");
    });

    it("returns error for invalid regex", () => {
      const result = executeRegexScript("hello", {
        findRegex: "[",
        replaceString: "x",
      });

      expect(result.text).toBe("hello");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Invalid findRegex");
    });

    it("handles multiline matching", () => {
      const result = executeRegexScript("line1\nline2\nline3", {
        findRegex: "^line(\\d)",
        replaceString: "row$1",
      });

      expect(result.text).toBe("row1\nrow2\nrow3");
    });
  });

  describe("executeRegexScripts", () => {
    it("applies multiple scripts in sequence", () => {
      const result = executeRegexScripts("hello world", [
        { findRegex: "hello", replaceString: "hi" },
        { findRegex: "world", replaceString: "everyone" },
      ]);

      expect(result.text).toBe("hi everyone");
      expect(result.applied).toHaveLength(2);
    });

    it("skips disabled scripts", () => {
      const result = executeRegexScripts("hello world", [
        { findRegex: "hello", replaceString: "hi", disabled: true },
        { findRegex: "world", replaceString: "everyone" },
      ]);

      expect(result.text).toBe("hello everyone");
      expect(result.applied).toHaveLength(1);
    });

    it("filters by placement when options.placement is set", () => {
      const result = executeRegexScripts(
        "input text",
        [
          { findRegex: "input", replaceString: "output", placement: [2] },
          {
            findRegex: "text",
            replaceString: "message",
            placement: [1],
          },
        ],
        { placement: 1 },
      );

      expect(result.text).toBe("input message");
    });

    it("filters by promptOnly and markdownOnly execution context", () => {
      const result = executeRegexScripts(
        "alpha beta gamma",
        [
          { findRegex: "alpha", replaceString: "A", promptOnly: true },
          { findRegex: "beta", replaceString: "B", markdownOnly: true },
          { findRegex: "gamma", replaceString: "G" },
        ],
        {
          promptOnly: false,
          markdownOnly: false,
        },
      );

      expect(result.text).toBe("alpha beta G");
    });

    it("runs all scripts when placement is not set", () => {
      const result = executeRegexScripts("hello", [
        { findRegex: "hello", replaceString: "world", placement: [1] },
        { findRegex: "world", replaceString: "!", placement: [2] },
      ]);

      expect(result.text).toBe("!");
    });

    it("collects errors without stopping execution", () => {
      const result = executeRegexScripts("hello world", [
        { findRegex: "[", replaceString: "x", scriptName: "bad1" },
        { findRegex: "world", replaceString: "there", scriptName: "good" },
        { findRegex: "[", replaceString: "x", scriptName: "bad2" },
      ]);

      expect(result.text).toBe("hello there");
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].scriptName).toBe("bad1");
      expect(result.errors[1].scriptName).toBe("bad2");
    });

    it("uses fallback name for scripts without scriptName", () => {
      const result = executeRegexScripts("hello", [
        { findRegex: "[", replaceString: "x" },
      ]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].scriptName).toBe("未命名正则 #1");
    });

    it("tracks applied scripts correctly", () => {
      const result = executeRegexScripts("hello world", [
        { findRegex: "hello", replaceString: "hi", id: "s1" },
        { findRegex: "nothing", replaceString: "x", id: "s2" },
        { findRegex: "world", replaceString: "earth", id: "s3" },
      ]);

      expect(result.applied).toHaveLength(2);
      expect(result.applied[0].id).toBe("s1");
      expect(result.applied[1].id).toBe("s3");
    });

    it("replaces __match__ placeholder across multiple scripts", () => {
      const result = executeRegexScripts("say hello", [
        {
          findRegex: "hello",
          replaceString: "_{{match}}_",
        },
        {
          findRegex: "_hello_",
          replaceString: "[{{match}}]",
        },
      ]);

      expect(result.text).toBe("say [_hello_]");
    });
  });

  describe("executeRegexScriptsAsync", () => {
    it("applies regex scripts asynchronously with placement filter", async () => {
      const result = await executeRegexScriptsAsync("hello world", [
        { findRegex: "hello", replaceString: "hi" },
        { findRegex: "world", replaceString: "everyone" },
      ]);

      expect(result.text).toBe("hi everyone");
      expect(result.applied).toHaveLength(2);
    });

    it("collects errors from invalid regex", async () => {
      const result = await executeRegexScriptsAsync("hello world", [
        { findRegex: "[", replaceString: "x", scriptName: "bad" },
        { findRegex: "world", replaceString: "there" },
      ]);

      expect(result.text).toBe("hello there");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].scriptName).toBe("bad");
    });
  });
});
