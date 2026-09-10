/**
 * Every /api/seo URL the SEO pages call must resolve to a route Express
 * registers, or be named in the PRD as known-broken (SEO-004).
 *
 * SEODashboard was written against /api/seo/<noun>/<verb>; server/routes-seo.ts
 * registers /api/seo/<verb>/<noun>. Twelve of the page's endpoints therefore
 * POSTed to a path no router had and failed in dev and production alike. The
 * implementations behind the real URLs are genuine - real Drizzle tables, and
 * checkCoreWebVitals calls the PageSpeed Insights API and throws without a key
 * rather than inventing numbers - so nothing was mocked; the two halves were
 * simply never connected.
 *
 * check:edge-coverage tracks what the EDGE function lacks, which reads as
 * "Express serves this and prod does not". Nothing checked the Express side.
 * This does.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const express =
  readFileSync(join(root, 'server/routes-seo.ts'), 'utf8') +
  readFileSync(join(root, 'server/routes-seo-core.ts'), 'utf8');
const prd = JSON.parse(
  readFileSync(join(root, 'tasks/prd-seo-dashboard-endpoints.json'), 'utf8'),
) as { remaining: { frontend: string }[] };

/** Registered Express paths, with :params collapsed so /audit/:id matches. */
const registered = new Set(
  [...express.matchAll(/router\.(?:get|post|put|delete|patch)\('(\/api\/seo[^']*)'/g)].map(
    (m) => m[1],
  ),
);

/** URLs the PRD already records as broken; they are work, not surprises. */
const knownBroken = new Set(
  prd.remaining.map((r) => r.frontend.split(' ')[1]).filter((u) => u.startsWith('/api/seo')),
);

function calledUrls(file: string): string[] {
  const src = readFileSync(join(root, file), 'utf8');
  return [...new Set([...src.matchAll(/'(\/api\/seo[a-z0-9/-]*)'/g)].map((m) => m[1]))];
}

/** Edge-only routes: real, but reachable in production rather than dev. */
const EDGE_ONLY = new Set(['/api/seo/pages', '/api/seo/sitemap/generate']);

describe.each(['client/src/pages/SEODashboard.tsx', 'client/src/pages/RootAdminSEO.tsx'])(
  '%s',
  (file) => {
    it('calls no /api/seo URL that is neither registered nor a tracked defect', () => {
      const orphans = calledUrls(file).filter((url) => {
        if (registered.has(url)) return false;
        if (knownBroken.has(url)) return false;
        if (EDGE_ONLY.has(url)) return false;
        // /api/seo/audit/history is registered; /api/seo/audit resolves via
        // POST. Accept a URL whose parent path is registered with a :param.
        return ![...registered].some((r) => r.replace(/\/:[^/]+/g, '') === url);
      });
      expect(orphans).toEqual([]);
    });
  },
);

describe('the four endpoints SEO-004 repointed', () => {
  it.each([
    ['/api/seo/check/mobile', 'mobile/analyze'],
    ['/api/seo/core-web-vitals', 'performance/check'],
    ['/api/seo/check/security', 'security/analyze'],
    ['/api/seo/analyze/semantic', 'semantic/analyze'],
  ])('%s is registered and the dead %s is gone', (real, dead) => {
    expect(registered.has(real)).toBe(true);
    const dash = readFileSync(join(root, 'client/src/pages/SEODashboard.tsx'), 'utf8');
    expect(dash).toContain(`apiRequest('${real}'`);
    expect(dash.replace(/\/\/.*$/gm, '')).not.toContain(`'/api/seo/${dead}'`);
  });
});

