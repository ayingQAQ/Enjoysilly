import { describe, expect, it } from "vitest";

// markdown.test.ts 必须用 jsdom 环境运行，这样 DOMPurify 才能用 document。
// 通过 `// @vitest-environment jsdom` 注释声明。
// @vitest-environment jsdom

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
  });

  it("renders block HTML fragments without wrapping them as code", () => {
    const html = renderSafeMarkdownToHtml(
      '<div class="rp-card" style="background: linear-gradient(45deg, #fff, #dbeafe); position: fixed; color: #111;" onclick="alert(1)">status card</div>',
    );

    expect(html).toContain("ms-card-rp-card");
    expect(html).toContain("status card");
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

  it("sanitizes full HTML documents for iframe srcDoc — no scripts, no bridge", () => {
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

    const srcDoc = renderSafeHtmlDocumentToSrcDoc(markdown);

    // 保留静态内容
    expect(srcDoc).toContain("<style>");
    expect(srcDoc).toContain(".card { background: #121212; color: #e0e0e0; }");
    expect(srcDoc).toContain('class="card"');
    expect(srcDoc).not.toContain("ms-card-card");
    expect(srcDoc).toContain("opening guide");
    expect(srcDoc).toContain("viewport");
    expect(srcDoc).toContain("Content-Security-Policy");

    // 不再注入 bridge 脚本
    expect(srcDoc).not.toContain("my-silly-html-card");
    expect(srcDoc).not.toContain("postMessage");
    expect(srcDoc).not.toContain("bridgeId");

    // 清除脚本和事件
    expect(srcDoc).not.toContain("<script>");
    expect(srcDoc).not.toContain("alert(1)");
    expect(srcDoc).not.toContain("onload");
  });

  it("removes network-loading CSS while preserving local document styles", () => {
    const srcDoc = renderSafeHtmlDocumentToSrcDoc(`
<!DOCTYPE html>
<html>
<head>
<style>
@import url("https://evil.example/theme.css");
.card { color: red; background-image: url("https://evil.example/a.png"); }
</style>
</head>
<body><div class="card">safe card</div></body>
</html>
`);

    expect(srcDoc).toContain(".card");
    expect(srcDoc).toContain("color: red");
    expect(srcDoc).not.toContain("evil.example");
  });

  it("renders plain status-bar lines as a status panel fallback", () => {
    const html = renderSafeMarkdownToHtml(
      '状态栏: 日期和时间: "2158纪-午后" 地点: "空间站"',
    );

    expect(html).toContain('class="ms-status-panel"');
    expect(html).toContain("状态栏");
    expect(html).toContain("2158纪-午后");
  });

  // ── 新增安全测试（Phase 9） ──

  it("removes scripts from full HTML documents", () => {
    const srcDoc = renderSafeHtmlDocumentToSrcDoc(`
\`\`\`html
<!DOCTYPE html>
<html>
<body>
<div>hello</div>
<script>alert(1)</script>
</body>
</html>
\`\`\`
`);

    expect(srcDoc).toContain("hello");
    expect(srcDoc).not.toContain("<script");
    expect(srcDoc).not.toContain("alert(1)");
  });

  it("removes event handler attributes", () => {
    const html = renderSafeMarkdownToHtml(
      '<button onclick="alert(1)" data-ms-action="setDraft" data-ms-text="ok">ok</button>',
    );

    expect(html).toContain("data-ms-action");
    expect(html).toContain("data-ms-text");
    expect(html).not.toContain("onclick");
  });

  it("removes iframe tags", () => {
    const html = renderSafeMarkdownToHtml(
      '<div>safe</div><iframe src="https://example.com"></iframe>',
    );

    expect(html).toContain("safe");
    expect(html).not.toContain("<iframe");
  });

  it("removes external media by default", () => {
    const html = renderSafeMarkdownToHtml(
      '<img src="https://example.com/a.png" alt="x"><p>text</p>',
    );

    expect(html).toContain("text");
    expect(html).not.toContain("https://example.com/a.png");
  });

  it("removes unsafe inline CSS values", () => {
    const html = renderSafeMarkdownToHtml(
      '<div style="background-image: url(https://evil.example/a.png); color: red;">x</div>',
    );

    expect(html).toContain("x");
    expect(html).toContain("color: red");
    expect(html).not.toContain("background-image");
    expect(html).not.toContain("evil.example");
  });

  it("preserves data-ms-action and data-ms-text attributes", () => {
    const html = renderSafeMarkdownToHtml(
      '<button data-ms-action="sendMessage" data-ms-text="go">send</button>',
    );

    expect(html).toContain('data-ms-action="sendMessage"');
    expect(html).toContain('data-ms-text="go"');
    expect(html).toContain("send");
  });

  it("prefixes user classes but preserves ms- classes", () => {
    const html = renderSafeMarkdownToHtml(
      '<div class="rp-card"><section class="ms-status-panel">status</section></div>',
    );

    expect(html).toContain("ms-card-rp-card");
    expect(html).toContain("ms-status-panel");
  });

  it("strips data-* attributes that are not on the allowlist", () => {
    const html = renderSafeMarkdownToHtml(
      '<div data-foo="bar" data-ms-action="setDraft" data-ms-text="ok">test</div>',
    );

    expect(html).toContain("data-ms-action");
    expect(html).toContain("data-ms-text");
    expect(html).not.toContain("data-foo");
  });
});
