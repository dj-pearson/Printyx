/**
 * Locks the predictive equipment-failure model ported to Deno in
 * supabase/functions/predictive-failure/scoring.ts (PROD-010).
 *
 * The edge function is now the only implementation that runs (dev proxies
 * /api/predictive-failure to it; production has no Express), and there is no Deno
 * in CI, so nothing else in the suite can reach this model.
 *
 * A confidence at or above the tenant threshold AUTO-CREATES A DRAFT SERVICE
 * TICKET, so drift here has cost in both directions: too high and a technician
 * is dispatched for nothing, too low and a machine fails at a customer site.
 * `nowMs` is injected throughout because three of the five signals move with
 * wall-clock time and would otherwise be untestable.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  SIGNAL_WEIGHTS,
  clamp01,
  computeAccuracy,
  scoreMachine,
  suggestParts,
} from '../../../supabase/functions/predictive-failure/scoring.ts';

const NOW = Date.parse('2026-06-01T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000);

/** Steady meter history — no acceleration, no variance. */
const steadyMeters = () => [
  { readingDate: daysAgo(90), total: 1000 },
  { readingDate: daysAgo(60), total: 2000 },
  { readingDate: daysAgo(30), total: 3000 },
];

const baseArgs = {
  machineId: 'm-1',
  installDate: null,
  lastServiceDate: daysAgo(0),
  meterRows: steadyMeters(),
  recentTickets: [],
  contractValue: 12000,
  nowMs: NOW,
};

describe('clamp01', () => {
  it('contains NaN and Infinity rather than propagating them into confidence', () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
    expect(clamp01(-5)).toBe(0);
    expect(clamp01(5)).toBe(1);
  });
});

