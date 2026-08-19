// PROD-014: GET /api/seo/crawl/results is what SEODashboard calls, and only the
// /:crawlId route existed on either backend. The request arrived with
// crawlId = 'results' and filtered crawl_id = 'results' — no crawl is ever given
// that id, so the panel returned [] forever, in dev as well as production.
//
// The fix is a real "latest crawl" route registered ABOVE /:crawlId. Placed
// after it, Express and the edge function both match the parameterized route
// first and the bug returns unchanged, so the order is asserted on the source.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const express = readFileSync(join(process.cwd(), 'server/routes-seo.ts'), 'utf-8');
const edge = readFileSync(join(process.cwd(), 'supabase/functions/seo/index.ts'), 'utf-8');
const page = readFileSync(join(process.cwd(), 'client/src/pages/SEODashboard.tsx'), 'utf-8');

describe('the literal route precedes the parameterized one', () => {
  it('on Express', () => {
    const literal = express.indexOf("router.get('/api/seo/crawl/results'");
    const param = express.indexOf("router.get('/api/seo/crawl/:crawlId'");
    expect(literal).toBeGreaterThan(-1);
    expect(param).toBeGreaterThan(-1);
    expect(literal).toBeLessThan(param);
  });

  it('on the edge function', () => {
    const literal = edge.indexOf("resource === 'crawl' && resourceId === 'results'");
    const param = edge.indexOf("resource === 'crawl' && resourceId)");
    expect(literal).toBeGreaterThan(-1);
    expect(param).toBeGreaterThan(-1);
    expect(literal).toBeLessThan(param);
  });
});

describe('both backends resolve "results" to the latest crawl', () => {
  it('finds the newest crawl id first, then its pages', () => {
    for (const [name, src, marker] of [
      ['express', express, "router.get('/api/seo/crawl/results'"],
      ['edge', edge, "resource === 'crawl' && resourceId === 'results'"],
    ] as const) {
      const at = src.indexOf(marker);
      const branch = src.slice(at, at + 1800);
      expect(branch, name).toMatch(/crawl_?[iI]d/);
      expect(branch, name).toMatch(/crawled_?[aA]t/);
      expect(branch, name).toMatch(/limit\(1\)/);
    }
  });

  it('returns an empty list when there has never been a crawl', () => {
    expect(express).toContain('if (!latest?.crawlId) return res.json([]);');
    expect(edge).toContain('if (!latest?.crawl_id) return createCorsResponse([], 200, req);');
  });

  it('scopes to the tenant on both sides', () => {
    // Bound the slice at the next branch — a fixed window runs into it and
    // counts its tenant filter too.
    const at = edge.indexOf("resource === 'crawl' && resourceId === 'results'");
    const end = edge.indexOf("resource === 'crawl' && resourceId)", at);
    const branch = edge.slice(at, end);
    expect(branch.match(/eq\('tenant_id', tenantId\)/g)?.length).toBe(2);
    const eat = express.indexOf("router.get('/api/seo/crawl/results'");
    expect(express.slice(eat, eat + 1800)).toContain('seoCrawlResults.tenantId');
  });
});

describe('the dashboard reads the endpoint that holds page scores', () => {
  it('calls /api/seo/page-scores, not /api/seo/pages', () => {
    // /api/seo/pages selects from a table that is in no schema and no migration
    // — on Express that is a 500. page-scores is the real one.
    expect(page).toContain("queryKey: ['/api/seo/page-scores']");
    expect(page).not.toContain("queryKey: ['/api/seo/pages']");
  });

  it('is implemented on both backends', () => {
    expect(edge).toContain("resource === 'page-scores'");
    expect(express).toContain("router.get('/api/seo/page-scores'");
  });
});
