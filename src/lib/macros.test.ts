import { describe, expect, it } from "vitest";

import { replaceMacros } from "./macros";

describe("macro replacement", () => {
  it("replaces core character, user, and original text macros", () => {
    const result = replaceMacros(
      "{{user}} -> {{char}} ({{nickname}}): {{original}}",
      {
      characterName: "Alice",
      nickname: "Al",
      userName: "Tester",
      originalText: "Hello",
      },
    );

    expect(result).toBe("Tester -> Alice (Al): Hello");
  });

  it("falls back to character name for missing nickname macros", () => {
    const result = replaceMacros("{{nickname}}", {
      characterName: "Alice",
    });

    expect(result).toBe("Alice");
  });

  it("keeps unknown macros unchanged and removes comment macros", () => {
    const result = replaceMacros("A {{// internal note }}B {{unknown}} C", {
      characterName: "Alice",
    });

    expect(result).toBe("A B {{unknown}} C");
  });

  it("formats deterministic time macros in UTC", () => {
    const now = new Date("2026-07-05T08:09:10.000Z");

    const result = replaceMacros(
      "{{date}} {{time}} {{datetime}} {{weekday}} {{isoTime}}",
      { now },
    );

    expect(result).toBe(
      "2026-07-05 08:09:10 2026-07-05 08:09:10 Sunday 2026-07-05T08:09:10.000Z",
    );
  });

  it("supports deterministic random numbers and choice lists", () => {
    const randomValues = [0.5, 0, 0.999];
    const random = () => randomValues.shift() ?? 0;

    const result = replaceMacros(
      "{{random}} {{random::red::blue::green}} {{random:one,two,three}}",
      { random },
    );

    expect(result).toBe("0.5 red three");
  });

  it("uses empty strings for missing known text macros", () => {
    const result = replaceMacros("{{user}}/{{char}}/{{original}}");

    expect(result).toBe("//");
  });
});
