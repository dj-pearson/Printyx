// Opportunity rollups and backend convergence (PROD-008b).
//
// server/routes-opportunities.ts served seven handlers under a prefix that is
// in crmProxies, so none of them ran on either host. Four of the seven had no
// counterpart in the edge function, and two of those failed dangerously rather
// than 404ing: GET /opportunities/dashboard fell into the GET /:id branch and
// looked up a deal with the id "dashboard", and POST /:id/convert-to-deal fell
// into the create branch and opened a SECOND deal from an empty body. The
// Express file is gone and the edge function now dispatches all four
// explicitly; these tests hold that.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  dashboardRollup,
  byStageRollup,
  toAmount,
  HIGH_VALUE_THRESHOLD,
  type OpportunityRow,
} from '../../../supabase/functions/_shared/opportunity-rollups';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf-8');

describe('toAmount', () => {
  it.each([
    ['12345.67', 12345.67],
    [12345.67, 12345.67],
    ['0', 0],
    ['', 0],
    [null, 0],
    [undefined, 0],
    ['not a number', 0],
    // A credit shows as a negative amount and is summed as one.
    ['-500', -500],
  ] as Array<[string | number | null | undefined, number]>)('reads %s as %s', (input, expected) => {
    expect(toAmount(input)).toBe(expected);
  });
});

describe('dashboardRollup', () => {
  it('reports zeroes for a tenant with no deals', () => {
    expect(dashboardRollup([])).toEqual({
      totalOpportunities: 0,
      highValueOpportunities: 0,
      urgentOpportunities: 0,
      totalValue: 0,
      averageValue: 0,
    });
  });

  it('never divides by zero when computing the average', () => {
    expect(dashboardRollup([]).averageValue).toBe(0);
  });

  it('counts every deal, sums the amounts and averages them', () => {
    const rows: OpportunityRow[] = [
      { amount: '1000', priority: 'low' },
      { amount: '3000', priority: 'medium' },
    ];
    expect(dashboardRollup(rows)).toEqual({
      totalOpportunities: 2,
      highValueOpportunities: 0,
      urgentOpportunities: 0,
      totalValue: 4000,
      averageValue: 2000,
    });
  });

  it('counts a deal at the high-value threshold, not just above it', () => {
    const at = dashboardRollup([{ amount: String(HIGH_VALUE_THRESHOLD) }]);
    const below = dashboardRollup([{ amount: String(HIGH_VALUE_THRESHOLD - 0.01) }]);
    expect(at.highValueOpportunities).toBe(1);
    expect(below.highValueOpportunities).toBe(0);
  });

  it('counts urgent priority case-insensitively and ignores every other value', () => {
    const rows: OpportunityRow[] = [
      { priority: 'urgent' },
      { priority: 'URGENT' },
      { priority: 'high' },
      { priority: null },
      {},
    ];
    expect(dashboardRollup(rows).urgentOpportunities).toBe(2);
  });

  it('includes a zero-amount deal in the count', () => {
    // The retired Express copy filtered these out, because on business_records
    // an amount-less row was a lead rather than an opportunity. Every row on
    // `deals` is an opportunity, so a deal with no amount yet still counts.
    const rolled = dashboardRollup([{ amount: null }, { amount: '5000' }]);
    expect(rolled.totalOpportunities).toBe(2);
    expect(rolled.averageValue).toBe(2500);
  });

  it('rounds the total and the average to cents', () => {
    const rolled = dashboardRollup([{ amount: '0.1' }, { amount: '0.2' }]);
    expect(rolled.totalValue).toBe(0.3);
    expect(rolled.averageValue).toBe(0.15);
  });
});

describe('byStageRollup', () => {
  it('returns nothing for a tenant with no deals', () => {
    expect(byStageRollup([])).toEqual([]);
  });

  it('groups by the embedded stage name and sums per stage', () => {
    const rows: OpportunityRow[] = [
      { amount: '1000', deal_stage: { name: 'Discovery' } },
      { amount: '2500', deal_stage: { name: 'Discovery' } },
      { amount: '9000', deal_stage: { name: 'Proposal' } },
    ];
    expect(byStageRollup(rows)).toEqual([
      { stage: 'Proposal', count: 1, totalValue: 9000 },
      { stage: 'Discovery', count: 2, totalValue: 3500 },
    ]);
  });

  it('falls back to status, then to unassigned, rather than dropping a deal', () => {
    const rows: OpportunityRow[] = [
      { amount: '100', status: 'won' },
      { amount: '50' },
      { amount: '10', deal_stage: null, status: null },
    ];
    const rolled = byStageRollup(rows);
    expect(rolled.map((r) => r.stage).sort()).toEqual(['unassigned', 'won']);
    expect(rolled.reduce((n, r) => n + r.count, 0)).toBe(3);
  });

  it('breaks a value tie on stage name so the order is stable', () => {
    const rows: OpportunityRow[] = [
      { amount: '100', deal_stage: { name: 'Zeta' } },
      { amount: '100', deal_stage: { name: 'Alpha' } },
    ];
    expect(byStageRollup(rows).map((r) => r.stage)).toEqual(['Alpha', 'Zeta']);
  });

  it('rounds each stage total to cents', () => {
    const rows: OpportunityRow[] = [
      { amount: '0.1', deal_stage: { name: 'Discovery' } },
      { amount: '0.2', deal_stage: { name: 'Discovery' } },
    ];
    expect(byStageRollup(rows)[0].totalValue).toBe(0.3);
  });
});

describe('opportunities backend convergence (PROD-008b)', () => {
  const PROXY = read('server/middleware/edge-function-proxy.ts');
  const EDGE = read('supabase/functions/opportunities/index.ts');
  const REGISTRY = read('server/routes-registry.ts');

  it('the /api/opportunities prefix is proxied to the edge function', () => {
    expect(PROXY).toContain("'/api/opportunities'");
  });

  it('no Express file registers an /api/opportunities handler', () => {
    expect([...REGISTRY.matchAll(/registerOpportunitiesRoutes/g)]).toEqual([]);
  });

  it('the sub-resource branches run before the plain /:id handlers', () => {
    const dashboardAt = EDGE.indexOf("opportunityId === 'dashboard'");
    const byStageAt = EDGE.indexOf("opportunityId === 'by-stage'");
    const convertAt = EDGE.indexOf("subResource === 'convert-to-deal'");
    // Anchored on the closing paren so these do not match the longer
    // sub-resource conditions above, which start with the same text.
    const getOneAt = EDGE.indexOf("req.method === 'GET' && opportunityId) {");
    const createAt = EDGE.indexOf("req.method === 'POST') {");

    for (const at of [dashboardAt, byStageAt, convertAt, getOneAt, createAt]) {
      expect(at).toBeGreaterThan(-1);
    }
    // If these ever flip, /dashboard becomes a deal lookup again and
    // /:id/convert-to-deal starts inserting duplicate deals.
    expect(dashboardAt).toBeLessThan(getOneAt);
    expect(byStageAt).toBeLessThan(getOneAt);
    expect(convertAt).toBeLessThan(createAt);
  });

  it('the rollup endpoints bound how many rows they pull', () => {
    expect(EDGE).toContain('ROLLUP_ROW_CAP');
  });
});
