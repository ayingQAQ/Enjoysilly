import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sanitize: vi.fn((html: string) =>
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ""),
  ),
}));

vi.mock("dompurify", () => ({
  default: {
    sanitize: mocks.sanitize,
  },
}));

import { renderSafeMarkdownToHtml } from "./markdown";

describe("markdown", () => {
  it("renders markdown and passes the generated HTML through DOMPurify", () => {
    const html = renderSafeMarkdownToHtml("**粗体**\n\n<script>alert(1)</script>");

    expect(html).toContain("<strong>粗体</strong>");
    expect(html).not.toContain("<script>");
    expect(mocks.sanitize).toHaveBeenCalledWith(
      expect.stringContaining("<strong>粗体</strong>"),
      { USE_PROFILES: { html: true } },
    );
  });
});
