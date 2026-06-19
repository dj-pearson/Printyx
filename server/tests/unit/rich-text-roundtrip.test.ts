// @vitest-environment jsdom
//
// PROP-009: round-trip coverage for the TipTap-based proposal RichTextEditor.
//
// Verifies that representative stored section HTML loads into the editor schema
// and serializes back out WITHOUT corruption — the core regression risk when
// swapping the execCommand editor for ProseMirror. We exercise the exact
// extension set the component ships (buildRichTextExtensions) via TipTap's
// schema-level generateJSON/generateHTML, which need a DOM (hence jsdom) but no
// live editor view.

import { describe, it, expect } from 'vitest';
import { generateHTML, generateJSON } from '@tiptap/core';
import { buildRichTextExtensions } from '@/components/proposal-builder/rich-text-extensions';

const extensions = buildRichTextExtensions();

/** Parse HTML into the editor document then serialize it back, as the editor does. */
function roundTrip(html: string): string {
  return generateHTML(generateJSON(html, extensions), extensions);
}

describe('RichTextEditor round-trip (PROP-009)', () => {
  it('preserves headings, emphasis, lists, links and blockquotes', () => {
    const stored =
      '<h2>Executive Summary</h2>' +
      '<p>We are <strong>pleased</strong> to present this <em>proposal</em>.</p>' +
      '<ul><li>Fast delivery</li><li>24/7 support</li></ul>' +
      '<ol><li>Step one</li></ol>' +
      '<blockquote>Quality first.</blockquote>' +
      '<p><a href="https://printyx.net">Learn more</a></p>';

    const out = roundTrip(stored);

    expect(out).toContain('<h2');
    expect(out).toContain('Executive Summary');
    expect(out).toContain('<strong>pleased</strong>');
    expect(out).toContain('<em>proposal</em>');
    expect(out).toMatch(/<ul>\s*<li>\s*(<p>)?Fast delivery/);
    expect(out).toContain('24/7 support');
    expect(out).toContain('<ol>');
    expect(out).toContain('Step one');
    expect(out).toContain('<blockquote>');
    expect(out).toContain('Quality first.');
    expect(out).toContain('href="https://printyx.net"');
    expect(out).toContain('Learn more');
  });

  it('keeps raw {{merge.tokens}} authored as plain text intact', () => {
    const stored =
      '<p>Dear {{contact.name}}, here is your quote {{quote.number}} valid until {{quote.validUntil}}.</p>';
    const out = roundTrip(stored);

    expect(out).toContain('{{contact.name}}');
    expect(out).toContain('{{quote.number}}');
    expect(out).toContain('{{quote.validUntil}}');
  });

  it('serializes a merge-token chip node so the merge engine still resolves it', () => {
    // A chip authored in the editor (or re-loaded) renders as a span whose INNER
    // TEXT is the literal token — what proposal-merge.ts replaces at render time.
    const stored =
      '<p>Hello <span data-merge-token="{{customer.companyName}}">{{customer.companyName}}</span>!</p>';
    const out = roundTrip(stored);

    expect(out).toContain('data-merge-token="{{customer.companyName}}"');
    expect(out).toContain('{{customer.companyName}}');

    // The merge engine's token regex (proposal-merge.ts) must still match.
    const TOKEN_RE = /\{\{\s*[\w.]+\s*\}\}/g;
    const matches = out.match(TOKEN_RE) ?? [];
    expect(matches).toContain('{{customer.companyName}}');
  });

  it('is stable across a second round-trip (idempotent serialization)', () => {
    const stored = '<h3>Pricing</h3><p style="text-align:center">Total: {{quote.totalAmount}}</p>';
    const once = roundTrip(stored);
    const twice = roundTrip(once);
    expect(twice).toBe(once);
  });
});
