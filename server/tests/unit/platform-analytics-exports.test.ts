// UI-DEAD-BUTTONS-001 (round 204). Export on PlatformAnalytics and
// PlatformCohortAnalysis, and Export Data on PlatformCRMDashboard, had no
// handler; PlatformAnalytics also carried a Filter button that did nothing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { platformMetricRows } from '../../../client/src/lib/platform-analytics-export';

const read = (f: string) =>
  readFileSync(f, 'utf8')
    .replace(/(?<![:/'"`])\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('platformMetricRows', () => {
  it('writes an unmeasured figure as null, never as 0, and keeps a real 0', () => {
    const rows = platformMetricRows({
      revenue: { mrr: 1200, ltv: null, churnRate: 0 },
      pipeline: {},
    });
    const get = (m: string) => rows.find((r) => r.metric === m)?.value;
    expect(get('MRR')).toBe(1200);
    expect(get('LTV')).toBeNull();
    expect(get('Churn rate %')).toBe(0);
    expect(get('Total value')).toBeNull();
  });

  it('expands the funnel, sources, activity and growth series', () => {
    const rows = platformMetricRows({
      conversion: { funnelData: [{ stage: 'Lead', count: 9, percentage: 100 }] },
      performance: {
        sourceData: [{ source: 'Web', leads: 5, conversions: 2, rate: 40 }],
        activityTotals: { calls: 3, emails: 4 },
      },
      growth: { revenueData: [{ month: '2026-08', mrr: 50, arr: 600 }] },
    });
    expect(rows).toContainEqual({ section: 'Funnel', metric: 'Lead', value: 9 });
    expect(rows).toContainEqual({ section: 'Lead source', metric: 'Web conversions', value: 2 });
    expect(rows).toContainEqual({ section: 'Activity', metric: 'emails', value: 4 });
    expect(rows).toContainEqual({ section: 'Growth', metric: '2026-08 MRR', value: 50 });
  });
});

describe('pages', () => {
  it('PlatformAnalytics exports all five query results and has no dead Filter', () => {
    const src = read('client/src/pages/PlatformAnalytics.tsx');
    const at = src.indexOf('platformMetricRows({');
    const call = src.slice(at, src.indexOf('})', at));
    for (const q of [
      'revenueQuery',
      'conversionQuery',
      'pipelineQuery',
      'performanceQuery',
      'growthQuery',
    ]) {
      expect(call).toContain(`${q}.data`);
    }
    expect(src).not.toMatch(/>\s*Filter\s*<\/Button>/);
  });

  it('PlatformCohortAnalysis exports the cohort table the page shows', () => {
    const src = read('client/src/pages/PlatformCohortAnalysis.tsx');
    expect(src).toMatch(
      /exportToCSV\(cohortQuery\.data\?\.cohortTable \?\? \[\], COHORT_EXPORT_COLUMNS/,
    );
    // Every exported column is a field of the row type.
    const iface = src.slice(
      src.indexOf('interface CohortRow {'),
      src.indexOf('}', src.indexOf('interface CohortRow {')),
    );
    const cols = src.slice(
      src.indexOf('COHORT_EXPORT_COLUMNS'),
      src.indexOf('];', src.indexOf('COHORT_EXPORT_COLUMNS')),
    );
    const keys = [...cols.matchAll(/key: '([A-Za-z]+)'/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(5);
    for (const k of keys) expect(iface).toMatch(new RegExp(`\\b${k}:`));
  });

  it('PlatformCRMDashboard Export Data downloads through the records export, with auth', () => {
    const src = read('client/src/pages/PlatformCRMDashboard.tsx');
    expect(src).toMatch(
      /await downloadAuthedFile\(\s*'\/api\/platform-crm\/business-records\/export'/,
    );
    expect(src).toMatch(/describeApiError\(error\)\.message/);
    const fn = read('supabase/functions/platform-crm/index.ts');
    expect(fn).toContain(
      "req.method === 'GET' && endpoint === 'business-records' && resourceId === 'export'",
    );
  });
});
