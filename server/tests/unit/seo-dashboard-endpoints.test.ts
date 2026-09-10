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

describe('the endpoints SEO-004 repointed', () => {
  /**
   * semantic/analyze was in this list until SEO-008. Repointing it at
   * /api/seo/analyze/semantic connected the button to a TODO stub that returned
   * intentConfidence 80 for every keyword, so the endpoint answers 501 now and
   * the panel is gated rather than wired. Fixing a URL is not the same as
   * checking what is behind it, and that is the lesson.
   */
  it.each([
    ['/api/seo/check/mobile', 'mobile/analyze'],
    ['/api/seo/core-web-vitals', 'performance/check'],
    ['/api/seo/check/security', 'security/analyze'],
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

describe('one sitemap and one robots.txt (SEO-006)', () => {
  /**
   * server/routes-seo-core.ts composed both files per request from seo_pages
   * and seo_settings, and registerSeoCoreRoutes runs before serveStatic - so
   * those handlers won wherever Express served the app, while Cloudflare Pages,
   * which is what the public hits, served the static files. Two sitemaps and
   * two robots.txt, one URL each, and nothing compared them.
   *
   * The DB-derived sitemap was also wrong on its own terms. The boot seed puts
   * /crm, /reports, /product-hub, /service-hub and /product-catalog into
   * seo_pages, so it published five login-walled routes - and /reports is
   * disallowed by the robots.txt served beside it.
   */
  const core = readFileSync(join(root, 'server/routes-seo-core.ts'), 'utf8');
  const coreCode = core.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('Express serves both files from disk rather than composing them', () => {
    expect(coreCode).toContain("app.get('/sitemap.xml', publicFile('sitemap.xml'");
    expect(coreCode).toContain("app.get('/robots.txt', publicFile('robots.txt'");
  });

  it('no longer builds a urlset or a User-agent block in code', () => {
    expect(coreCode).not.toContain('<urlset');
    expect(coreCode).not.toContain('GPTBot');
    expect(coreCode).not.toContain('CCBot');
  });

  it('publishes none of the login-walled routes the boot seed puts in seo_pages', () => {
    const sitemap = readFileSync(join(root, 'client/public/sitemap.xml'), 'utf8');
    for (const appRoute of [
      '/crm',
      '/reports',
      '/product-hub',
      '/service-hub',
      '/product-catalog',
    ]) {
      expect(sitemap, `${appRoute} is login-walled`).not.toContain(
        `<loc>https://printyx.net${appRoute}</loc>`,
      );
    }
  });

  it('prefers client/public in development so a stale dist cannot win', () => {
    // dist/ is whatever the last build left behind, which can be weeks old.
    expect(coreCode).toContain("process.env.NODE_ENV === 'production'");
  });
});

describe('no SEO endpoint stores an invented measurement (SEO-008)', () => {
  /**
   * Five functions in routes-seo.ts were TODO stubs that returned made-up
   * numbers, and their handlers STORED those numbers and served them as results:
   *
   *   analyzePage             title 'Page Title', readingLevel 8.5,
   *                           uniqueContentPercentage 90
   *   optimizeContent         readabilityScore 75, seoScore 80
   *   analyzeSemanticKeywords intentConfidence 80, searchIntent 'informational'
   *   detectDuplicateContent  similarityScore 0 - which asserts two pages are
   *                           not duplicates without comparing them
   *   analyzeCompetitor       domain authority, traffic and backlinks all 0
   *
   * A stub that throws gets fixed; a stub that returns 75 gets believed. Worse,
   * iteration 5 of this loop repointed the semantic button at the correct URL
   * and so connected a live button to the fabricator - which is why the audit
   * exists at all. All five answer 501 now.
   */
  const routes = readFileSync(join(root, 'server/routes-seo.ts'), 'utf8');
  const code = routes.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it.each([
    'detectDuplicateContent',
    'optimizeContent',
    'analyzeSemanticKeywords',
    'analyzeCompetitor',
    'analyzePage',
  ])('%s no longer exists', (fn) => {
    expect(code).not.toContain(`async function ${fn}(`);
    expect(code).not.toContain(`await ${fn}(`);
  });

  it('the values they invented appear nowhere', () => {
    for (const invented of [
      "'Page Title'",
      'readingLevel: 8.5',
      'uniqueContentPercentage: 90',
      'readabilityScore: 75',
      'seoScore: 80',
      'intentConfidence: 80',
    ]) {
      expect(code, `${invented} was a fabricated measurement`).not.toContain(invented);
    }
  });

  it('all five endpoints answer 501', () => {
    expect(code.match(/NOT_IMPLEMENTED/g)?.length).toBe(5);
    for (const route of [
      '/api/seo/analyze/page',
      '/api/seo/detect/duplicate-content',
      '/api/seo/optimize/content',
      '/api/seo/analyze/semantic',
      '/api/seo/analyze/competitor',
    ]) {
      expect(code).toContain(route);
    }
  });

  it('the real analysers are untouched - they fetch the page and measure it', () => {
    const service = readFileSync(join(root, 'server/services/seo-service.ts'), 'utf8');
    for (const fn of [
      'checkBrokenLinks',
      'checkSecurityHeaders',
      'validateStructuredData',
      'detectRedirectChains',
      'checkCoreWebVitalsWithAPI',
    ]) {
      expect(service).toContain(`export async function ${fn}`);
    }
    // PageSpeed refuses rather than guessing when it has no key.
    expect(service).toContain('PageSpeed Insights API key not configured');
  });

  it('the three panels behind those endpoints say so instead of offering a scan', () => {
    const dash = readFileSync(join(root, 'client/src/pages/SEODashboard.tsx'), 'utf8');
    expect(dash.match(/Not implemented/g)?.length).toBe(3);
    const dashCode = dash.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    expect(dashCode).not.toContain('Scan for Duplicates');
    expect(dashCode).not.toContain('optimizeContentMutation');
    expect(dashCode).not.toContain('analyzeSemanticMutation');
  });

  it('link analysis uses the endpoint that already returns every link', () => {
    // There was never a links/analyze endpoint, and there does not need to be:
    // check/broken-links stores the whole link profile, not just the broken ones.
    const dash = readFileSync(join(root, 'client/src/pages/SEODashboard.tsx'), 'utf8');
    expect(dash.replace(/\/\/.*$/gm, '')).not.toContain('/api/seo/links/analyze');
    expect(dash.match(/'\/api\/seo\/check\/broken-links'/g)?.length).toBe(2);
  });
});
