/**
 * Locks the churn-risk scoring model ported to Deno in
 * supabase/functions/churn-risk/scoring.ts (PROD-010).
 *
 * The edge function is now the only implementation that runs (dev proxies
 * /api/churn-risk to it; production has no Express), and there is no Deno in CI,
 * so nothing else in the suite can reach this model.
 *
 * These numbers are acted on: an at_risk band puts a customer in the owner's
 * Monday digest and drives a retention offer worth real money. A scoring drift
 * produces no error and no empty state — just a quietly wrong risk list — so the
 * saturation points, the weight normalization, and the band boundaries are pinned
 * rather than assumed.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  DEFAULT_AT_RISK_THRESHOLD,
  DEFAULT_WATCH_THRESHOLD,
  bandFor,
  buildSavePlan,
  clamp01,
  resolveWeights,
  scoreCustomer,
} from '../../../supabase/functions/churn-risk/scoring.ts';

/** A customer with every signal at zero risk. */
const healthyArgs = {
  customerId: 'c-1',
  contractValue: 12000,
  recentTicketCount: 0,
  baselineMonthlyTickets: 0,
  maxDaysPastDue: 0,
  recentAvgVolume: 100,
  longAvgVolume: 100,
  daysToRenewal: 365,
  weights: DEFAULT_WEIGHTS,
  watchThreshold: DEFAULT_WATCH_THRESHOLD,
  atRiskThreshold: DEFAULT_AT_RISK_THRESHOLD,
};

describe('clamp01', () => {
  it('clamps out-of-range values', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });

  it('treats NaN and Infinity as zero risk rather than propagating them', () => {
    // A NaN here would poison the blended score and the band with it.
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
    expect(clamp01(-Infinity)).toBe(0);
  });
});

describe('bandFor', () => {
  it('uses inclusive lower bounds at each threshold', () => {
    expect(bandFor(30, 31, 61)).toBe('healthy');
    expect(bandFor(31, 31, 61)).toBe('watch');
    expect(bandFor(60, 31, 61)).toBe('watch');
    expect(bandFor(61, 31, 61)).toBe('at_risk');
  });
});

describe('resolveWeights', () => {
  it('falls back to defaults for missing or non-numeric entries', () => {
    expect(resolveWeights(null)).toEqual(DEFAULT_WEIGHTS);
    expect(resolveWeights({ ticket_delta: 'x' })).toEqual(DEFAULT_WEIGHTS);
    expect(resolveWeights({ ticket_delta: 0.9 })).toEqual({
      ...DEFAULT_WEIGHTS,
      ticket_delta: 0.9,
    });
  });

  it('keeps an explicit zero weight instead of replacing it with the default', () => {
    // Zero is a deliberate "ignore this signal", not a missing value.
    expect(resolveWeights({ meter_trend: 0 }).meter_trend).toBe(0);
  });
});

