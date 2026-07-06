import DOMPurify from "dompurify";
import { marked } from "marked";

export function renderSafeMarkdownToHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  });

  if (typeof rawHtml !== "string") {
    return "";
  }

  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
  });
}
