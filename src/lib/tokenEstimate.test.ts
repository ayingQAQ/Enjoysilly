import { describe, expect, it } from "vitest";

import {
  estimateChatMessagesTokens,
  estimateTextTokens,
} from "./tokenEstimate";

describe("tokenEstimate", () => {
  it("returns zero for blank text", () => {
    expect(estimateTextTokens("  \n  ")).toBe(0);
  });

  it("estimates mixed Chinese and English content without claiming exact tokens", () => {
    expect(estimateTextTokens("你好 world")).toBe(4);
  });

  it("uses the selected swipe when estimating chat messages", () => {
    const total = estimateChatMessagesTokens([
      {
        name: "User",
        is_user: true,
        mes: "旧内容",
        swipe_id: 1,
        swipes: ["旧内容", "新的回复内容"],
      },
    ]);

    expect(total).toBe(11);
  });
});