describe('scoreCustomer — signals', () => {
  it('scores a fully healthy customer at zero', () => {
    const r = scoreCustomer(healthyArgs);
    expect(r.score).toBe(0);
    expect(r.band).toBe('healthy');
    expect(r.signals.reasons).toEqual([]);
  });

  it('saturates ticket risk at 100% above the quarterly baseline', () => {
    // baseline 1/mo -> 3/quarter. 6 tickets is +100% -> saturated.
    const r = scoreCustomer({ ...healthyArgs, recentTicketCount: 6, baselineMonthlyTickets: 1 });
    expect(r.signals.ticket_delta.value).toBe(1);
    // Beyond saturation it must not exceed 1.
    const more = scoreCustomer({
      ...healthyArgs,
      recentTicketCount: 60,
      baselineMonthlyTickets: 1,
    });
    expect(more.signals.ticket_delta.value).toBe(1);
  });

  it('treats a drop below baseline as zero ticket risk, never negative', () => {
    const r = scoreCustomer({ ...healthyArgs, recentTicketCount: 0, baselineMonthlyTickets: 4 });
    expect(r.signals.ticket_delta.value).toBe(0);
  });

  it('flags a ticket spike even with no baseline history', () => {
    const r = scoreCustomer({ ...healthyArgs, recentTicketCount: 3, baselineMonthlyTickets: 0 });
    expect(r.signals.ticket_delta.value).toBeCloseTo(0.5, 5);
    expect(r.signals.ticket_delta.detail).toContain('no prior baseline');
  });

  it('ignores one or two tickets with no baseline', () => {
    const r = scoreCustomer({ ...healthyArgs, recentTicketCount: 2, baselineMonthlyTickets: 0 });
    expect(r.signals.ticket_delta.value).toBe(0);
  });

  it('saturates AR risk at 90 days past due', () => {
    expect(scoreCustomer({ ...healthyArgs, maxDaysPastDue: 45 }).signals.ar_past_due.value).toBe(
      0.5,
    );
    expect(scoreCustomer({ ...healthyArgs, maxDaysPastDue: 90 }).signals.ar_past_due.value).toBe(1);
    expect(scoreCustomer({ ...healthyArgs, maxDaysPastDue: 900 }).signals.ar_past_due.value).toBe(
      1,
    );
  });

  it('treats a DROP in print volume as risk, and a rise as none', () => {
    const dropped = scoreCustomer({ ...healthyArgs, recentAvgVolume: 50, longAvgVolume: 100 });
    expect(dropped.signals.meter_trend.value).toBe(0.5);

    // Volume going UP is not a churn signal.
    const grew = scoreCustomer({ ...healthyArgs, recentAvgVolume: 200, longAvgVolume: 100 });
    expect(grew.signals.meter_trend.value).toBe(0);
  });

  it('reports insufficient meter history rather than dividing by zero', () => {
    const r = scoreCustomer({ ...healthyArgs, recentAvgVolume: 0, longAvgVolume: 0 });
    expect(r.signals.meter_trend.value).toBe(0);
    expect(r.signals.meter_trend.detail).toBe('insufficient meter history');
  });

  it('scales renewal risk to zero at 180 days and maxes it once expired', () => {
    expect(
      scoreCustomer({ ...healthyArgs, daysToRenewal: 180 }).signals.renewal_proximity.value,
    ).toBe(0);
    expect(
      scoreCustomer({ ...healthyArgs, daysToRenewal: 90 }).signals.renewal_proximity.value,
    ).toBe(0.5);
    expect(
      scoreCustomer({ ...healthyArgs, daysToRenewal: 0 }).signals.renewal_proximity.value,
    ).toBe(1);

    const expired = scoreCustomer({ ...healthyArgs, daysToRenewal: -30 });
    expect(expired.signals.renewal_proximity.value).toBe(1);
    expect(expired.signals.renewal_proximity.detail).toContain('expired 30 days ago');
  });

  it('carries no renewal risk when there is no active contract', () => {
    const r = scoreCustomer({ ...healthyArgs, daysToRenewal: null });
    expect(r.signals.renewal_proximity.value).toBe(0);
    expect(r.signals.renewal_proximity.detail).toBe('no active contract');
  });
});

