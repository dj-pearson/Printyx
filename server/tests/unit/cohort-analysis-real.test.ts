/**
 * A whole cohort study, and none of it came from the query (PA-040).
 *
 * PlatformCohortAnalysis is routed behind AdminRouteGuard and DID call
 * /api/platform-analytics/cohort-analysis. The endpoint answered
 * { cohorts, summary }; the page read cohortTable, revenueCohorts and ltvData.
 * All three resolved to undefined, so every `?? [...]` fallback rendered - in
 * dev and production alike. A platform admin saw 79.4% three-month retention,
 * 56.2% at twelve months, $20,605 LTV, a 6.92:1 ratio, a retention curve from
 * 100 down to 56.2, and a recommendation to scale acquisition spend because
 * "CAC has decreased by 18% while LTV has increased by 23%". Every number typed
 * in by hand.
 *
 * Three separate guards each held a piece of this page - check:fabricated (the
 * `?? [...]` reads), check:no-static-posture (the four headline cards) and
 * CR-033's note about the same shape on PlatformAnalytics - and none of them
 * said the endpoint answers different keys, which is what made the fallbacks
 * permanent rather than occasional.
 *
 * WHAT THE TABLE CANNOT ANSWER is the interesting half.
 * platform_cohort_analysis holds ONE ROW PER COHORT - initial_size,
 * current_size, retention_rate, one MRR pair - and no per-period history. A
 * month-by-month retention curve needs a row per cohort PER PERIOD, so the two
 * matrices and the curve are removed rather than wired, and the response says
 * so in `unbacked`.
 *
 * Comments are stripped: the notes left behind name every number they replaced.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const page = read('client/src/pages/PlatformCohortAnalysis.tsx');
const endpoint = read('supabase/functions/platform-analytics/index.ts');
const branch = endpoint.slice(
  endpoint.indexOf("endpoint === 'cohort-analysis'"),
  endpoint.indexOf("return createCorsResponse({ error: 'Endpoint not found' }"),
);

describe('the endpoint answers what the page asks for', () => {
  it('returns cohortTable, ltvData and summary', () => {
    for (const key of ['cohortTable', 'ltvData', 'summary:']) {
      expect(branch).toContain(key);
    }
  });

  it('reads the real columns', () => {
    for (const column of [
      'initial_size',
      'current_size',
      'retention_rate',
      'initial_mrr',
      'average_ltv',
      'average_cac',
      'ltv_to_cac_ratio',
    ]) {
      expect(branch).toContain(column);
    }
  });

  it('averages only the rows that carry a value, and answers null otherwise', () => {
    // 0% retention reads as every customer having left.
    expect(branch).toContain('const mean =');
    expect(branch).toMatch(/present\.length > 0 \? .* : null/);
  });

  it('names the series it cannot derive', () => {
    expect(branch).toContain('unbacked');
    expect(branch).toContain('not a row per period');
  });
});

describe('the page renders data, not literals', () => {
  it('keeps no invented fallback array', () => {
    expect(page).not.toContain('cohortData?.cohortTable ||');
    expect(page).not.toContain('revenueCohorts');
    expect(page).not.toMatch(/cohort: 'Jan 2024'/);
  });

  it('renders none of the four typed headline numbers', () => {
    for (const claim of ['79.4%', '56.2%', '$20,605', '6.92:1', '3.2%', '11.8%', '15.3%']) {
      expect(page).not.toContain(claim);
    }
  });

  it('drops the retention curve and both month-by-month matrices', () => {
    expect(page).not.toContain('retentionCurveData');
    expect(page).not.toContain('month0');
    expect(page).not.toContain('Average Retention Curve');
  });

  it('drops the recommendation built on invented movement', () => {
    // "CAC has decreased by 18% while LTV has increased by 23% - consider
    // scaling acquisition spend" is advice, which is what gets acted on.
    expect(page).not.toContain('Key Insights & Recommendations');
    expect(page).not.toContain('scaling acquisition spend');
  });

  it('shows the unbacked note the endpoint sends', () => {
    expect(page).toContain('data.unbacked');
    expect(page).toContain('Not shown, because it is not measured');
  });

  it('says so when there are no cohorts instead of rendering an empty grid', () => {
    expect(page).toContain('No cohorts have been calculated yet');
  });

  it('treats a missing LTV, CAC or ratio as missing', () => {
    expect(page).toMatch(/cohort\.ratio == null/);
    expect(page).toMatch(/cohort\.ltv == null/);
  });
});

describe('the controls do something', () => {
  it('drops the two selectors whose parameter the endpoint ignores', () => {
    // type= and metric= were never read; the endpoint filters on cohort_date.
    expect(page).not.toContain('cohortType');
    expect(page).not.toContain('metricType');
    expect(page).not.toContain('By Signup Month');
  });

  it('makes the timeframe selector drive a real startDate', () => {
    expect(page).toContain('setTimeframe');
    expect(page).toMatch(/startDate=\$\{startDate\}/);
    expect(branch).toContain("sp.get('startDate')");
  });
});
