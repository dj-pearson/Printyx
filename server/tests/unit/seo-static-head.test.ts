/**
 * The static <head> is the only SEO surface a non-JS crawler or a social
 * scraper ever sees, and it made four claims that were not true (SEO-002).
 *
 * 1. A hardcoded aggregateRating of 4.9 from 150 ratings. LEGAL-002 removed the
 *    same fabrication from the runtime provider and missed this copy - the one
 *    that ships without executing JS. Printyx has no reviews to count.
 * 2. og:image and twitter:image pointed at /og-image.png and
 *    /twitter-image.png. Neither file existed, so every shared link rendered
 *    blank. One generated 1200x630 card now serves both.
 * 3. The Organization JSON-LD logo pointed at /logo.png (404; the asset is at
 *    /logos/logo.png) and declared it 512x512 when it is 2000x600.
 * 4. WebSite.potentialAction offered a sitelinks search box at /search, which
 *    is not a registered route.
 *
 * Plus: favicon.svg used React's `stopColor` rather than SVG's `stop-color`,
 * so both gradients fell back to black and the mark rendered as a black blob
 * in every browser tab and search result. Verified by rendering it in Chromium
 * before and after: rgba(0,0,0,255) -> rgba(67,100,237,255).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const html = readFileSync(join(root, 'client/index.html'), 'utf8');
const favicon = readFileSync(join(root, 'client/public/favicon.svg'), 'utf8');
/** This test's own prose names what was removed; strip comments before asserting absence. */
const headNoComments = html.replace(/<!--[\s\S]*?-->/g, '');

function jsonLdBlocks(): Record<string, any>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  );
}

describe('static <head> structured data', () => {
  it('every JSON-LD block parses and is typed', () => {
    const blocks = jsonLdBlocks();
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    for (const block of blocks) {
      expect(block['@context']).toBe('https://schema.org');
      expect(typeof block['@type']).toBe('string');
    }
  });

  it('emits no aggregateRating', () => {
    expect(headNoComments).not.toContain('aggregateRating');
    expect(headNoComments).not.toContain('ratingValue');
  });

  it('offers no sitelinks SearchAction, because /search is not a route', () => {
    expect(headNoComments).not.toContain('SearchAction');
  });

  it('declares the Organization logo at its real path and real size', () => {
    const org = jsonLdBlocks().find((b) => b['@type'] === 'Organization');
    expect(org).toBeDefined();
    const url: string = org!.logo.url;
    const path = url.replace('https://printyx.net', '');
    expect(existsSync(join(root, 'client/public', path))).toBe(true);
    const png = readFileSync(join(root, 'client/public', path));
    expect(org!.logo.width).toBe(png.readUInt32BE(16));
    expect(org!.logo.height).toBe(png.readUInt32BE(20));
  });
});

describe('social card', () => {
  it('og:image and twitter:image both resolve to a real file', () => {
    const refs = [...html.matchAll(/property="(og|twitter):image" content="([^"]+)"/g)].map(
      (m) => m[2],
    );
    expect(refs.length).toBe(2);
    for (const ref of refs) {
      const path = ref.replace('https://printyx.net', '');
      expect(existsSync(join(root, 'client/public', path)), `${ref} is missing`).toBe(true);
    }
  });

  it('is 1200x630, the frame summary_large_image and Open Graph both take', () => {
    const png = readFileSync(join(root, 'client/public/og-image.png'));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});

describe('favicon', () => {
  it('uses the SVG attribute, not the React prop', () => {
    expect(favicon).not.toContain('stopColor');
    expect(favicon.match(/stop-color=/g)?.length).toBe(4);
  });
});
