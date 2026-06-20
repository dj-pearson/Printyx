/**
 * MergeToken — a TipTap inline atom node for proposal merge tokens (PROP-004 /
 * PROP-009). Renders as a non-editable chip in the editor but serializes to the
 * literal `{{token}}` text the merge engine (PROP-005) resolves at generation
 * time, so stored content round-trips cleanly whether a token was typed as
 * plain text or inserted as a chip.
 */
import { Node, mergeAttributes } from '@tiptap/core';

export interface MergeTokenOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mergeToken: {
      /** Insert a merge-token chip, e.g. `{{customer.companyName}}`. */
      insertMergeToken: (token: string) => ReturnType;
    };
  }
}

/** Normalise to the bare token name without the surrounding braces. */
function stripBraces(raw: string): string {
  return raw
    .replace(/^\{\{\s*/, '')
    .replace(/\s*\}\}$/, '')
    .trim();
}

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
        default: '',
        parseHTML: (element) => element.getAttribute('data-merge-token') ?? '',
        renderHTML: (attributes) => ({ 'data-merge-token': attributes.token }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-token]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const token = String(node.attrs.token ?? '');
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'merge-token-chip',
        contenteditable: 'false',
      }),
      `{{${token}}}`,
    ];
  },

  renderText({ node }) {
    return `{{${node.attrs.token}}}`;
  },

  addCommands() {
    return {
      insertMergeToken:
        (token: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { token: stripBraces(token) },
          }),
    };
  },
});

export default MergeToken;
