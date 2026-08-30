/**
 * Seventeen revenue metrics, none of which ever resolved (PA-040).
 *
 * PlatformAnalytics is the sibling of the cohort page fixed alongside it, and
 * failed the same way: /api/platform-analytics/revenue-metrics answered
 * { metrics: {...}, counts: {...} } with every value .toFixed(2)'d into a
 * STRING, while the page read revenueMetrics.mrr, .arr, .grr and fourteen more
 * at the top level. All seventeen resolved to undefined, so `|| 89000`,
 * `|| 1068000`, `|| 347`, `|| 112` rendered on every request, in dev and
 * production alike.
 *
 * CLAUDE.md's BATCH 9 note recorded the nested-vs-flat mismatch for the whole
 * function. Checking each endpoint rather than trusting that: only
 * revenue-metrics was nested. conversion-metrics, pipeline-metrics,
 * performance-metrics and growth-trends were already flat and already matched.
 *
 * TWO METRICS WERE WORSE THAN UNRESOLVED. estimatedCAC was `ltv / 3`, so
 * ltvCacRatio was `ltv / (ltv / 3)` - exactly 3.00 for every tenant on every
 * request, a tautology presented as a measurement. Both are null now, and named.
 *
 * Comments are stripped: the notes left behind name every literal they replaced.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const page = read('client/src/pages/PlatformAnalytics.tsx');
const fn = read('supabase/functions/platform-analytics/index.ts');
const revenue = fn.slice(
  fn.indexOf("endpoint === 'revenue-metrics'"),
  fn.indexOf("endpoint === 'conversion-metrics'"),
);

describe('revenue-metrics is flat', () => {
  it('no longer nests under metrics/counts', () => {
    expect(revenue).not.toMatch(/^\s*metrics: \{/m);
    expect(revenue).not.toMatch(/^\s*counts: \{/m);
  });

  it('returns numbers, not toFixed strings', () => {
    // The page formats; a pre-formatted string cannot be summed or compared.
    expect(revenue).toMatch(/mrr: totalMRR,/);
    expect(revenue).not.toMatch(/mrr: totalMRR\.toFixed/);
  });

  it('sends every key the page reads', () => {
    const readKeys = [...page.matchAll(/revenueMetrics\??\.(\w+)/g)].map((m) => m[1]);
    expect(readKeys.length).toBeGreaterThan(0);
    for (const key of new Set(readKeys)) {
      // `grr,` is shorthand for `grr: grr`, so accept either spelling.
      expect(revenue).toMatch(new RegExp(`\\b${key}[,:]`));
    }
  });
});

describe('the metrics that were tautologies', () => {
  it('stops computing CAC as a third of LTV', () => {
    // ltvCacRatio was ltv / (ltv / 3) = exactly 3.00, always.
    // The computation, not the prose: the `unbacked` string explains what was
    // removed and names `ltv / 3` on purpose, and it is response CONTENT rather
    // than a comment, so stripping comments does not hide it.
    expect(revenue).not.toContain('estimatedCAC');
    expect(revenue).not.toMatch(/const \w+ = ltv \/ 3/);
  });

  it('returns null for CAC, the ratio and payback, and says why', () => {
    for (const key of ['cac: null', 'ltvCacRatio: null', 'paybackPeriod: null']) {
      expect(revenue).toContain(key);
    }
    expect(revenue).toContain('nothing records acquisition cost');
  });

  it('returns null for NRR rather than restating GRR', () => {
    // expansionRate was hardcoded 0, so nrr = grr + 0.
    expect(revenue).toContain('nrr: null');
    expect(revenue).toContain('expansionRate: null');
  });

  it('returns null for LTV when nothing has churned', () => {
    // Average lifetime is 1/churn; the 24-month default was a number somebody
    // picked.
    expect(revenue).toMatch(/churnRate > 0 \? 1 \/ \(churnRate \/ 100\) : null/);
    expect(revenue).not.toContain(': 24;');
  });
});

describe('the page', () => {
  it('keeps no invented fallback', () => {
    for (const literal of ['89000', '1068000', '347', '112.4', '18432', '3250', '5.67', '4.7']) {
      expect(page).not.toContain(literal);
    }
  });

  it('shows a dash rather than a plausible number', () => {
    expect(page).toContain('function metricOrDash');
    expect(page).toMatch(/value == null \? '—'/);
  });

  it('carries no typed period-over-period delta', () => {
    // Every card had one - +14.1%, +16.4%, +8.7%, +2.3% "vs. last period" -
    // and nothing on this page records a previous period.
    expect(page).not.toContain('vs. last period');
    expect(page).not.toMatch(/change=\{[0-9.-]+\}/);
  });

  it('renders the unbacked note the endpoint sends', () => {
    expect(page).toContain('revenueMetrics.unbacked');
    expect(page).toContain('Not shown, because it is not measured');
  });

  it('reads the activity totals that were already being returned', () => {
    // 1450 calls, 2340 emails, 687 meetings were typed in while
    // performance-metrics returned real activityTotals nobody read.
    expect(page).toContain('activityTotals');
    expect(page).toContain('activityAvgPerDay');
    expect(page).not.toContain('1450');
    expect(page).not.toContain('2340');
  });
});

describe('the other four endpoints were already flat', () => {
  it.each(['conversion-metrics', 'pipeline-metrics', 'performance-metrics', 'growth-trends'])(
    '%s answers keys the page reads at the top level',
    (endpoint) => {
      const start = fn.indexOf(`endpoint === '${endpoint}'`);
      expect(start).toBeGreaterThan(-1);
      const branch = fn.slice(start, start + 6000);
      // Each of these was already correct; the BATCH 9 note generalised from
      // revenue-metrics to the whole function.
      expect(branch).not.toMatch(/^\s*metrics: \{/m);
    },
  );
});
