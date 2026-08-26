// COP-M07: the funnel buckets deals by the LEGACY stage id while taking its
// stage list from the canonical pipeline_stages. These are the edges that make
// that split behave.
import { describe, it, expect } from 'vitest';

import {
  buildFunnel,
  buildStatusFallback,
  type FunnelDeal,
  type FunnelStage,
} from '../../../supabase/functions/_shared/pipeline-funnel';

const stages: FunnelStage[] = [
  { legacyStageId: 's1', name: 'Discovery', order: 1 },
  { legacyStageId: 's2', name: 'Proposal', order: 2 },
  { legacyStageId: 's3', name: 'Closed Won', order: 3 },
];

const deals: FunnelDeal[] = [
  { stage_id: 's1', amount: '1000', status: 'open' },
  { stage_id: 's1', amount: '2000', status: 'open' },
  { stage_id: 's1', amount: null, status: 'open' },
  { stage_id: 's2', amount: 5000, status: 'open' },
  { stage_id: 's3', amount: '7500.49', status: 'won' },
];

describe('buildFunnel', () => {
  it('counts and sums per stage, treating a missing amount as zero', () => {
    const out = buildFunnel(stages, deals);
    expect(out.map((b) => [b.stage, b.count, b.value])).toEqual([
      ['Discovery', 3, 3000],
      ['Proposal', 1, 5000],
      ['Closed Won', 1, 7500],
    ]);
  });

  it('leaves the first stage at 0, since it has nothing to convert from', () => {
    expect(buildFunnel(stages, deals)[0].conversionRate).toBe(0);
  });

  it('converts stage to stage, not against the first stage', () => {
    const out = buildFunnel(stages, deals);
    expect(out[1].conversionRate).toBe(33); // 1 of 3
    expect(out[2].conversionRate).toBe(100); // 1 of 1
  });

  it('reports 0 rather than dividing by an empty predecessor', () => {
    const out = buildFunnel(stages, [{ stage_id: 's2', amount: 100, status: 'open' }]);
    expect(out[1].conversionRate).toBe(0);
  });

  it('orders by stage order, not by the order rows arrive in', () => {
    const shuffled = [stages[2], stages[0], stages[1]];
    expect(buildFunnel(shuffled, deals).map((b) => b.stage)).toEqual([
      'Discovery',
      'Proposal',
      'Closed Won',
    ]);
  });

  it('drops an inactive stage that holds nothing', () => {
    const withRetired = [
      ...stages,
      { legacyStageId: 's4', name: 'Retired', order: 4, isActive: false },
    ];
    expect(buildFunnel(withRetired, deals).map((b) => b.stage)).not.toContain('Retired');
  });

  it('KEEPS an inactive stage that still holds deals, so the counts add up', () => {
    const withRetired = [
      ...stages,
      { legacyStageId: 's4', name: 'Retired', order: 4, isActive: false },
    ];
    const parked = [...deals, { stage_id: 's4', amount: '900', status: 'open' }];
    const out = buildFunnel(withRetired, parked);
    expect(out.map((b) => b.stage)).toContain('Retired');
    expect(out.reduce((n, b) => n + b.count, 0)).toBe(parked.length);
  });

  it('gives a canonical stage with no legacy id an empty bucket rather than everything', () => {
    const orphanStage = [{ legacyStageId: null, name: 'Unbridged', order: 1 }];
    expect(buildFunnel(orphanStage, deals)).toEqual([
      { stage: 'Unbridged', value: 0, count: 0, conversionRate: 0 },
    ]);
  });
});

describe('buildStatusFallback', () => {
  it('buckets by status for a tenant with no stages at all', () => {
    expect(buildStatusFallback(deals)).toEqual([
      { stage: 'open', value: 8000, count: 4, conversionRate: 0 },
      { stage: 'won', value: 7500, count: 1, conversionRate: 0 },
      { stage: 'lost', value: 0, count: 0, conversionRate: 0 },
    ]);
  });
});
