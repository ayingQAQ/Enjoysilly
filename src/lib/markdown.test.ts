import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sanitize: vi.fn((html: string) => {
    return html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
      .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\s(?:href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, "");
  }),
}));

vi.mock("dompurify", () => ({
  default: {
    sanitize: mocks.sanitize,
  },
}));

import {
  isRenderableHtmlDocumentMessage,
  renderSafeHtmlDocumentToSrcDoc,
  renderSafeMarkdownToHtml,
} from "./markdown";

describe("markdown", () => {
  it("renders markdown and passes the generated HTML through DOMPurify", () => {
    const html = renderSafeMarkdownToHtml("**bold**\n\n<script>alert(1)</script>");

    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<script>");
    expect(mocks.sanitize).toHaveBeenCalledWith(
      expect.stringContaining("<strong>bold</strong>"),
      expect.objectContaining({ USE_PROFILES: { html: true } }),
    );
  });

  it("renders block HTML fragments without wrapping them as code", () => {
    const html = renderSafeMarkdownToHtml(
      '<div class="rp-card" style="background: linear-gradient(45deg, #fff, #dbeafe); position: fixed; color: #111;" onclick="alert(1)">status card</div>',
    );

    expect(html).toContain('class="rp-card"');
    expect(html).toContain("status card");
    expect(html).toContain("linear-gradient");
    expect(html).toContain("color: #111");
    expect(html).not.toContain("<pre>");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("position: fixed");
  });

  it("renders full-message html code fences as sanitized fragments", () => {
    const html = renderSafeMarkdownToHtml(`
\`\`\`html
<section style="padding: 12px;"><strong>battle tip</strong></section>
\`\`\`
`);

    expect(html).toContain("<section");
    expect(html).toContain("<strong>battle tip</strong>");
    expect(html).not.toContain("&lt;section");
    expect(html).not.toContain("<pre>");
  });

  it("keeps HTML rendering non-executable", () => {
    const html = renderSafeMarkdownToHtml(
      '<div><img src="javascript:alert(1)" onerror="alert(1)" alt="x"><iframe srcdoc="<script>alert(1)</script>"></iframe><script>alert(1)</script></div>',
    );

    expect(html).toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<script");
  });

  it("keeps full HTML documents available for sandboxed iframe rendering", () => {
    const markdown = `
\`\`\`html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<style>.card { background: #121212; color: #e0e0e0; }</style>
</head>
<body onload="alert(1)">
<div class="card">opening guide</div>
<script>alert(1)</script>
</body>
</html>
\`\`\`
`;

    expect(isRenderableHtmlDocumentMessage(markdown)).toBe(true);

    const srcDoc = renderSafeHtmlDocumentToSrcDoc(markdown, "test-card");

    expect(srcDoc).toContain("<style>");
    expect(srcDoc).toContain(".card");
    expect(srcDoc).toContain("opening guide");
    expect(srcDoc).toContain("viewport");
    expect(srcDoc).toContain("my-silly-html-card");
    expect(srcDoc).toContain("test-card");
    expect(srcDoc).toContain("onload");
    expect(srcDoc).toContain("alert(1)");
  });

  it("renders plain status-bar lines as a status panel fallback", () => {
    const html = renderSafeMarkdownToHtml(
      '状态栏: 日期和时间: "2158纪-午后" 地点: "空间站"',
    );

    expect(html).toContain('class="ms-status-panel"');
    expect(html).toContain("状态栏");
    expect(html).toContain("2158纪-午后");
  });
});
