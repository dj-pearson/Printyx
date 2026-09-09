/**
 * The financial dashboard reports money it can see (iteration 12).
 *
 * supabase/functions/financial/ is proxied at /api/financial, so it serves both
 * hosts. GET /financial/metrics invented BOTH SIDES of the P&L:
 *
 *   const estimatedCOGS = totalRevenue * 0.6;              // 60% COGS estimate
 *   const estimatedOperatingExpenses = mrr * 0.25;         // 25% of MRR
 *   const cashOutflow = totalExpenses * 0.9;               // 90% of expenses paid
 *
 * and derived six figures from them - gross profit, net profit, gross margin, net
 * margin, cash outflow, net cash flow - returned at 200 beside revenue numbers
 * that ARE read from invoices and contracts.
 *
 * grossMargin is PA-040's tautology in its purest form: (revenue - 0.6*revenue)
 * / revenue is 0.4 for every input, so every tenant on every request was told
 * their gross margin was exactly 40.00%. The arithmetic test below demonstrates
 * that rather than asserting it, because the claim is the whole point.
 *
 * Nothing in this platform records an expense - no COGS column, no expense table -
 * so these are not estimates that a better model would improve. There is no input.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const EDGE = stripComments(read('supabase/functions/financial/index.ts'));
const PAGE = stripComments(read('client/src/pages/FinancialForecasting.tsx'));

describe('the tautology this removed', () => {
  it('a margin built on a fixed cost ratio is a constant, not a measurement', () => {
    const oldGrossMargin = (revenue: number) => {
      const cogs = revenue * 0.6;
      return revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
    };
    for (const revenue of [0.01, 1000, 250_000, 9_999_999]) {
      expect(oldGrossMargin(revenue)).toBeCloseTo(40, 10);
    }
  });
});

describe('no invented expense reaches the response', () => {
  it('the three magic ratios are gone', () => {
    expect(EDGE).not.toMatch(/totalRevenue \* 0\.6/);
    expect(EDGE).not.toMatch(/monthlyRecurringRevenue \* 0\.25/);
    expect(EDGE).not.toMatch(/totalExpenses \* 0\.9/);
  });

  it('expenses, profit and outflow are null', () => {
    for (const key of ['cogs', 'operating', 'gross', 'net', 'grossMargin', 'netMargin']) {
      expect(EDGE, key).toMatch(new RegExp(`${key}:\\s*null`));
    }
  });

  it('names what it cannot measure, and why', () => {
    expect(EDGE).toContain('unbacked');
    expect(EDGE).toContain('nothing in this platform records an expense');
  });

  it('keeps the revenue figures that ARE real', () => {
    // The correction must not throw away measurements alongside inventions.
    for (const key of ['collected', 'outstanding', 'overdue', 'wonDeals', 'invoiceCount']) {
      expect(EDGE, key).toContain(`${key}:`);
    }
    expect(EDGE).toMatch(/inflow: Math\.round/);
  });
});

describe('the page reads keys the endpoint sends', () => {
  it('none of the phantom keys are read off `metrics` any more', () => {
    // Anchored to `metrics.` on purpose: `cashFlowProjections` (plural) is a
    // different and legitimate variable, fed by /financial/cash-flow. A bare
    // substring match reports it and would have to be silenced, which is how a
    // real one gets silenced with it.
    for (const key of [
      'totalRevenueForecast',
      'cashFlowProjection',
      'profitMargin',
      'forecastAccuracy',
      'growthProjection',
      'riskLevel',
    ]) {
      expect(PAGE, key).not.toMatch(new RegExp(`metrics\\??\\.${key}\\b`));
    }
  });

  it('the three cards bind to real paths', () => {
    expect(PAGE).toContain('metrics?.revenue?.total');
    expect(PAGE).toContain('metrics?.cashFlow?.inflow');
    expect(PAGE).toContain('metrics?.recurring?.mrr');
  });

  it('does not present collected cash as a net cash flow', () => {
    // Net needs outflow, which needs expenses. Labelling inflow as "net" would
    // be the same defect in a different place.
    expect(PAGE).not.toContain('Net cash flow projection');
  });
});