describe('SEO-004 second tranche: shapes match the real columns', () => {
  /**
   * Repointing the URL alone would have given a working request and a blank
   * table. The page's interfaces described a shape no endpoint has ever
   * returned - src/alt/dimensions for images, url/sourcePages/recommendation
   * for links, url/finalUrl/redirectCount for redirects - and the responses are
   * bare arrays while the page read data.images / data.brokenLinks /
   * data.chains off them. This is the BATCH 7 phantom-shape class at response
   * level: nothing errors, the panel just stays empty.
   */
  const dash = readFileSync(join(root, 'client/src/pages/SEODashboard.tsx'), 'utf8');
  const schema = readFileSync(join(root, 'shared/seo-schema.ts'), 'utf8');

  function columnsOf(table: string): Set<string> {
    const start = schema.indexOf(`export const ${table} = pgTable(`);
    expect(start, `${table} not found`).toBeGreaterThan(-1);
    const body = schema.slice(start, schema.indexOf('\n);', start));
    return new Set([...body.matchAll(/^\s{4}(\w+):\s/gm)].map((m) => m[1]));
  }

  function fieldsOf(iface: string): string[] {
    const start = dash.indexOf(`interface ${iface} {`);
    expect(start, `${iface} not found`).toBeGreaterThan(-1);
    const body = dash.slice(start, dash.indexOf('\n}', start));
    return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
  }

  it.each([
    ['ImageAnalysis', 'seoImageAnalysis'],
    ['BrokenLink', 'seoLinkAnalysis'],
    ['RedirectChain', 'seoRedirectAnalysis'],
    ['StructuredDataResult', 'seoStructuredData'],
  ])('%s names only columns %s has', (iface, table) => {
    const columns = columnsOf(table);
    const phantom = fieldsOf(iface).filter((f) => !columns.has(f));
    expect(phantom).toEqual([]);
  });

  it('reads the bare arrays these endpoints return, not a wrapper key', () => {
    // Each of these was a read off an array, so it resolved to undefined and
    // the `|| []` fallback made the panel look like "no results".
    //
    // Comments are stripped first: the code's own notes explaining the fix name
    // the very strings this asserts are gone, and would clear the assertion.
    const code = dash.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('data.images');
    expect(code).not.toContain('data.brokenLinks');
    expect(code).not.toContain('data.chains');
    expect(code).not.toContain('structuredDataResults.schemas');
  });
});

describe('the broken-link checker does not report unchecked links as healthy', () => {
  /**
   * checkBrokenLinks fetches only the first CHECKED_LINK_LIMIT links on a page.
   * statusCode and isBroken were initialised to 200 and false and stored that
   * way, so every link past the twentieth was persisted as a working link that
   * nothing had ever requested - a page with 200 links reported 180 healthy on
   * no evidence at all.
   */
  const service = readFileSync(join(root, 'server/services/seo-service.ts'), 'utf8');

  it('initialises an unchecked link to null, not to 200/false', () => {
    expect(service).toContain('let statusCode: number | null = null;');
    expect(service).toContain('let isBroken: boolean | null = null;');
    expect(service).not.toContain('let statusCode = 200;');
  });

  it('shares one limit between the fetch gate and the rate limiter', () => {
    expect(service).toContain('export const CHECKED_LINK_LIMIT = 20;');
    expect(service.match(/i < CHECKED_LINK_LIMIT/g)?.length).toBe(2);
  });

  it('the page counts unchecked links rather than hiding them', () => {
    const dash = readFileSync(join(root, 'client/src/pages/SEODashboard.tsx'), 'utf8');
    expect(dash).toContain('uncheckedLinkCount');
    expect(dash).toContain('link.isBroken === true');
    expect(dash).toContain('link.isBroken === null');
  });
});

describe('no endpoint reports success for work it did not do (SEO-005)', () => {
  /**
   * POST /api/seo/regenerate-{sitemap,robots,llms} each answered
   * "... regenerated successfully" and did nothing at all - their own comments
   * said so. Three buttons on the routed root-admin SEO page showed a green
   * toast for an action that never happened, which is worse than a 404 because
   * a 404 gets reported and a success toast gets believed.
   *
   * They are deleted rather than implemented: GET /sitemap.xml, /robots.txt and
   * /llms.txt compose their response per request so there is no cached artifact
   * to invalidate, and the files the public actually receives are static build
   * output that no runtime handler can rewrite.
   *
   * Comments are stripped: the notes left behind name the endpoints.
   */
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const core = strip(readFileSync(join(root, 'server/routes-seo-core.ts'), 'utf8'));
  const admin = strip(readFileSync(join(root, 'client/src/pages/RootAdminSEO.tsx'), 'utf8'));

  it.each(['regenerate-sitemap', 'regenerate-robots', 'regenerate-llms'])(
    '%s is gone from the server',
    (endpoint) => {
      expect(core).not.toContain(endpoint);
    },
  );

  it('the buttons that called them are gone from the page', () => {
    expect(admin).not.toContain('regenerateSitemap');
    expect(admin).not.toContain('regenerateRobots');
    expect(admin).not.toContain('regenerateLlms');
    expect(admin).not.toContain('Generate Sitemap');
  });

  it('the public read handlers those buttons pretended to refresh still work', () => {
    // Deleting the no-ops must not take the real handlers with them.
    for (const route of ["'/sitemap.xml'", "'/robots.txt'", "'/llms.txt'"]) {
      expect(core).toContain(`app.get(${route}`);
    }
  });
});
