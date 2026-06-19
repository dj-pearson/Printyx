// PROP-009: shared TipTap extension set for the proposal RichTextEditor.
//
// Defined in its own module (no React imports) so the editor component AND the
// round-trip unit test (rich-text-extensions.test.ts) build the editor schema
// from the exact same configuration — guaranteeing the test exercises what
// ships. The legacy editor used the deprecated document.execCommand API; this
// replaces it with ProseMirror via TipTap while preserving every toolbar
// feature and the sanitizeRichHtml output pathway.

import { Node, mergeAttributes, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color, BackgroundColor, FontSize } from '@tiptap/extension-text-style';

export interface MergeTokenOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mergeToken: {
      /** Insert a merge token (e.g. "{{customer.companyName}}") as an inline chip. */
      insertMergeToken: (token: string) => ReturnType;
    };
  }
}

/**
 * Inline atom node for a merge token (PROP-004).
 *
 * Renders as a styled, non-editable chip in the editor, but serializes to a
 * `<span data-merge-token="{{token}}">{{token}}</span>` whose INNER TEXT is the
 * literal token. That literal text is what the merge engine
 * (supabase/functions/_shared/proposal-merge.ts) replaces at render time via its
 * `/\{\{\s*[\w.]+\s*\}\}/g` regex, and the wrapping span survives sanitizeRichHtml
 * (DOMPurify allows span/class/data-*). So a template authored with chips merges
 * identically to one authored with raw "{{token}}" text — no engine change needed.
 */
export const MergeToken = Node.create<MergeTokenOptions>({
  name: 'mergeToken',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      token: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-merge-token'),
        renderHTML: (attributes) =>
          attributes.token ? { 'data-merge-token': attributes.token } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-token]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'merge-token-chip',
      }),
      node.attrs.token ?? '',
    ];
  },

  // Plain-text serialization (used by copy/paste and getText) keeps the raw token.
  renderText({ node }) {
    return (node.attrs.token as string) ?? '';
  },

  addCommands() {
    return {
      insertMergeToken:
        (token: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { token } }),
    };
  },
});

/**
 * Build the canonical extension array for the proposal rich-text editor.
 * @param placeholder Optional placeholder shown when the document is empty.
 */
export function buildRichTextExtensions(placeholder?: () => string): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      // bundled in StarterKit v3 — configure for proposal styling.
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: 'text-blue-600 underline', rel: 'noopener noreferrer' },
      },
    }),
    TextStyle,
    Color,
    BackgroundColor,
    FontSize,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({ inline: false, HTMLAttributes: { class: 'rte-image' } }),
    Placeholder.configure({
      placeholder: placeholder ? ({ editor }) => (editor.isEmpty ? placeholder() : '') : '',
    }),
    MergeToken,
  ];
}
