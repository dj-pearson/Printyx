/**
 * sitemap.xml exists, matches the SEO route table, and lists no page the app
 * cannot actually render (SEO-001).
 *
 * Two defects this locks:
 *
 * 1. robots.txt advertised https://printyx.net/sitemap.xml and no sitemap was
 *    ever generated. Cloudflare Pages serves index.html for any unmatched path,
 *    so a crawler following that line got the SPA shell at 200 - a sitemap that
 *    parses as nothing, which is worse than a 404 because nothing reports it.
 *
 * 2. App.tsx's public-proposal early return claimed any /p/ segment of 20+
 *    characters was a share token, with a hardcoded exception list holding two
 *    of the three marketing slugs. The third,
 *    /p/master-product-catalog-canon-imagerunner, is 39 characters, so that
 *    landing page rendered the proposal viewer instead of itself - and it is in
 *    the sitemap, so the sitemap would have shipped a crawler at it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PUBLIC_ROUTES_SEO,
  MARKETING_P_SLUGS,
  getSitemapRoutes,
  SITE_URL,
} from '../../../client/src/lib/seo/seoConfig';

const root = process.cwd();
const sitemap = readFileSync(join(root, 'client/public/sitemap.xml'), 'utf8');
const robots = readFileSync(join(root, 'client/public/robots.txt'), 'utf8');
const appSource = readFileSync(join(root, 'client/src/App.tsx'), 'utf8');

const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

describe('sitemap.xml', () => {
  it('is well-formed and non-empty', () => {
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(locs.length).toBeGreaterThan(0);
  });

  it('lists exactly the indexable public routes', () => {
    const expected = getSitemapRoutes()
      .map((r) => `${SITE_URL}${r.canonicalPath ?? r.path}`)
      .sort();
    expect([...locs].sort()).toEqual(expected);
  });

  it('excludes every noindex route', () => {
    for (const route of PUBLIC_ROUTES_SEO.filter((r) => r.noindex)) {
      expect(locs).not.toContain(`${SITE_URL}${route.path}`);
    }
  });

  it('contains no duplicate URLs', () => {
    expect(new Set(locs).size).toBe(locs.length);
  });

  it('is the file robots.txt points at', () => {
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });

  it('lists no URL that robots.txt disallows', () => {
    const disallowed = robots
      .split('\n')
      .filter((line) => line.trim().startsWith('Disallow:'))
      .map((line) => line.slice(line.indexOf(':') + 1).trim())
      .filter(Boolean);
    for (const loc of locs) {
      const path = loc.slice(SITE_URL.length) || '/';
      const hit = disallowed.find((prefix) => path.startsWith(prefix));
      expect(hit, `${path} is in the sitemap and disallowed by "${hit}"`).toBeUndefined();
    }
  });
});

describe('/p/ marketing landing pages are not shadowed by the proposal viewer', () => {
  it('derives the slug set from the route table rather than a literal', () => {
    expect(appSource).toContain('MARKETING_P_SLUGS');
    // The old hardcoded set is what let the third slug through.
    expect(appSource).not.toContain('const marketingSlugs = new Set([');
  });

  it('covers every /p/ route in the SEO table, including long slugs', () => {
    const pRoutes = PUBLIC_ROUTES_SEO.filter((r) => r.path.startsWith('/p/'));
    expect(pRoutes.length).toBeGreaterThan(0);
    for (const route of pRoutes) {
      expect(MARKETING_P_SLUGS.has(route.path.slice(3))).toBe(true);
    }
    // Regression guard: the slug the length heuristic swallowed.
    expect(
      pRoutes.some((r) => r.path.slice(3).length >= 20),
      'the >= 20 char case is what broke; keep a long slug in this assertion',
    ).toBe(true);
  });
});
