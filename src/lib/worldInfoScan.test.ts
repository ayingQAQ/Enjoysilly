import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { NativeWorldInfoEntry, PortableWorldInfoEntry } from "../types/worldinfo";
import { decodeCharacterCardFromPng } from "./png";
import { estimateTextTokens } from "./tokenEstimate";
import { scanWorldInfo } from "./worldInfoScan";

const fixturesDir = join(process.cwd(), "test-fixtures");

function loadEmbeddedWorldInfoEntries(): PortableWorldInfoEntry[] {
  const card = decodeCharacterCardFromPng(
    readFileSync(join(fixturesDir, "红楼.png")),
  );

  return card.data.character_book?.entries ?? [];
}

describe("world info scan", () => {
  it("injects enabled constant and keyword matched native entries by bucket", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        uid: 1,
        key: ["unused"],
        content: "Constant before",
        constant: true,
        order: 20,
        position: 0,
      },
      {
        uid: 2,
        key: ["library"],
        content: "Keyword after",
        order: 10,
        position: 1,
      },
      {
        uid: 3,
        key: ["hidden"],
        content: "Disabled",
        disable: true,
        constant: true,
        order: 1,
        position: 0,
      },
      {
        uid: 4,
        key: ["archive"],
        content: "At depth",
        order: 15,
        position: 4,
        depth: 2,
      },
    ];

    const result = scanWorldInfo(entries, [
      "We enter the library.",
      "The archive is downstairs.",
    ]);

    expect(result.before.map((entry) => entry.content)).toEqual([
      "Constant before",
    ]);
    expect(result.after.map((entry) => entry.content)).toEqual([
      "Keyword after",
    ]);
    expect(result.atDepth).toMatchObject([
      {
        content: "At depth",
        depth: 2,
        matchedKeys: ["archive"],
        reasons: ["keyword"],
      },
    ]);
  });

  it("supports portable entries, case sensitivity, and entry scan depth", () => {
    const entries: PortableWorldInfoEntry[] = [
      {
        id: 1,
        keys: ["Needle"],
        content: "Case insensitive match",
        insertion_order: 2,
        position: "before_char",
      },
      {
        id: 2,
        keys: ["Needle"],
        content: "Case sensitive miss",
        insertion_order: 1,
        position: "before_char",
        case_sensitive: true,
      },
      {
        id: 3,
        keys: ["old clue"],
        content: "Scan depth miss",
        insertion_order: 3,
        position: "after_char",
        extensions: {
          scan_depth: 1,
        },
      },
    ];

    const result = scanWorldInfo(entries, ["old clue", "needle"]);

    expect(result.before.map((entry) => entry.content)).toEqual([
      "Case insensitive match",
    ]);
    expect(result.after).toEqual([]);
  });

  it("uses global scan depth and message objects", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["first"],
        content: "First message hit",
        order: 1,
      },
      {
        key: ["second"],
        content: "Second message hit",
        order: 2,
      },
    ];

    const result = scanWorldInfo(
      entries,
      [
        { name: "User", mes: "first" },
        { name: "Character", mes: "second" },
      ],
      { scanDepth: 1 },
    );

    expect(result.before.map((entry) => entry.content)).toEqual([
      "Second message hit",
    ]);
  });

  it("scans real embedded character book entries without mutating payload", () => {
    const entries = loadEmbeddedWorldInfoEntries();
    const originalEntries = structuredClone(entries);
    const firstKey = entries[0]?.keys[0];

    expect(firstKey).toBeTruthy();

    const result = scanWorldInfo(entries, [`mention ${firstKey}`]);
    const allScannedEntries = [
      ...result.before,
      ...result.after,
      ...result.atDepth,
    ];

    expect(allScannedEntries.length).toBeGreaterThan(0);
    expect(allScannedEntries.some((entry) => entry.matchedKeys.includes(firstKey!)))
      .toBe(true);
    expect(entries).toEqual(originalEntries);
  });
});

