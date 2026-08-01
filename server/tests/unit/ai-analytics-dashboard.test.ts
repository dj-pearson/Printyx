/**
 * Locks the AI analytics dashboard ported to Deno in
 * supabase/functions/ai-analytics/index.ts (PROD-010).
 *
 * The edge function is now the only implementation that runs (dev proxies
 * /api/ai-analytics to it; production has no Express), and there is no Deno in CI,
 * so nothing else in the suite can reach this arithmetic.
 *
 * Two things here are worth more than the rest:
 *
 *  1. LATEST-SCORE-PER-CUSTOMER. Express used `SELECT DISTINCT ON (customer_id)
 *     ... ORDER BY customer_id, calculated_at DESC`. PostgREST has no DISTINCT ON,
 *     so the port orders newest-first and keeps the first row per customer. If that
 *     dedupe regresses, the dashboard shows STALE churn scores that still look
 *     entirely plausible — no error, no empty state, just wrong numbers.
 *
 *  2. The `availability` map, which is this page's honesty contract. Six flags are
 *     hard-coded false because those capabilities have no backing pipeline, and the
 *     UI renders "Preview — not yet available" for each. CRMX-001 removed
 *     fabricated numbers from this dashboard; a flag flipping true without a data
 *     source would put them back.
 */

import { describe, it, expect } from 'vitest';
import { computeDashboard } from '../../../supabase/functions/ai-analytics/dashboard.ts';

/** Minimal PostgREST-shaped stub: filters chain, awaiting resolves to rows. */
function stubClient(
  tables: Record<string, Record<string, unknown>[]>,
  counts: Record<string, number> = {},
) {
  const makeQuery = (table: string) => {
    const rows = tables[table] ?? [];
    let headCount: number | null = null;

    const q: Record<string, unknown> = {};
    q.select = (_cols?: unknown, opts?: { head?: boolean; count?: string }) => {
      if (opts?.head) headCount = 0;
      return q;
    };
    for (const m of ['eq', 'in', 'gte', 'order', 'limit']) {
      q[m] = (col?: string, val?: unknown) => {
        // countRecords filters business_records by record_type; resolve the
        // configured count for whichever type was asked for.
        if (headCount !== null && col === 'record_type') headCount = counts[String(val)] ?? 0;
        return q;
      };
    }
    q.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
    q.then = (resolve: (v: unknown) => unknown) =>
      resolve(headCount !== null ? { count: headCount, error: null } : { data: rows, error: null });
    return q;
  };
  return { from: (table: string) => makeQuery(table) } as never;
}

const churnRow = (o: Partial<Record<string, unknown>>) => ({
  customer_id: 'c-1',
  score: 50,
  band: 'watch',
  signals: null,
  contract_value: 1000,
  calculated_at: '2026-01-01T00:00:00Z',
  ...o,
});

const predRow = (o: Partial<Record<string, unknown>>) => ({
  machine_id: 'm-1',
  confidence: 0.5,
  predicted_window_start: '2026-03-01T00:00:00Z',
  contract_value: 500,
  signals: null,
  status: 'pending',
  outcome: null,
  ...o,
});

