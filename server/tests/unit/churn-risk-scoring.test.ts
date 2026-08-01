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
