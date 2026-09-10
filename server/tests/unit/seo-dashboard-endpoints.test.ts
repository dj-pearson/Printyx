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