describe('ai-analytics dashboard', () => {
  const tenantId = 'tenant-1';

  it('keeps only the newest churn score per customer', async () => {
    // Newest-first, as the query orders them.
    const admin = stubClient({
      customer_churn_scores: [
        churnRow({
          customer_id: 'c-1',
          score: 90,
          band: 'at_risk',
          calculated_at: '2026-06-01T00:00:00Z',
        }),
        churnRow({
          customer_id: 'c-1',
          score: 10,
          band: 'healthy',
          calculated_at: '2026-01-01T00:00:00Z',
        }),
        churnRow({
          customer_id: 'c-2',
          score: 40,
          band: 'watch',
          calculated_at: '2026-05-01T00:00:00Z',
        }),
      ],
      business_records: [
        { id: 'c-1', company_name: 'Acme' },
        { id: 'c-2', company_name: 'Globex' },
      ],
      equipment_failure_predictions: [],
    });

    const d = await computeDashboard(admin, tenantId);

    // Two customers, not three rows — and c-1 carries the JUNE score, not January.
    expect(d.churn.totalAnalyzed).toBe(2);
    const c1 = d.churn.customers.find((c) => c.customerId === 'c-1')!;
    expect(c1.score).toBe(90);
    expect(c1.band).toBe('at_risk');
    // Band counts are derived from the deduped set, so the stale 'healthy' row
    // must not be counted.
    expect(d.churn.highRisk).toBe(1);
    expect(d.churn.lowRisk).toBe(0);
    expect(d.churn.mediumRisk).toBe(1);
  });

  it('orders customers by score x contract value, not score alone', async () => {
    const admin = stubClient({
      customer_churn_scores: [
        // Higher score, tiny account.
        churnRow({ customer_id: 'small', score: 95, contract_value: 100 }),
        // Lower score, large account -> higher priority.
        churnRow({ customer_id: 'big', score: 60, contract_value: 100000 }),
      ],
      business_records: [
        { id: 'small', company_name: 'Small Co' },
        { id: 'big', company_name: 'Big Co' },
      ],
      equipment_failure_predictions: [],
    });

    const d = await computeDashboard(admin, tenantId);
    expect(d.churn.customers[0].customerId).toBe('big');
  });

  it('maps churn fields the page reads, including reasons out of jsonb signals', async () => {
    const admin = stubClient({
      customer_churn_scores: [
        churnRow({
          customer_id: 'c-1',
          score: 75,
          contract_value: 2000,
          signals: { reasons: ['AR past due', 'ticket spike'], ticket_delta: { value: 3 } },
        }),
      ],
      business_records: [{ id: 'c-1', company_name: 'Acme' }],
      equipment_failure_predictions: [],
    });

    const d = await computeDashboard(admin, tenantId);
    expect(d.churn.customers[0]).toMatchObject({
      customerId: 'c-1',
      companyName: 'Acme',
      score: 75,
      churnProbability: 0.75,
      contractValue: 2000,
      reasons: ['AR past due', 'ticket spike'],
    });
  });

  it('falls back to "Unknown account" when the customer has no business record', async () => {
    const admin = stubClient({
      customer_churn_scores: [churnRow({ customer_id: 'ghost' })],
      business_records: [],
      equipment_failure_predictions: [],
    });
    const d = await computeDashboard(admin, tenantId);
    expect(d.churn.customers[0].companyName).toBe('Unknown account');
  });

  it('tolerates a malformed signals payload', async () => {
    const admin = stubClient({
      customer_churn_scores: [churnRow({ signals: { reasons: 'not-an-array' } })],
      business_records: [{ id: 'c-1', company_name: 'Acme' }],
      equipment_failure_predictions: [],
    });
    const d = await computeDashboard(admin, tenantId);
    expect(d.churn.customers[0].reasons).toEqual([]);
  });

  it('counts only open predictions but monitors every machine seen', async () => {
    const admin = stubClient({
      customer_churn_scores: [],
      business_records: [],
      equipment_failure_predictions: [
        predRow({ machine_id: 'm-1', status: 'pending' }),
        predRow({ machine_id: 'm-2', status: 'approved' }),
        predRow({ machine_id: 'm-3', status: 'snoozed' }),
        predRow({ machine_id: 'm-4', status: 'dismissed' }),
        // Same machine again — monitored count is distinct machines.
        predRow({ machine_id: 'm-1', status: 'resolved' }),
      ],
    });

    const d = await computeDashboard(admin, tenantId);
    expect(d.predictiveMaintenance.predictedFailures).toBe(3);
    expect(d.predictiveMaintenance.equipmentMonitored).toBe(4);
    expect(d.overview.equipmentMonitored).toBe(4);
    expect(d.predictiveMaintenance.alerts).toHaveLength(3);
  });

  it('withholds accuracy below five scored outcomes', async () => {
    const admin = stubClient({
      customer_churn_scores: [],
      business_records: [],
      equipment_failure_predictions: [
        predRow({ outcome: 'true_positive' }),
        predRow({ outcome: 'false_positive' }),
        predRow({ outcome: null }),
      ],
    });
    const d = await computeDashboard(admin, tenantId);
    // 1/2 would be "50%" — meaningless on two data points, so null.
    expect(d.predictiveMaintenance.accuracyRate).toBeNull();
  });

  it('reports accuracy to one decimal once there are enough outcomes', async () => {
    const admin = stubClient({
      customer_churn_scores: [],
      business_records: [],
      equipment_failure_predictions: [
        ...Array.from({ length: 4 }, () => predRow({ outcome: 'true_positive' })),
        ...Array.from({ length: 2 }, () => predRow({ outcome: 'false_positive' })),
        // Unscored rows must not dilute the denominator.
        predRow({ outcome: null }),
      ],
    });
    const d = await computeDashboard(admin, tenantId);
    // 4/6 = 66.666… -> 66.7
    expect(d.predictiveMaintenance.accuracyRate).toBe(66.7);
  });

  it('clamps confidence into 0..1 and reads suggested parts from jsonb', async () => {
    const admin = stubClient({
      customer_churn_scores: [],
      business_records: [],
      equipment_failure_predictions: [
        predRow({ confidence: 1.4, signals: { suggested_parts: ['fuser', 'roller'] } }),
      ],
    });
    const d = await computeDashboard(admin, tenantId);
    expect(d.predictiveMaintenance.alerts[0].confidence).toBe(1);
    expect(d.predictiveMaintenance.alerts[0].suggestedParts).toEqual(['fuser', 'roller']);
  });

  it('caps both lists at 25 entries', async () => {
    const admin = stubClient({
      customer_churn_scores: Array.from({ length: 40 }, (_, i) =>
        churnRow({ customer_id: `c-${i}`, score: i }),
      ),
      business_records: [],
      equipment_failure_predictions: Array.from({ length: 40 }, (_, i) =>
        predRow({ machine_id: `m-${i}` }),
      ),
    });
    const d = await computeDashboard(admin, tenantId);
    expect(d.churn.customers).toHaveLength(25);
    expect(d.predictiveMaintenance.alerts).toHaveLength(25);
    // …but the totals still reflect everything.
    expect(d.churn.totalAnalyzed).toBe(40);
    expect(d.predictiveMaintenance.predictedFailures).toBe(40);
  });

  it('reports availability honestly and never invents the six preview capabilities', async () => {
    const empty = stubClient({
      customer_churn_scores: [],
      business_records: [],
      equipment_failure_predictions: [],
    });
    const d = await computeDashboard(empty, tenantId);

    expect(d.availability.churn).toBe(false);
    expect(d.availability.predictiveMaintenance).toBe(false);
    expect(d.churn.available).toBe(false);
    expect(d.predictiveMaintenance.available).toBe(false);

    // These have no backing pipeline. If one of these ever reads true, the page
    // stops rendering its "Preview" card and starts presenting numbers as real.
    for (const k of [
      'salesForecasting',
      'sentiment',
      'recommendations',
      'modelRegistry',
      'lifetimeValue',
      'upsell',
    ] as const) {
      expect(d.availability[k]).toBe(false);
    }
  });

  it('flips availability true once real rows exist', async () => {
    const admin = stubClient({
      customer_churn_scores: [churnRow({})],
      business_records: [{ id: 'c-1', company_name: 'Acme' }],
      equipment_failure_predictions: [predRow({})],
    });
    const d = await computeDashboard(admin, tenantId);
    expect(d.availability.churn).toBe(true);
    expect(d.availability.predictiveMaintenance).toBe(true);
  });

  it('reports real record counts per record_type', async () => {
    const admin = stubClient(
      {
        customer_churn_scores: [],
        business_records: [],
        equipment_failure_predictions: [],
      },
      { customer: 12, lead: 34 },
    );
    const d = await computeDashboard(admin, tenantId);
    expect(d.overview.customersCount).toBe(12);
    expect(d.overview.leadsCount).toBe(34);
  });
});
