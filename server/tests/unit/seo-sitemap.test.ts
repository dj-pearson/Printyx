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
  COMING_SOON_ROUTES,
  getSitemapRoutes,
  SITE_URL,
} from '../../../client/src/lib/seo/seoConfig';

const root = process.cwd();
const sitemap = readFileSync(join(root, 'client/public/sitemap.xml'), 'utf8');
const robots = readFileSync(join(root, 'client/public/robots.txt'), 'utf8');
const appSource = readFileSync(join(root, 'client/src/App.tsx'), 'utf8');

const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

/**
 * robots.txt is a set of groups, not a flat list. A rule only applies to the
 * user-agents named above it, so `Disallow: /` under CCBot says nothing about
 * Googlebot - reading the file flat reports the site as blocked when the
 * training-bot rules are doing their job. Returns the Disallow paths that apply
 * to a given agent, falling back to the `*` group.
 */
function disallowFor(agent: string): string[] {
  const groups = new Map<string, string[]>();
  let current: string[] = [];
  let expectingAgents = false;
  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      // Consecutive User-agent lines share one group of rules.
      if (!expectingAgents) current = [];
      expectingAgents = true;
      groups.set(value.toLowerCase(), current);
    } else if (key === 'disallow') {
      expectingAgents = false;
      if (value) current.push(value);
    } else {
      expectingAgents = false;
    }
  }
  return groups.get(agent.toLowerCase()) ?? groups.get('*') ?? [];
}

describe('sitemap.xml', () => {
  it('is well-formed and non-empty', () => {
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(locs.length).toBeGreaterThan(0);
  });

  it('lists exactly the routes that are live and indexable while the site is closed', () => {
    const expected = getSitemapRoutes(true)
      .map((r) => `${SITE_URL}${r.canonicalPath ?? r.path}`)
      .sort();
    expect([...locs].sort()).toEqual(expected);
  });

  it('lists no route that serves the holding page', () => {
    for (const loc of locs) {
      const path = loc.slice(SITE_URL.length) || '/';
      expect(COMING_SOON_ROUTES, `${path} serves the noindex holding page`).toContain(path);
    }
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

  it.each(['*', 'Googlebot', 'Bingbot'])(
    'lists no URL that robots.txt disallows for %s',
    (agent) => {
      const disallowed = disallowFor(agent);
      for (const loc of locs) {
        const path = loc.slice(SITE_URL.length) || '/';
        const hit = disallowed.find((prefix) => path.startsWith(prefix));
        expect(hit, `${path} is in the sitemap and disallowed by "${hit}"`).toBeUndefined();
      }
    },
  );
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

describe('the closed-site route list matches App.tsx', () => {
  /**
   * COMING_SOON_ROUTES drives what the sitemap publishes; App.tsx's Switch
   * decides what actually renders. If someone routes a new page while the site
   * is closed and does not add it here, the sitemap silently omits a live page;
   * if they remove one, the sitemap publishes a URL that serves the holding
   * page. Neither shows up anywhere else.
   */
  it('has the same paths as the closed-site Switch', () => {
    const start = appSource.indexOf('if (COMING_SOON) {');
    expect(start).toBeGreaterThan(-1);
    const block = appSource.slice(start, appSource.indexOf('</Switch>', start));
    const routed = [...block.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
    expect([...routed].sort()).toEqual([...COMING_SOON_ROUTES].sort());
  });
});

describe('robots.txt while the site is closed', () => {
  /**
   * Deliberately NOT `Disallow: /`. A blocked crawler never fetches the page
   * and so never sees the noindex meta, which leaves already-indexed URLs
   * indexed with no way to drop them. Let them crawl and read the noindex.
   */
  it('does not block search or AI-search crawlers', () => {
    for (const agent of ['*', 'Googlebot', 'Bingbot', 'GPTBot', 'ClaudeBot', 'PerplexityBot']) {
      expect(disallowFor(agent), `${agent} is blocked site-wide`).not.toContain('/');
    }
  });

  it('still blocks the training-only crawlers', () => {
    // ClaudeBot fetches a page to answer a question and cites it; anthropic-ai
    // does not. Allowing one and blocking the other is deliberate.
    for (const agent of ['CCBot', 'anthropic-ai', 'GPTBot-training', 'Bytespider', 'Diffbot']) {
      expect(disallowFor(agent), `${agent} should be blocked`).toContain('/');
    }
  });
});

describe('the static head agrees with the coming-soon gate', () => {
  it('vite rewrites the robots meta to noindex when the site is closed', () => {
    const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
    expect(vite).toContain('printyx-robots-meta');
    expect(vite).toContain("process.env.VITE_COMING_SOON !== 'false'");
    expect(vite).toContain('noindex, nofollow');
  });
});
