import { describe, it, expect } from 'vitest';
import { scoreDeal, MIN_SIGNALS_FOR_SCORE, type DealScoreInput } from '@shared/deal-score';

// Fixed clock so every assertion is deterministic.
const NOW = new Date('2026-08-11T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

/** A deal with enough signal to be scored at all. */
function healthy(overrides: Partial<DealScoreInput> = {}): DealScoreInput {
  return {
    status: 'open',
    lastActivityDate: daysAgo(2),
    nextFollowUpDate: daysAhead(3),
    expectedCloseDate: daysAhead(20),
    stageEnteredAt: daysAgo(3),
    stageSlaDays: 14,
    contactCount: 3,
    ...overrides,
  };
}

describe('scoreDeal — refusing to invent', () => {
  it('does NOT return a score when too few signals are present', () => {
    const result = scoreDeal({ status: 'open' }, NOW);
    expect(result.scored).toBe(false);
    expect(result.score).toBe(0);
    expect(result.missingSignals.length).toBeGreaterThan(0);
  });

  it('reports every absent signal by name rather than silently skipping it', () => {
    const result = scoreDeal({ status: 'open' }, NOW);
    expect(result.missingSignals).toContain('last activity date');
    expect(result.missingSignals).toContain('expected close date');
    expect(result.missingSignals).toContain('stage SLA');
  });

  it('starts scoring once the minimum number of signals is available', () => {
    const result = scoreDeal(
      {
        status: 'open',
        lastActivityDate: daysAgo(1),
        nextFollowUpDate: daysAhead(2),
        expectedCloseDate: daysAhead(10),
      },
      NOW,
    );
    expect(result.scored).toBe(true);
    expect(MIN_SIGNALS_FOR_SCORE).toBe(3);
  });
});

describe('scoreDeal — every point is attributable', () => {
  it('gives a reason for each factor it applies', () => {
    const result = scoreDeal(healthy(), NOW);
    expect(result.factors.length).toBeGreaterThan(0);
    for (const factor of result.factors) {
      expect(factor.reason.trim()).not.toBe('');
      expect(factor.label.trim()).not.toBe('');
    }
  });

  it('the reported factors sum to the distance from the neutral baseline', () => {
    const result = scoreDeal(healthy(), NOW);
    const applied = result.factors.reduce((sum, f) => sum + f.points, 0);
    // Baseline is 50; the score must be explainable entirely by its factors.
    expect(result.score).toBe(Math.max(0, Math.min(100, 50 + applied)));
  });
});

describe('scoreDeal — risk detection', () => {
  it('flags a deal that has gone quiet, and escalates past 45 days', () => {
    const warn = scoreDeal(healthy({ lastActivityDate: daysAgo(30) }), NOW);
    expect(warn.risks.find((r) => r.key === 'gone_quiet')?.severity).toBe('warning');

    const crit = scoreDeal(healthy({ lastActivityDate: daysAgo(60) }), NOW);
    expect(crit.risks.find((r) => r.key === 'gone_quiet')?.severity).toBe('critical');
  });

  it('flags a missing next step', () => {
    const result = scoreDeal(healthy({ nextFollowUpDate: null }), NOW);
    expect(result.risks.some((r) => r.key === 'no_next_step')).toBe(true);
  });

  it('flags an overdue follow-up', () => {
    const result = scoreDeal(healthy({ nextFollowUpDate: daysAgo(4) }), NOW);
    const risk = result.risks.find((r) => r.key === 'next_step_overdue');
    expect(risk?.message).toContain('4 day');
  });

  it('flags a passed close date only while the deal is still open', () => {
    const open = scoreDeal(healthy({ expectedCloseDate: daysAgo(10) }), NOW);
    expect(open.risks.some((r) => r.key === 'close_date_passed')).toBe(true);

    const won = scoreDeal(healthy({ expectedCloseDate: daysAgo(10), status: 'won' }), NOW);
    expect(won.risks.some((r) => r.key === 'close_date_passed')).toBe(false);
  });

  it('flags single-threading, and treats zero contacts as critical', () => {
    const single = scoreDeal(healthy({ contactCount: 1 }), NOW);
    expect(single.risks.find((r) => r.key === 'single_threaded')?.severity).toBe('warning');

    const none = scoreDeal(healthy({ contactCount: 0 }), NOW);
    expect(none.risks.find((r) => r.key === 'single_threaded')?.severity).toBe('critical');
  });

  it('flags a stage SLA breach with the overage in days', () => {
    const result = scoreDeal(healthy({ stageEnteredAt: daysAgo(20), stageSlaDays: 14 }), NOW);
    const risk = result.risks.find((r) => r.key === 'stage_sla_breached');
    expect(risk?.message).toContain('6 day');
  });

  it('does not flag an SLA breach when no SLA is configured', () => {
    const result = scoreDeal(healthy({ stageEnteredAt: daysAgo(90), stageSlaDays: null }), NOW);
    expect(result.risks.some((r) => r.key === 'stage_sla_breached')).toBe(false);
    expect(result.missingSignals).toContain('stage SLA');
  });
});

describe('scoreDeal — banding and bounds', () => {
  it('rates a well-run deal above a neglected one', () => {
    const good = scoreDeal(healthy(), NOW);
    const bad = scoreDeal(
      healthy({
        lastActivityDate: daysAgo(60),
        nextFollowUpDate: daysAgo(20),
        expectedCloseDate: daysAgo(15),
        stageEnteredAt: daysAgo(60),
        contactCount: 0,
      }),
      NOW,
    );
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.band).toBe('strong');
    expect(bad.band).toBe('critical');
  });

  it('never leaves the 0-100 range', () => {
    const bad = scoreDeal(
      healthy({
        lastActivityDate: daysAgo(365),
        nextFollowUpDate: daysAgo(200),
        expectedCloseDate: daysAgo(200),
        stageEnteredAt: daysAgo(365),
        contactCount: 0,
      }),
      NOW,
    );
    expect(bad.score).toBeGreaterThanOrEqual(0);
    expect(bad.score).toBeLessThanOrEqual(100);
  });

  it('is deterministic — the same input and clock give the same result', () => {
    const a = scoreDeal(healthy(), NOW);
    const b = scoreDeal(healthy(), NOW);
    expect(a).toEqual(b);
  });

  it('tolerates unparseable dates without inventing a signal', () => {
    const result = scoreDeal(healthy({ lastActivityDate: 'not-a-date' }), NOW);
    expect(result.missingSignals).toContain('last activity date');
  });
});