describe('signal weights', () => {
  it('sum to exactly 1.0, so the blend needs no normalization', () => {
    const sum = Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('scoreMachine — meter acceleration', () => {
  it('reads zero on a perfectly steady meter', () => {
    const r = scoreMachine(baseArgs);
    expect(r.signals.meter_accel.value).toBe(0);
  });

  it('saturates when the recent delta doubles the prior one', () => {
    const r = scoreMachine({
      ...baseArgs,
      meterRows: [
        { readingDate: daysAgo(90), total: 0 },
        { readingDate: daysAgo(60), total: 100 }, // prior delta 100
        { readingDate: daysAgo(30), total: 300 }, // recent delta 200 -> +100%
      ],
    });
    expect(r.signals.meter_accel.value).toBe(1);
  });

  it('treats deceleration as zero risk, never negative', () => {
    const r = scoreMachine({
      ...baseArgs,
      meterRows: [
        { readingDate: daysAgo(90), total: 0 },
        { readingDate: daysAgo(60), total: 500 },
        { readingDate: daysAgo(30), total: 550 },
      ],
    });
    expect(r.signals.meter_accel.value).toBe(0);
  });

  it('needs three readings before it will judge acceleration', () => {
    const r = scoreMachine({
      ...baseArgs,
      meterRows: [
        { readingDate: daysAgo(60), total: 100 },
        { readingDate: daysAgo(30), total: 900 },
      ],
    });
    expect(r.signals.meter_accel.value).toBe(0);
    expect(r.signals.meter_accel.detail).toBe('insufficient meter history');
  });

  it('sorts unordered readings before differencing them', () => {
    const ordered = scoreMachine({
      ...baseArgs,
      meterRows: [
        { readingDate: daysAgo(90), total: 0 },
        { readingDate: daysAgo(60), total: 100 },
        { readingDate: daysAgo(30), total: 300 },
      ],
    });
    const shuffled = scoreMachine({
      ...baseArgs,
      meterRows: [
        { readingDate: daysAgo(30), total: 300 },
        { readingDate: daysAgo(90), total: 0 },
        { readingDate: daysAgo(60), total: 100 },
      ],
    });
    expect(shuffled.signals.meter_accel.value).toBe(ordered.signals.meter_accel.value);
  });
});

describe('scoreMachine — ticket frequency', () => {
  const ticket = () => ({ status: 'open', createdAt: daysAgo(10), description: null });

  it('scales to saturation at four tickets', () => {
    const at2 = scoreMachine({ ...baseArgs, recentTickets: [ticket(), ticket()] });
    expect(at2.signals.error_freq.value).toBe(0.5);

    const at4 = scoreMachine({ ...baseArgs, recentTickets: Array.from({ length: 4 }, ticket) });
    expect(at4.signals.error_freq.value).toBe(1);

    const at40 = scoreMachine({ ...baseArgs, recentTickets: Array.from({ length: 40 }, ticket) });
    expect(at40.signals.error_freq.value).toBe(1);
  });
});

describe('scoreMachine — service recency and age', () => {
  it('scales days-since-service to saturation at 180 days', () => {
    expect(
      scoreMachine({ ...baseArgs, lastServiceDate: daysAgo(90) }).signals.days_since_service.value,
    ).toBe(0.5);
    expect(
      scoreMachine({ ...baseArgs, lastServiceDate: daysAgo(180) }).signals.days_since_service.value,
    ).toBe(1);
    expect(
      scoreMachine({ ...baseArgs, lastServiceDate: daysAgo(900) }).signals.days_since_service.value,
    ).toBe(1);
  });

  it('treats an unknown service date as moderately risky, not risk-free', () => {
    // Absence of a service record is not evidence of recent service.
    const r = scoreMachine({ ...baseArgs, lastServiceDate: null });
    expect(r.signals.days_since_service.value).toBe(0.6);
    expect(r.signals.days_since_service.detail).toBe('never serviced');
  });

  it('scales model age to saturation at seven years', () => {
    const threeYears = scoreMachine({ ...baseArgs, installDate: daysAgo(365 * 3.5) });
    expect(threeYears.signals.model_age.value).toBeCloseTo(0.5, 2);

    const sevenYears = scoreMachine({ ...baseArgs, installDate: daysAgo(365 * 7) });
    expect(sevenYears.signals.model_age.value).toBe(1);
  });

  it('carries no age risk when the install date is unknown', () => {
    const r = scoreMachine({ ...baseArgs, installDate: null });
    expect(r.signals.model_age.value).toBe(0);
    expect(r.signals.model_age.detail).toBe('unknown install date');
  });
});

describe('scoreMachine — toner anomaly', () => {
  it('reads zero when consumption is perfectly regular', () => {
    const r = scoreMachine(baseArgs); // deltas 1000, 1000 -> CV 0
    expect(r.signals.toner_anomaly.value).toBe(0);
  });

  it('rises with erratic consumption', () => {
    const r = scoreMachine({
      ...baseArgs,
      meterRows: [
        { readingDate: daysAgo(90), total: 0 },
        { readingDate: daysAgo(60), total: 10 },
        { readingDate: daysAgo(30), total: 2000 },
      ],
    });
    expect(r.signals.toner_anomaly.value).toBeGreaterThan(0.5);
  });

  it('stays at zero when the mean delta is zero rather than dividing by it', () => {
    const r = scoreMachine({
      ...baseArgs,
      meterRows: [
        { readingDate: daysAgo(90), total: 500 },
        { readingDate: daysAgo(60), total: 500 },
        { readingDate: daysAgo(30), total: 500 },
      ],
    });
    expect(r.signals.toner_anomaly.value).toBe(0);
    expect(Number.isNaN(r.confidence)).toBe(false);
  });
});

describe('scoreMachine — blended confidence', () => {
  it('is zero when every signal is zero', () => {
    const r = scoreMachine({ ...baseArgs, installDate: null, lastServiceDate: daysAgo(0) });
    expect(r.confidence).toBe(0);
  });

  it('reaches 1.0 only when every signal saturates', () => {
    const r = scoreMachine({
      ...baseArgs,
      installDate: daysAgo(365 * 10),
      lastServiceDate: daysAgo(400),
      recentTickets: Array.from({ length: 10 }, () => ({
        status: 'open',
        createdAt: daysAgo(5),
        description: null,
      })),
      meterRows: [
        { readingDate: daysAgo(90), total: 0 },
        { readingDate: daysAgo(60), total: 10 },
        { readingDate: daysAgo(30), total: 5000 },
      ],
    });
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it('weights each signal by its configured share', () => {
    // Only error_freq saturated -> confidence equals its weight exactly.
    const r = scoreMachine({
      ...baseArgs,
      lastServiceDate: daysAgo(0),
      recentTickets: Array.from({ length: 4 }, () => ({
        status: 'open',
        createdAt: daysAgo(1),
        description: null,
      })),
    });
    expect(r.confidence).toBeCloseTo(SIGNAL_WEIGHTS.error_freq, 10);
  });

  it('an unknown service date alone stays below the default dispatch threshold', () => {
    // 0.6 * 0.2 = 0.12 — a machine with no history must not summon a technician.
    const r = scoreMachine({ ...baseArgs, lastServiceDate: null, installDate: null });
    expect(r.confidence).toBeCloseTo(0.12, 10);
    expect(r.confidence).toBeLessThan(DEFAULT_CONFIDENCE_THRESHOLD);
  });

  it('passes the contract value through untouched for the priority sort', () => {
    expect(scoreMachine({ ...baseArgs, contractValue: 9999 }).contractValue).toBe(9999);
  });
});

describe('suggestParts', () => {
  const sig = (over: Partial<Record<string, number>>) => ({
    meter_accel: { value: over.meter_accel ?? 0, weight: 0.25 },
    error_freq: { value: over.error_freq ?? 0, weight: 0.25 },
    days_since_service: { value: over.days_since_service ?? 0, weight: 0.2 },
    model_age: { value: over.model_age ?? 0, weight: 0.15 },
    toner_anomaly: { value: over.toner_anomaly ?? 0, weight: 0.15 },
    suggested_parts: [] as string[],
  });

  it('suggests nothing when no signal is elevated', () => {
    expect(suggestParts(sig({}))).toEqual([]);
  });

  it('maps each elevated signal to its parts', () => {
    expect(suggestParts(sig({ toner_anomaly: 0.5 }))).toEqual(['Toner cartridge']);
    expect(suggestParts(sig({ meter_accel: 0.5 }))).toEqual(['Fuser unit', 'Transfer belt']);
    expect(suggestParts(sig({ error_freq: 0.5 }))).toEqual(['Pickup roller', 'Maintenance kit']);
    // model_age uses a higher bar than the others.
    expect(suggestParts(sig({ model_age: 0.5 }))).toEqual([]);
    expect(suggestParts(sig({ model_age: 0.6 }))).toEqual(['Drum unit']);
  });

  it('deduplicates parts nominated by more than one signal', () => {
    const parts = suggestParts(sig({ meter_accel: 0.9, error_freq: 0.9, toner_anomaly: 0.9 }));
    expect(parts).toHaveLength(new Set(parts).size);
    expect(parts).toContain('Fuser unit');
    expect(parts).toContain('Maintenance kit');
  });
});

describe('computeAccuracy', () => {
  const pred = (
    o: Partial<{ machineId: string; generatedAt: Date | null; model: string | null }>,
  ) => ({
    machineId: 'm-1',
    generatedAt: daysAgo(60),
    model: 'MX-500',
    ...o,
  });

  it('counts a ticket closing within 30 days after the prediction as a true positive', () => {
    const r = computeAccuracy(
      [pred({})],
      [{ equipmentId: 'm-1', resolvedAt: daysAgo(40), createdAt: daysAgo(50) }],
    );
    expect(r[0]).toMatchObject({ model: 'MX-500', predictions: 1, truePositives: 1, precision: 1 });
  });

  it('does not credit a ticket that closed BEFORE the prediction was made', () => {
    // Otherwise the model gets credit for failures it never predicted.
    const r = computeAccuracy(
      [pred({})],
      [{ equipmentId: 'm-1', resolvedAt: daysAgo(90), createdAt: daysAgo(95) }],
    );
    expect(r[0]).toMatchObject({ truePositives: 0, falsePositives: 1, precision: 0 });
  });

  it('does not credit a ticket that closed more than 30 days later', () => {
    const r = computeAccuracy(
      [pred({})],
      [{ equipmentId: 'm-1', resolvedAt: daysAgo(20), createdAt: daysAgo(25) }],
    );
    expect(r[0].truePositives).toBe(0);
  });

  it('does not credit a ticket belonging to a different machine', () => {
    const r = computeAccuracy(
      [pred({})],
      [{ equipmentId: 'm-2', resolvedAt: daysAgo(40), createdAt: daysAgo(45) }],
    );
    expect(r[0].truePositives).toBe(0);
  });

  it('falls back to createdAt when a closed ticket has no resolvedAt', () => {
    const r = computeAccuracy(
      [pred({})],
      [{ equipmentId: 'm-1', resolvedAt: null, createdAt: daysAgo(40) }],
    );
    expect(r[0].truePositives).toBe(1);
  });

  it('groups by model and buckets unknown models rather than dropping them', () => {
    const r = computeAccuracy(
      [pred({ model: 'MX-500' }), pred({ model: null, machineId: 'm-9' })],
      [],
    );
    expect(r.map((m) => m.model).sort()).toEqual(['MX-500', 'Unknown']);
  });

  it('reports zero precision rather than NaN when there is nothing to score', () => {
    expect(computeAccuracy([], [])).toEqual([]);
    const r = computeAccuracy([pred({ generatedAt: null })], []);
    expect(r[0].precision).toBe(0);
    expect(Number.isNaN(r[0].precision)).toBe(false);
  });
});
