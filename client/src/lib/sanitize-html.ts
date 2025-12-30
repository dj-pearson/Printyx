/**
 * HTML Sanitization Utility
 *
 * This module provides secure HTML sanitization using DOMPurify to prevent XSS attacks.
 * Always use these utilities when rendering user-generated HTML content.
 */

import DOMPurify from "dompurify";

/**
 * Default configuration for DOMPurify.
 * Allows common HTML elements while blocking potentially dangerous ones.
 */
const DEFAULT_CONFIG: DOMPurify.Config = {
  // Allowed HTML tags for rich text content
  ALLOWED_TAGS: [
    // Text formatting
    "p",
    "br",
    "span",
    "div",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "del",
    "ins",
    "sub",
    "sup",
    "small",
    "mark",
    // Headings
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    // Lists
    "ul",
    "ol",
    "li",
    // Links and images
    "a",
    "img",
    // Tables
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "colgroup",
    "col",
    // Block elements
    "blockquote",
    "pre",
    "code",
    "hr",
    // Semantic
    "article",
    "section",
    "header",
    "footer",
    "nav",
    "aside",
    "figure",
    "figcaption",
    // Forms (display only)
    "label",
  ],
  // Allowed attributes
  ALLOWED_ATTR: [
    // Common attributes
    "id",
    "class",
    "style",
    "title",
    "lang",
    "dir",
    // Links
    "href",
    "target",
    "rel",
    // Images
    "src",
    "alt",
    "width",
    "height",
    // Tables
    "colspan",
    "rowspan",
    "scope",
    // Data attributes (limited)
    "data-*",
  ],
  // Allow target="_blank" for links but add security attributes
  ADD_ATTR: ["target"],
  // Force all links to have rel="noopener noreferrer" for security
  FORBID_ATTR: [],
  // Don't allow data: URLs in src attributes (potential XSS vector)
  ALLOW_DATA_ATTR: true,
  // Return a DOM node instead of a string for more flexibility
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  // Sanitize URLs
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

/**
 * Sanitizes HTML content to prevent XSS attacks.
 *
 * @param html - The HTML string to sanitize
 * @param config - Optional custom DOMPurify configuration
 * @returns Sanitized HTML string safe for rendering
 *
 * @example
 * ```tsx
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />
 * ```
 */
export function sanitizeHtml(
  html: string,
  config?: DOMPurify.Config
): string {
  if (!html) return "";

  // Merge custom config with defaults
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  return DOMPurify.sanitize(html, mergedConfig);
}

/**
 * Strict sanitization - removes all HTML tags, returning plain text only.
 * Use this when you need to display user content as text without any formatting.
 *
 * @param html - The HTML string to strip
 * @returns Plain text with all HTML removed
 */
export function stripHtml(html: string): string {
  if (!html) return "";

  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
}

/**
 * Minimal sanitization - allows only basic text formatting.
 * Use this for comments, descriptions, or other simple text fields.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML with only basic formatting
 */
export function sanitizeBasicHtml(html: string): string {
  if (!html) return "";

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

/**
 * Rich text sanitization - allows extensive formatting for WYSIWYG editors.
 * Use this for rich text editor content like proposals, documents, etc.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML with rich text formatting preserved
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";

  return DOMPurify.sanitize(html, DEFAULT_CONFIG);
}

/**
 * Hook to add rel="noopener noreferrer" to all links for security.
 * This prevents the new window from having access to window.opener.
 */
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  // Add noopener noreferrer to external links
  if (node.tagName === "A" && node.hasAttribute("target")) {
    const existingRel = node.getAttribute("rel") || "";
    if (!existingRel.includes("noopener")) {
      node.setAttribute(
        "rel",
        `${existingRel} noopener noreferrer`.trim()
      );
    }
  }
  // Force images to have alt text for accessibility
  if (node.tagName === "IMG" && !node.hasAttribute("alt")) {
    node.setAttribute("alt", "");
  }
});

/**
 * React-friendly component helper for sanitized HTML rendering.
 * Returns the props needed for dangerouslySetInnerHTML.
 *
 * @param html - The HTML string to sanitize
 * @returns Object with __html property for React's dangerouslySetInnerHTML
 *
 * @example
 * ```tsx
 * <div {...createSafeHtml(userContent)} />
 * ```
 */
export function createSafeHtml(html: string): { dangerouslySetInnerHTML: { __html: string } } {
  return {
    dangerouslySetInnerHTML: {
      __html: sanitizeHtml(html),
    },
  };
}

export default {
  sanitizeHtml,
  stripHtml,
  sanitizeBasicHtml,
  sanitizeRichHtml,
  createSafeHtml,
};