describe("selective / secondary keys", () => {
  it("ignores secondary keys when enabledFeatures.selective is not set", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["hello"],
        keysecondary: ["secret"],
        selective: true,
        selectiveLogic: 3,
        content: "matched",
        order: 0,
        position: 0,
      },
    ];

    const result = scanWorldInfo(entries, ["hello"]);
    expect(result.before).toHaveLength(1);
  });

  it("rejects entry when selectiveLogic AND_ALL fails because not all secondaries match", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["hello"],
        keysecondary: ["secret", "hidden"],
        selective: true,
        selectiveLogic: 3,
        content: "blocked",
        order: 0,
        position: 0,
      },
    ];

    const result = scanWorldInfo(entries, ["hello world"], {
      enabledFeatures: { selective: true },
    });

    expect(result.before).toHaveLength(0);
  });

  it("accepts entry when selectiveLogic AND_ALL passes with all secondaries matched", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["hello"],
        keysecondary: ["secret"],
        selective: true,
        selectiveLogic: 3,
        content: "passed",
        order: 0,
        position: 0,
      },
    ];

    const result = scanWorldInfo(entries, ["hello secret"], {
      enabledFeatures: { selective: true },
    });

    expect(result.before).toHaveLength(1);
  });

  it("rejects when selectiveLogic NOT_ANY blocks matched secondary", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["hello"],
        keysecondary: ["forbidden"],
        selective: true,
        selectiveLogic: 2,
        content: "blocked",
        order: 0,
        position: 0,
      },
    ];

    const result = scanWorldInfo(entries, ["hello forbidden text"], {
      enabledFeatures: { selective: true },
    });

    expect(result.before).toHaveLength(0);
  });

  it("accepts when selectiveLogic NOT_ANY passes with no secondaries matched", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["hello"],
        keysecondary: ["forbidden"],
        selective: true,
        selectiveLogic: 2,
        content: "passed",
        order: 0,
        position: 0,
      },
    ];

    const result = scanWorldInfo(entries, ["hello world"], {
      enabledFeatures: { selective: true },
    });

    expect(result.before).toHaveLength(1);
  });

  it("accepts when selectiveLogic AND_ANY has at least one secondary matched", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["hello"],
        keysecondary: ["a", "b", "c"],
        selective: true,
        selectiveLogic: 0,
        content: "passed",
        order: 0,
        position: 0,
      },
    ];

    const result = scanWorldInfo(entries, ["hello b"], {
      enabledFeatures: { selective: true },
    });

    expect(result.before).toHaveLength(1);
  });

  it("supports portable secondary_keys via enabledFeatures", () => {
    const entries: PortableWorldInfoEntry[] = [
      {
        keys: ["hello"],
        secondary_keys: ["secret"],
        selective: true,
        content: "passed",
        // Portable doesn't have selectiveLogic in standard fields, but it can be in extensions
        extensions: { selectiveLogic: 3 },
      },
    ];

    const result = scanWorldInfo(entries, ["hello secret"], {
      enabledFeatures: { selective: true },
    });

    expect(result.before).toHaveLength(1);
  });
});

describe("probability", () => {
  it("always triggers when useProbability is false (default behavior)", () => {
    const entries: NativeWorldInfoEntry[] = [
      { key: ["hello"], content: "always", order: 0, position: 0 },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { probability: true },
    });

    expect(result.before).toHaveLength(1);
  });

  it("triggers when useProbability is true and probability is 100", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["hello"],
        content: "triggered",
        order: 0,
        position: 0,
        useProbability: true,
        probability: 100,
      },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { probability: true },
      random: () => 0,
    });

    expect(result.before).toHaveLength(1);
  });

  it("rejects entry when probability evaluates to false via injected random", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["hello"],
        content: "blocked",
        order: 0,
        position: 0,
        useProbability: true,
        probability: 50,
      },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { probability: true },
      random: () => 0.51,
    });

    expect(result.before).toHaveLength(0);
  });

  it("accepts entry when random just below probability threshold", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["hello"],
        content: "passed",
        order: 0,
        position: 0,
        useProbability: true,
        probability: 50,
      },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { probability: true },
      random: () => 0.49,
    });

    expect(result.before).toHaveLength(1);
  });

  it("rejects entry when probability is 0", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: ["hello"],
        content: "never",
        order: 0,
        position: 0,
        useProbability: true,
        probability: 0,
      },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { probability: true },
    });

    expect(result.before).toHaveLength(0);
  });

  it("applies probability to constant entries when probability feature is enabled", () => {
    const entries: NativeWorldInfoEntry[] = [
      {
        key: [],
        constant: true,
        content: "constant but disabled by probability",
        order: 0,
        position: 0,
        useProbability: true,
        probability: 0,
      },
    ];

    const result = scanWorldInfo(entries, ["anything"], {
      enabledFeatures: { probability: true },
    });

    expect(result.before).toHaveLength(0);
  });
});