describe('scoreCustomer — blending and bands', () => {
  it('scores every signal saturated at 100 / at_risk', () => {
    const r = scoreCustomer({
      ...healthyArgs,
      recentTicketCount: 100,
      baselineMonthlyTickets: 1,
      maxDaysPastDue: 90,
      recentAvgVolume: 0,
      longAvgVolume: 100,
      daysToRenewal: -1,
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe('at_risk');
    expect(r.signals.reasons).toHaveLength(4);
  });

  it('normalizes by the weight sum so unnormalized weights still yield 0..100', () => {
    // Weights summing to 40, not 1 — the blend must still be a clean percentage.
    const r = scoreCustomer({
      ...healthyArgs,
      maxDaysPastDue: 90, // ar_past_due = 1, everything else 0
      weights: { ticket_delta: 10, ar_past_due: 10, meter_trend: 10, renewal_proximity: 10 },
    });
    expect(r.score).toBe(25); // 1 * 10 / 40
  });

  it('does not divide by zero when every weight is zero', () => {
    const r = scoreCustomer({
      ...healthyArgs,
      maxDaysPastDue: 90,
      weights: { ticket_delta: 0, ar_past_due: 0, meter_trend: 0, renewal_proximity: 0 },
    });
    expect(r.score).toBe(0);
    expect(Number.isNaN(r.score)).toBe(false);
  });

  it('lets weights redistribute emphasis between signals', () => {
    const base = { ...healthyArgs, maxDaysPastDue: 90 };
    const arHeavy = scoreCustomer({
      ...base,
      weights: { ticket_delta: 0, ar_past_due: 1, meter_trend: 0, renewal_proximity: 0 },
    });
    expect(arHeavy.score).toBe(100);

    const arIgnored = scoreCustomer({
      ...base,
      weights: { ticket_delta: 1, ar_past_due: 0, meter_trend: 1, renewal_proximity: 1 },
    });
    expect(arIgnored.score).toBe(0);
  });

  it('honors custom thresholds', () => {
    const args = { ...healthyArgs, maxDaysPastDue: 45 }; // ar = 0.5 -> score 15
    expect(scoreCustomer(args).band).toBe('healthy');
    expect(scoreCustomer({ ...args, watchThreshold: 10, atRiskThreshold: 90 }).band).toBe('watch');
    expect(scoreCustomer({ ...args, watchThreshold: 5, atRiskThreshold: 10 }).band).toBe('at_risk');
  });

  it('adds a reason chip only at or above 0.4 risk', () => {
    // 0.39 -> no chip; 0.4 -> chip. Guards the boundary in both directions.
    const below = scoreCustomer({ ...healthyArgs, maxDaysPastDue: 35 }); // 0.388…
    expect(below.signals.reasons).toEqual([]);

    const at = scoreCustomer({ ...healthyArgs, maxDaysPastDue: 36 }); // 0.4
    expect(at.signals.reasons).toEqual(['Past-due balance']);
  });

  it('preserves the configured weight on each signal contribution', () => {
    const r = scoreCustomer({ ...healthyArgs, weights: { ...DEFAULT_WEIGHTS, meter_trend: 0.7 } });
    expect(r.signals.meter_trend.weight).toBe(0.7);
    expect(r.signals.ticket_delta.weight).toBe(DEFAULT_WEIGHTS.ticket_delta);
  });
});

describe('buildSavePlan', () => {
  const signalsWith = (over: Partial<Record<string, number>>) => ({
    ticket_delta: { value: over.ticket_delta ?? 0, weight: 0.3 },
    ar_past_due: { value: over.ar_past_due ?? 0, weight: 0.3 },
    meter_trend: { value: over.meter_trend ?? 0, weight: 0.2 },
    renewal_proximity: { value: over.renewal_proximity ?? 0, weight: 0.2 },
    reasons: [] as string[],
  });

  it('keys the retention offer to the dominant signal', () => {
    expect(
      buildSavePlan({
        companyName: 'Acme',
        band: 'at_risk',
        signals: signalsWith({ ar_past_due: 0.9 }),
      }).retentionOffer,
    ).toMatch(/payment plan/i);

    expect(
      buildSavePlan({
        companyName: 'Acme',
        band: 'at_risk',
        signals: signalsWith({ meter_trend: 0.9 }),
      }).retentionOffer,
    ).toMatch(/utilization assessment/i);

    expect(
      buildSavePlan({
        companyName: 'Acme',
        band: 'at_risk',
        signals: signalsWith({ ticket_delta: 0.9 }),
      }).retentionOffer,
    ).toMatch(/SLA upgrade/i);

    expect(
      buildSavePlan({
        companyName: 'Acme',
        band: 'at_risk',
        signals: signalsWith({ renewal_proximity: 0.9 }),
      }).retentionOffer,
    ).toMatch(/Early-renewal/i);
  });

  it('falls back to the generic offer when no signal is dominant', () => {
    const plan = buildSavePlan({
      companyName: 'Acme',
      band: 'watch',
      signals: signalsWith({ ar_past_due: 0.2 }),
    });
    expect(plan.retentionOffer).toMatch(/account review/i);
  });

  it('handles a customer with no score history at all', () => {
    const plan = buildSavePlan({ companyName: 'Acme', band: 'healthy', signals: null });
    expect(plan.retentionOffer).toMatch(/account review/i);
    expect(plan.subject).toContain('Acme');
    expect(plan.body).toContain('exceed expectations');
  });

  it('degrades to a neutral greeting when the company name is missing', () => {
    const plan = buildSavePlan({ companyName: '', band: 'healthy', signals: null });
    // Never renders "Hi  team," with a hole in it.
    expect(plan.body).toContain('Hi there team,');
    expect(plan.subject).toContain('there');
  });

  it('lists the signal reasons in the body when present', () => {
    const signals = { ...signalsWith({ ar_past_due: 0.9 }), reasons: ['Past-due balance'] };
    const plan = buildSavePlan({ companyName: 'Acme', band: 'at_risk', signals });
    expect(plan.body).toContain('Past-due balance');
  });
});

/**
 * runScoring: five tenant-wide reads produce the same numbers the seven
 * per-customer queries did (PERF-NPLUS1-002).
 *
 * This was SEVEN round trips per active customer - two ticket counts, open
 * invoices, the equipment id list, two meter averages and the active contract -
 * so a 500-customer dealer made 3,500 sequential hops in one invocation. The
 * rewrite groups in memory instead, and an aggregation rewrite is exactly the
 * kind of change that can be subtly wrong and still look right, so the numbers
 * are checked against hand-computed expectations rather than against itself.
 */
import { runScoring } from '../../../supabase/functions/churn-risk/scoring.ts';

/**
 * The narrowest PostgREST stub that satisfies this code path: a chain that
 * records its filters and resolves to the rows the fixture holds for that
 * table. `.range()` is what fetchAllRows calls, and a stub without it fails
 * with "build(...).range is not a function" rather than anything about the
 * code under test.
 */
function stubClient(tables: Record<string, Record<string, unknown>[]>) {
  const calls: string[] = [];
  const make = (table: string) => {
    const rows = tables[table] ?? [];
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'insert']) {
      chain[m] = () => chain;
    }
    chain.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
    chain.range = async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    });
    chain.then = (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
      resolve({ data: rows, error: null });
    return chain;
  };
  return {
    calls,
    client: {
      from: (table: string) => {
        calls.push(table);
        return make(table);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

describe('runScoring reads the tenant once, not once per customer', () => {
  const NOW = Date.parse('2026-09-18T00:00:00.000Z');
  const dayAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

  const fixture = {
    churn_risk_settings: [{ tenant_id: 't1', weights: DEFAULT_WEIGHTS }],
    business_records: [
      { id: 'cust-a', company_name: 'Acme' },
      { id: 'cust-b', company_name: 'Borealis' },
    ],
    service_tickets: [
      // Acme: 3 in the last 90 days, 5 in the year.
      { customer_id: 'cust-a', created_at: dayAgo(10) },
      { customer_id: 'cust-a', created_at: dayAgo(20) },
      { customer_id: 'cust-a', created_at: dayAgo(30) },
      { customer_id: 'cust-a', created_at: dayAgo(200) },
      { customer_id: 'cust-a', created_at: dayAgo(300) },
      // Borealis: none recent, 1 in the year.
      { customer_id: 'cust-b', created_at: dayAgo(180) },
    ],
    invoices: [
      { customer_id: 'cust-a', due_date: dayAgo(45), balance_due: '500' },
      { customer_id: 'cust-a', due_date: dayAgo(10), balance_due: '100' },
      // A settled invoice is not past due however old it is.
      { customer_id: 'cust-b', due_date: dayAgo(400), balance_due: '0' },
    ],
    equipment: [
      { id: 'eq-1', customer_id: 'cust-a' },
      { id: 'eq-2', customer_id: 'cust-b' },
    ],
    meter_readings: [
      {
        equipment_id: 'eq-1',
        reading_date: dayAgo(5),
        bw_meter_reading: 100,
        color_meter_reading: 0,
      },
      {
        equipment_id: 'eq-1',
        reading_date: dayAgo(200),
        bw_meter_reading: 300,
        color_meter_reading: 0,
      },
    ],
    contracts: [
      { customer_id: 'cust-a', end_date: dayAgo(-30), monthly_base: '1000' },
      // Postgres orders DESC NULLS FIRST, so LIMIT 1 returned the undated row.
      { customer_id: 'cust-b', end_date: null, monthly_base: '250' },
      { customer_id: 'cust-b', end_date: dayAgo(-10), monthly_base: '999' },
    ],
    customer_churn_scores: [],
  };

  it('issues one read per table rather than one per customer', async () => {
    const { client, calls } = stubClient(fixture);
    await runScoring(client, 't1', NOW);
    for (const table of ['service_tickets', 'invoices', 'equipment', 'contracts']) {
      expect(
        calls.filter((c) => c === table),
        table,
      ).toHaveLength(1);
    }
  });

  it('counts tickets per customer and per window', async () => {
    // Acme: 3 of its 5 tickets are inside 90 days, so the baseline quarter is
    // 5/12*3 = 1.25. Asserted through the detail string because that carries
    // both inputs - a signal VALUE alone passes whatever the grouping does.
    const scoresFor = await capture(fixture, NOW);
    expect(scoresFor('cust-a').signals.ticket_delta.detail).toBe(
      '3 tickets in 90d vs 1.3 baseline',
    );
    expect(scoresFor('cust-b').signals.ticket_delta.detail).toBe(
      '0 tickets in 90d vs 0.3 baseline',
    );
  });

  it('takes the worst past-due balance and ignores a settled invoice', async () => {
    const scoresFor = await capture(fixture, NOW);
    expect(scoresFor('cust-a').signals.ar_past_due.detail).toBe(
      '45 days past due (worst open invoice)',
    );
    // Borealis's only invoice has a zero balance, so it is not past due at 400
    // days.
    expect(scoresFor('cust-b').signals.ar_past_due.detail).toBe('no past-due balance');
  });

  it('averages meter totals per window, and says so rather than reporting 0', async () => {
    const scoresFor = await capture(fixture, NOW);
    // Acme: 100 inside 90 days, (100+300)/2 = 200 over the year - a 50% fall,
    // which is what meter_trend exists to catch.
    expect(scoresFor('cust-a').signals.meter_trend.detail).toBe(
      'recent avg 100 vs 12-mo avg 200 (50% change)',
    );
    // Borealis has equipment and no readings. "Insufficient" is not the same
    // claim as a 0% change, and the old per-customer avgMeterTotal returned 0
    // for both - this keeps them distinguishable.
    expect(scoresFor('cust-b').signals.meter_trend.detail).toBe('insufficient meter history');
  });

  it('keeps DESC NULLS FIRST when picking the active contract', async () => {
    // Borealis has an undated contract worth 250/month and a dated one worth
    // 999. The old query returned the undated row, so daysToRenewal was null
    // and contract_value came from THAT row. Picking the later date instead
    // would move the renewal signal on every customer with an open-ended
    // contract, so the ordering is reproduced rather than tidied.
    const scoresFor = await capture(fixture, NOW);
    expect(scoresFor('cust-b').contract_value).toBe(250 * 12);
    expect(scoresFor('cust-b').signals.renewal_proximity.detail).toBe('no active contract');
    // Acme's single contract is 30 days out.
    expect(scoresFor('cust-a').signals.renewal_proximity.detail).toBe('30 days to renewal');
  });

  it('answers immediately for a tenant with no customers', async () => {
    const { client, calls } = stubClient({ ...fixture, business_records: [] });
    const result = await runScoring(client, 't1', NOW);
    expect(result.scored).toBe(0);
    expect(calls).not.toContain('service_tickets');
  });
});

/** The rows runScoring would have written, keyed by customer. */
async function capture(
  tables: Record<string, Record<string, unknown>[]>,
  now: number,
): Promise<(id: string) => any> {
  const written: Record<string, unknown>[] = [];
  const base = stubClient(tables);
  const client = {
    from: (table: string) => {
      const chain = base.client.from(table);
      if (table === 'customer_churn_scores') {
        chain.insert = (rows: Record<string, unknown>[]) => {
          written.push(...rows);
          return chain;
        };
      }
      return chain;
    },
  } as any;
  await runScoring(client, 't1', now);
  return (id: string) => {
    const row = written.find((r) => r.customer_id === id);
    if (!row) throw new Error(`no score written for ${id}`);
    return row;
  };
}
