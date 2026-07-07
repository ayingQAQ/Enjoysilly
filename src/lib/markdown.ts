import DOMPurify from "dompurify";
import { marked } from "marked";

const renderableHtmlFencePattern = /^\s*```(?:html|xml|svg)?\s*\n([\s\S]*?)\n```\s*$/i;
const htmlDocumentPattern = /<!doctype html>|<\/?(html|head|body)\b/i;
const blockHtmlPattern = /^\s*<(article|aside|blockquote|details|div|figure|footer|header|img|main|section|svg|table)\b/i;

const allowedStyleProperties = new Set([
  "align-items",
  "background",
  "background-color",
  "background-image",
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
  "position",
  "text-align",
  "text-decoration",
  "text-shadow",
  "transform",
  "transition",
  "vertical-align",
  "white-space",
  "width",
  "word-break",
]);

export function renderSafeMarkdownToHtml(markdown: string): string {
  const source = unwrapRenderableHtmlFence(markdown);

  if (isRenderableHtmlDocumentMessage(source)) {
    return sanitizeChatHtml(stripHtmlDocumentShell(source));
  }

  if (shouldRenderAsHtmlFragment(source)) {
    return sanitizeChatHtml(stripHtmlDocumentShell(source));
  }

  const rawHtml = marked.parse(source, {
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

export function renderSafeHtmlDocumentToSrcDoc(markdown: string, bridgeId?: string): string {
  const source = unwrapRenderableHtmlFence(markdown);
  const cleanedDocument = DOMPurify.sanitize(stripExecutableHtml(source), {
    ADD_TAGS: ["style"],
    ADD_ATTR: [
      "alt",
      "aria-label",
      "charset",
      "class",
      "content",
      "data-ms-action",
      "data-ms-text",
      "height",
      "href",
      "lang",
      "name",
      "rel",
      "src",
      "style",
      "title",
      "type",
      "width",
    ],
    FORBID_TAGS: [
      "base",
      "button",
      "embed",
      "form",
      "iframe",
      "input",
      "link",
      "object",
      "script",
      "select",
      "textarea",
    ],
    WHOLE_DOCUMENT: true,
  });

  return ensureIframeDocumentScaffold(cleanedDocument, bridgeId);
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

function sanitizeChatHtml(html: string): string {
  return DOMPurify.sanitize(sanitizeInlineStyleAttributes(html), {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["details", "summary"],
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
    ],
    FORBID_TAGS: [
      "base",
      "button",
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
  });
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

    if (property === "position" && !/^(relative|static)$/i.test(value)) {
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

function stripExecutableHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/\s(?:href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, "");
}

function ensureIframeDocumentScaffold(html: string, bridgeId?: string): string {
  const hasHtmlShell = /<html\b/i.test(html);
  const resetStyle = `
<style>
html, body {
  box-sizing: border-box;
  min-height: auto !important;
  overflow-x: hidden;
}
*, *::before, *::after {
  box-sizing: inherit;
}
img, video, canvas, svg {
  max-width: 100%;
  height: auto;
}
body {
  margin: 0;
}
</style>`;
  const metaViewport =
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">';

  const documentWithBridge = injectHtmlCardBridge(html, bridgeId);

  if (!hasHtmlShell) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
${metaViewport}
${resetStyle}
</head>
<body>
${documentWithBridge}
</body>
</html>`;
  }

  if (/<head\b[^>]*>/i.test(html)) {
    return documentWithBridge.replace(/<head\b[^>]*>/i, (match) => `${match}\n${metaViewport}\n${resetStyle}`);
  }

  return documentWithBridge.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head>${metaViewport}${resetStyle}</head>`);
}

function injectHtmlCardBridge(html: string, bridgeId?: string): string {
  if (!bridgeId) {
    return html;
  }

  const bridgeScript = `<script>
(() => {
  const bridgeId = ${JSON.stringify(bridgeId)};
  const source = "my-silly-html-card";
  const post = (payload) => {
    window.parent?.postMessage({ source, bridgeId, ...payload }, "*");
  };
  const readText = (element) => {
    const explicitText = element?.getAttribute?.("data-ms-text");
    if (explicitText && explicitText.trim()) return explicitText.trim();
    const title = element?.querySelector?.("h1,h2,h3,h4")?.textContent || "";
    const body = element?.querySelector?.("p")?.textContent || "";
    const combined = [title, body].map((part) => part.trim()).filter(Boolean).join("\\n\\n");
    return combined || (element?.textContent || "").trim();
  };
  const resize = () => {
    const height = Math.max(
      document.documentElement?.scrollHeight || 0,
      document.body?.scrollHeight || 0,
      document.documentElement?.offsetHeight || 0,
      document.body?.offsetHeight || 0
    );
    post({ type: "resize", height });
  };
  document.addEventListener("click", (event) => {
    const target = event.target?.closest?.("[data-ms-action], .scenario-card");
    if (!target) return;
    const action = target.getAttribute("data-ms-action") || "setDraft";
    const text = readText(target);
    if (!text) return;
    if (action === "sendMessage" || action === "setDraft" || action === "appendDraft") {
      event.preventDefault();
      post({ type: "action", action, text });
    }
  });
  window.addEventListener("load", resize);
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(document.body || document.documentElement);
  }
  setTimeout(resize, 50);
  setTimeout(resize, 300);
  setTimeout(resize, 900);
})();
</script>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${bridgeScript}</body>`);
  }

  return `${html}\n${bridgeScript}`;
}
