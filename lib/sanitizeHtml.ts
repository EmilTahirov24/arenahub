import "server-only";
import sanitize from "sanitize-html";

/**
 * News bodies are admin-authored HTML rendered with dangerouslySetInnerHTML, so
 * they are sanitized on write. Without this, anyone who can reach the news
 * editor could plant script that runs for every public visitor — including a
 * logged-in SUPER_ADMIN.
 */
export function sanitizeArticleHtml(dirty: string): string {
  return sanitize(dirty, {
    allowedTags: [
      "p", "br", "hr",
      "h2", "h3", "h4",
      "strong", "b", "em", "i", "u", "s",
      "ul", "ol", "li",
      "blockquote", "code", "pre",
      "a", "img",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
    },
    // Blocks javascript:/data: URLs in href and src.
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitize.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}
