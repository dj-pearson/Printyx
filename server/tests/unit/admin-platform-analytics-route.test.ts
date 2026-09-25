// Round 209. The admin sidebar's "Platform Analytics" (/admin/platform-analytics)
// rendered AdvancedAnalyticsDashboard, which read eleven top-level sections
// (executiveSummary, revenueAnalytics, competitiveAnalysis...) from
// /api/analytics/dashboard, an endpoint answering { period, metrics }. The first
// read dereferenced undefined, so the page crashed as soon as data arrived. The
// route renders PlatformAnalytics now, the page is deleted, and its unlinked
// old URL redirects to the live /advanced-analytics hub.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const strip = (s: string) =>
  s
    .replace(/(?<![:/'"`])\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const APP = strip(readFileSync('client/src/App.tsx', 'utf8'));
const NAV = readFileSync('client/src/lib/navigation-permissions.ts', 'utf8');

describe('platform analytics route', () => {
  it('renders PlatformAnalytics behind the admin guard', () => {
    expect(APP).toMatch(
      /<Route path="\/admin\/platform-analytics">\s*\{\(\) => <AdminRouteGuard component=\{PlatformAnalytics\} \/>\}/,
    );
  });

  it('keeps both paths at root-admin level', () => {
    expect(NAV).toContain("'/admin/platform-analytics': { minLevel: 7 }");
    expect(NAV).toContain("'/platform-crm/analytics': { minLevel: 7 }");
  });

  it('deletes the fixture page and redirects its old URL to a gated target', () => {
    expect(existsSync('client/src/pages/AdvancedAnalyticsDashboard.tsx')).toBe(false);
    expect(APP).not.toContain('AdvancedAnalyticsDashboard');
    expect(APP).toMatch(
      /<Route path="\/advanced-analytics-dashboard">\s*\{\(\) => <LegacyRedirect to="\/advanced-analytics" \/>\}/,
    );
    // The old entry stays and the target carries its own gate.
    expect(NAV).toContain("'/advanced-analytics-dashboard': {");
    expect(NAV).toContain("'/advanced-analytics': {");
  });
});

describe('/analytics/sales', () => {
  const src = strip(readFileSync('supabase/functions/analytics/index.ts', 'utf8'));
  const at = src.indexOf("metricType === 'sales'");
  const body = src.slice(at, src.indexOf("metricType === 'service'", at));

  it('reads its quotes as rows, not as a { data, error } response', () => {
    expect(body).toMatch(/const quotes = await fetchAllRows<any>\(\(\) =>/);
    expect(body).not.toContain('quotes.data');
  });
});
