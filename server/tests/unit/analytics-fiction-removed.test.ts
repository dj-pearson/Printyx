/**
 * /api/analytics/{conversion-metrics,activity-nudges,control-charts,trend-widgets}
 * never touched a database (PA-040).
 *
 * server/analytics-routes.ts was 184 lines and four handlers, each returning a
 * hardcoded object: a 65% lead-to-qualified rate, a 45-day average cycle, four
 * ranked loss reasons, and control charts with sigma bands over invented
 * points. The two components that called it wrapped every request in
 * `select: (data) => data || { ...the same numbers... }`, so the fallback and
 * the "real" response agreed - and in production, where the analytics edge
 * function has no branch for any of the four, all of them 404'd and the
 * fallback was the only thing anyone ever saw.
 *
 * That makes this the fourth instance of the AUDIT-019 class where the
 * fabricated value is not a fallback at all but the primary path. The fix is
 * the one AUDIT-016 and LEGAL-010 set: delete the claim, say what is missing.
 *
 * Comments are stripped before matching, because several of these assertions
 * name the very strings the headers explain (the check:edge-coverage lesson).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const conversion = read('client/src/components/analytics/ConversionInsights.tsx');
const trends = read('client/src/components/analytics/PipelineTrendWidgets.tsx');
const registry = read('server/routes-registry.ts');

describe('the router is gone', () => {
  it('deleted the file', () => {
    expect(existsSync(join(repo, 'server/analytics-routes.ts'))).toBe(false);
  });

  it('is no longer imported or mounted', () => {
    expect(registry).not.toMatch(/import\('\.\/analytics-routes'\)/);
    expect(registry).not.toMatch(/analyticsRouter/);
  });

  it('leaves no crmProxies entry behind for the prefix', () => {
    // Proxying /api/analytics would forward the whole prefix to an edge
    // function that answers none of these four paths.
    const proxy = read('server/middleware/edge-function-proxy.ts');
    expect(proxy).not.toMatch(/'\/api\/analytics'\s*:/);
  });
});

describe('the components say nothing rather than something false', () => {
  it.each([
    ['ConversionInsights', conversion],
    ['PipelineTrendWidgets', trends],
  ])('%s renders NotConnectedState', (_name, src) => {
    expect(src).toMatch(/from '@\/components\/ui\/not-connected-state'/);
    expect(src).toMatch(/<NotConnectedState/);
    expect(src).toMatch(/storyRef="PA-040"/);
  });

  it.each([
    ['ConversionInsights', conversion],
    ['PipelineTrendWidgets', trends],
  ])('%s issues no query at all', (_name, src) => {
    // Not just "no fallback" - there is no endpoint to call. A useQuery here
    // would 404 in production and render an error where the honest statement
    // belongs.
    expect(src).not.toMatch(/useQuery/);
    expect(src).not.toMatch(/apiRequest/);
    expect(src).not.toMatch(/\/api\/analytics/);
  });

  it('no longer carries the invented figures', () => {
    const both = conversion + trends;
    for (const figure of ['65', '45', '72', '38', '8.2', 'lossReasons', 'sigma']) {
      expect(both).not.toContain(figure);
    }
  });
});

describe('the callers still compile against them', () => {
  it('LeadDeals renders both without props they no longer take', () => {
    const leadDeals = read('client/src/components/leads/LeadDeals.tsx');
    expect(leadDeals).toMatch(/<ConversionInsights/);
    expect(leadDeals).toMatch(/<PipelineTrendWidgets \/>/);
  });
});
