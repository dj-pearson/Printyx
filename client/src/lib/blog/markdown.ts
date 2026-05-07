/**
 * Markdown ↔ HTML round-trip (US-BLOG-008)
 *
 * The blog editor uses TipTap (HTML-native) but the canonical source of truth
 * for posts is Markdown stored on `blog_posts.body_markdown`. We round-trip
 * through HTML on every edit:
 *
 *   on load:  body_markdown → markdownToHtml() → editor
 *   on save:  editor → editor.getHTML() → htmlToMarkdown() → body_markdown
 *                                       → editor.getHTML()              → body_html
 *
 * Both directions are configured for GFM-ish round-trip fidelity. This is
 * good enough for v1; full block parity (footnotes, tables, callouts) waits
 * for the polished editor iteration that adds those TipTap extensions.
 */

import { marked, type MarkedOptions } from 'marked';
import TurndownService from 'turndown';

const MARKED_OPTIONS: MarkedOptions = {
  // GFM (tables, fenced code, autolinks)
  gfm: true,
  // Convert single newlines to <br /> — most paste workflows expect this
  breaks: true,
};

/**
 * Markdown → HTML. Synchronous; safe for use in editor onPaste handlers.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  // marked.parse can return a Promise when extensions are async — coerce to
  // sync by configuring without async extensions and casting. The default
  // marked output is synchronous string.
  const out = marked.parse(markdown, MARKED_OPTIONS);
  if (typeof out === 'string') return out;
  // Fallback: stringify whatever it returned
  return String(out);
}

let turndown: TurndownService | null = null;
function getTurndown(): TurndownService {
  if (turndown) return turndown;
  turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  // GFM strikethrough
  turndown.addRule('strikethrough', {
    filter: ['del', 's'],
    replacement: (content) => `~~${content}~~`,
  });

  // Preserve inline images with alt + title
  turndown.addRule('image', {
    filter: 'img',
    replacement: (_content, node) => {
      const el = node as HTMLImageElement;
      const alt = el.getAttribute('alt') ?? '';
      const src = el.getAttribute('src') ?? '';
      const title = el.getAttribute('title');
      if (!src) return '';
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
    },
  });

  // Preserve task lists from TipTap's task-item nodes (when added in a future iteration)
  turndown.addRule('taskListItem', {
    filter: (node) => node.nodeName === 'LI' && (node as HTMLElement).hasAttribute('data-checked'),
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute('data-checked') === 'true';
      return `- [${checked ? 'x' : ' '}] ${content.trim()}\n`;
    },
  });

  return turndown;
}

/**
 * HTML → Markdown. Pass the editor's `getHTML()` output here on save.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return getTurndown().turndown(html).trim();
}
