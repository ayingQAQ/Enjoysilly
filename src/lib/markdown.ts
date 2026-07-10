import DOMPurify from "dompurify";
import { marked } from "marked";

const renderableHtmlFencePattern = /^\s*```(?:html|xml|svg)?\s*\n([\s\S]*?)\n```\s*$/i;
const htmlDocumentPattern = /<!doctype html>|<\/?(html|head|body)\b/i;
const blockHtmlPattern = /^\s*<(article|aside|blockquote|details|div|figure|footer|header|img|main|section|svg|table)\b/i;

const allowedStyleProperties = new Set([
  "align-items",
  "background",
  "background-color",
  "border",
  "border-bottom",
  "border-color",
  "border-left",
  "border-radius",
  "border-right",
  "border-style",
  "border-top",
  "border-width",
  "box-shadow",
  "color",
  "display",
  "flex",
  "flex-basis",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "font",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "gap",
  "height",
  "justify-content",
  "letter-spacing",
  "line-height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "object-fit",
  "opacity",
  "overflow",
  "overflow-wrap",
  "overflow-x",
  "overflow-y",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "text-align",
  "text-decoration",
  "text-shadow",
  "vertical-align",
  "white-space",
  "width",
  "word-break",
]);

const forbiddenEventAttributes = [
  "onabort",
  "onblur",
  "onchange",
  "onclick",
  "ondblclick",
  "onerror",
  "onfocus",
  "oninput",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onload",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmousemove",
  "onmouseout",
  "onmouseover",
  "onmouseup",
  "onsubmit",
];

export interface SanitizeChatHtmlOptions {
  /**
   * 默认 false：移除 img/video/audio/source/track 等指向外部 URL 的资源。
   * 设为 true 才会保留外部媒体（用于可信场景）。
   */
  allowExternalMedia?: boolean;
  /**
   * 是否给非 ms- 前缀的 class 加上 ms-card- 前缀，避免污染主 UI。
   * 默认开启。
   */
  prefixClasses?: boolean;
}

export function renderSafeMarkdownToHtml(markdown: string): string {
  const source = unwrapRenderableHtmlFence(markdown);

  if (isRenderableHtmlDocumentMessage(source)) {
    return sanitizeChatHtml(stripHtmlDocumentShell(source));
  }

  if (shouldRenderAsHtmlFragment(source)) {
    return sanitizeChatHtml(stripHtmlDocumentShell(source));
  }

  const rawHtml = marked.parse(enhancePlainStatusBars(source), {
    async: false,
    breaks: true,
    gfm: true,
  });

  if (typeof rawHtml !== "string") {
    return "";
  }

  return sanitizeChatHtml(rawHtml);
}

export function isRenderableHtmlDocumentMessage(markdown: string): boolean {
  return htmlDocumentPattern.test(unwrapRenderableHtmlFence(markdown).trim());
}

/**
 * 完整 HTML 文档走无脚本 iframe 静态展示：
 * 剥掉 html/head/body 外壳 → DOMPurify 清洗 → 移除外部媒体 →
 * 套上只含 reset 样式、不含任何 <script> 的静态骨架。
 */
export function renderSafeHtmlDocumentToSrcDoc(markdown: string): string {
  const source = unwrapRenderableHtmlFence(markdown);
  const bodyHtml = stripHtmlDocumentShell(source);
  const safeHtml = sanitizeChatHtml(bodyHtml, { prefixClasses: false });
  const safeStyles = extractSafeDocumentStyles(source);

  return ensureStaticIframeDocumentScaffold(safeHtml, safeStyles);
}

function unwrapRenderableHtmlFence(markdown: string): string {
  const match = markdown.match(renderableHtmlFencePattern);
  if (!match) {
    return markdown;
  }

  const fencedContent = match[1]?.trim() ?? "";
  return shouldRenderAsHtmlFragment(fencedContent) ? fencedContent : markdown;
}

function shouldRenderAsHtmlFragment(content: string): boolean {
  const trimmed = content.trim();
  return htmlDocumentPattern.test(trimmed) || blockHtmlPattern.test(trimmed);
}

function stripHtmlDocumentShell(html: string): string {
  return html
    .replace(/<!doctype html>/gi, "")
    .replace(/<\/?html\b[^>]*>/gi, "")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?body\b[^>]*>/gi, "")
    .trim();
}

function extractSafeDocumentStyles(html: string): string {
  return Array.from(html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi))
    .map((match) => sanitizeDocumentStyleSheet(match[1] ?? ""))
    .filter(Boolean)
    .join("\n");
}