describe("recursion", () => {
  it("does not recurse when enabledFeatures.recursion is not set", () => {
    const entries: NativeWorldInfoEntry[] = [
      { key: ["hello"], content: "first", order: 0, position: 0 },
      { key: ["first"], content: "second", order: 1, position: 0 },
    ];

    const result = scanWorldInfo(entries, ["hello"]);

    expect(result.before).toHaveLength(1);
    expect(result.before[0].content).toBe("first");
  });

  it("recursively triggers entry B when A content triggers B", () => {
    const entries: NativeWorldInfoEntry[] = [
      { key: ["hello"], content: "first", order: 0, position: 0 },
      { key: ["first"], content: "second", order: 1, position: 0 },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { recursion: true },
    });

    expect(result.before).toHaveLength(2);
  });

  it("stops recursion at specified recursionDepth", () => {
    const entries: NativeWorldInfoEntry[] = [
      { key: ["a"], content: "b", order: 0, position: 0 },
      { key: ["b"], content: "c", order: 1, position: 0 },
      { key: ["c"], content: "d", order: 2, position: 0 },
    ];

    const result = scanWorldInfo(entries, ["a"], {
      enabledFeatures: { recursion: true },
      recursionDepth: 1,
    });

    expect(result.before).toHaveLength(2);
  });

  it("does not trigger excluded recursion content", () => {
    const entries: NativeWorldInfoEntry[] = [
      { key: ["hello"], content: "trigger", order: 0, position: 0, excludeRecursion: true },
      { key: ["trigger"], content: "should not trigger", order: 1, position: 0 },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { recursion: true },
    });

    expect(result.before).toHaveLength(1);
  });

  it("supports portable exclude_recursion extension when blocking recursion content", () => {
    const entries: PortableWorldInfoEntry[] = [
      {
        keys: ["hello"],
        content: "trigger",
        insertion_order: 0,
        position: "before_char",
        extensions: { exclude_recursion: true },
      },
      {
        keys: ["trigger"],
        content: "should not trigger",
        insertion_order: 1,
        position: "before_char",
      },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { recursion: true },
    });

    expect(result.before).toHaveLength(1);
    expect(result.before[0].content).toBe("trigger");
  });

  it("does not trigger preventRecursion entry via recursion", () => {
    const entries: NativeWorldInfoEntry[] = [
      { key: ["hello"], content: "trigger", order: 0, position: 0 },
      { key: ["trigger"], content: "blocked", order: 1, position: 0, preventRecursion: true },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { recursion: true },
    });

    expect(result.before).toHaveLength(1);
  });

  it("delayUntilRecursion entries are not triggered in first round", () => {
    const entries: NativeWorldInfoEntry[] = [
      { key: ["hello"], content: "trigger", order: 0, position: 0, delayUntilRecursion: true },
      { key: ["trigger"], content: "should not fire", order: 1, position: 0 },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { recursion: true },
    });

    expect(result.before).toHaveLength(0);
  });

  it("supports portable delay_until_recursion extension in recursive rounds", () => {
    const entries: PortableWorldInfoEntry[] = [
      {
        keys: ["hello"],
        content: "trigger",
        insertion_order: 0,
        position: "before_char",
      },
      {
        keys: ["trigger"],
        content: "delayed recursive hit",
        insertion_order: 1,
        position: "before_char",
        extensions: { delay_until_recursion: true },
      },
    ];

    const result = scanWorldInfo(entries, ["hello"], {
      enabledFeatures: { recursion: true },
    });

    expect(result.before).toHaveLength(2);
    expect(result.before[1].content).toBe("delayed recursive hit");
  });
});

describe("token budget", () => {
  it("includes all entries when budget is not set", () => {
    const entries: NativeWorldInfoEntry[] = [
      { key: ["hello"], content: "first entry content", order: 0, position: 0 },
      { key: ["world"], content: "second entry", order: 1, position: 0 },
    ];

    const result = scanWorldInfo(entries, ["hello world"]);
    expect(result.before).toHaveLength(2);
  });

  it("excludes entries exceeding token budget", () => {
    const entries: NativeWorldInfoEntry[] = [
      { key: ["hello"], content: "short", order: 0, position: 0 },
      { key: ["world"], content: "a much longer text that uses more tokens", order: 1, position: 0 },
    ];

    const result = scanWorldInfo(entries, ["hello world"], {
      enabledFeatures: { tokenBudget: true },
      tokenBudget: 3,
      estimateTokens: estimateTextTokens,
    });

    expect(result.before).toHaveLength(1);
    expect(result.before[0].content).toBe("short");
  });

  it("respects order when applying budget", () => {
    const entries: NativeWorldInfoEntry[] = [
      { key: ["hello"], content: "short", order: 10, position: 0 },
      { key: ["world"], content: "short", order: 1, position: 0 },
    ];

    const result = scanWorldInfo(entries, ["hello world"], {
      enabledFeatures: { tokenBudget: true },
      tokenBudget: 2,
      estimateTokens: () => 1,
    });

    expect(result.before).toHaveLength(2);
    expect(result.before[0].order).toBe(1);
    expect(result.before[1].order).toBe(10);
  });
});