function sanitizeDocumentStyleSheet(css: string): string {
  return css
    .replace(/@import\s+[^;]+;?/gi, "")
    .replace(/url\s*\(\s*(['"]?)\s*(?:https?:|\/\/)[\s\S]*?\1\s*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/-moz-binding\s*:[^;}]+/gi, "")
    .replace(/behavior\s*:[^;}]+/gi, "")
    .replace(/<\/style/gi, "<\\/style")
    .trim();
}

function sanitizeChatHtml(
  html: string,
  options: SanitizeChatHtmlOptions = {},
): string {
  const cleaned = DOMPurify.sanitize(sanitizeInlineStyleAttributes(html), {
    USE_PROFILES: { html: true },
    ADD_TAGS: [
      "details",
      "summary",
      "section",
      "article",
      "figure",
      "figcaption",
      "button",
    ],
    ADD_ATTR: [
      "alt",
      "aria-label",
      "class",
      "height",
      "loading",
      "open",
      "rel",
      "src",
      "style",
      "target",
      "title",
      "width",
      "data-ms-action",
      "data-ms-text",
    ],
    FORBID_TAGS: [
      "base",
      "embed",
      "form",
      "iframe",
      "input",
      "link",
      "meta",
      "object",
      "script",
      "select",
      "style",
      "textarea",
    ],
    FORBID_ATTR: forbiddenEventAttributes,
    ALLOW_DATA_ATTR: false,
  });

  const withoutExternalMedia =
    options.allowExternalMedia === true
      ? cleaned
      : removeExternalMedia(cleaned);

  return options.prefixClasses === false
    ? withoutExternalMedia
    : prefixMessageClasses(withoutExternalMedia);
}

function removeExternalMedia(html: string): string {
  if (typeof document === "undefined") {
    // 非浏览器环境（如测试用 mock DOMPurify）下退化为基础正则过滤。
    return html.replace(
      /<(img|video|audio|source|track)\b[^>]*\ssrc(?:set)?\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')[^>]*>/gi,
      "",
    );
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  const mediaNodes = template.content.querySelectorAll(
    "img, video, audio, source, track",
  );

  for (const node of Array.from(mediaNodes)) {
    const src = node.getAttribute("src");
    if (src && isExternalUrl(src)) {
      node.remove();
      continue;
    }

    const srcset = node.getAttribute("srcset");
    if (srcset && /https?:\/\//i.test(srcset)) {
      node.remove();
    }
  }

  return template.innerHTML;
}

function isExternalUrl(value: string): boolean {
  try {
    const url = new URL(value, "https://my-silly.local/");
    return (
      url.origin !== "https://my-silly.local" && !value.startsWith("data:")
    );
  } catch {
    return false;
  }
}

function prefixMessageClasses(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  const elements = template.content.querySelectorAll("[class]");

  for (const element of Array.from(elements)) {
    const rawClass = element.getAttribute("class") ?? "";
    const nextClass = rawClass
      .split(/\s+/)
      .filter(Boolean)
      .map((className) =>
        className.startsWith("ms-") ? className : `ms-card-${className}`,
      )
      .join(" ");

    if (nextClass) {
      element.setAttribute("class", nextClass);
    } else {
      element.removeAttribute("class");
    }
  }

  return template.innerHTML;
}

function sanitizeInlineStyleAttributes(html: string): string {
  return html.replace(
    /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (_attribute, doubleQuoted: string | undefined, singleQuoted: string | undefined) => {
      const sanitizedStyle = sanitizeInlineStyle(doubleQuoted ?? singleQuoted ?? "");
      return sanitizedStyle ? ` style="${escapeHtmlAttribute(sanitizedStyle)}"` : "";
    },
  );
}

function enhancePlainStatusBars(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(\s*)状态栏[：:]\s*(.+)$/);
      if (!match) {
        return line;
      }

      const indent = match[1] ?? "";
      const body = match[2] ?? "";

      return `${indent}<section class="ms-status-panel"><div class="ms-status-title">状态栏</div><div class="ms-status-body">${escapeHtmlText(body)}</div></section>`;
    })
    .join("\n");
}

function sanitizeInlineStyle(style: string): string {
  const declarations = style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean);

  const safeDeclarations = declarations.flatMap((declaration) => {
    const colonIndex = declaration.indexOf(":");
    if (colonIndex <= 0) {
      return [];
    }

    const property = declaration.slice(0, colonIndex).trim().toLowerCase();
    const value = declaration.slice(colonIndex + 1).trim();
    if (!allowedStyleProperties.has(property) || isUnsafeCssValue(value)) {
      return [];
    }

    return [`${property}: ${value}`];
  });

  return safeDeclarations.join("; ");
}

function isUnsafeCssValue(value: string): boolean {
  return /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding|[<>]/i.test(
    value,
  );
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ensureStaticIframeDocumentScaffold(
  html: string,
  documentStyles: string,
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'">
<style>
html, body {
  box-sizing: border-box;
  overflow-x: hidden;
}
*, *::before, *::after {
  box-sizing: inherit;
}
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
img, video, canvas, svg {
  max-width: 100%;
  height: auto;
}
${documentStyles}
</style>
</head>
<body>
${html}
</body>
</html>`;
}
