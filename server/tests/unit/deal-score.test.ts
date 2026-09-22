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

/**
 * A deal that is neither sinking nor at the 100 clamp. Comparisons between two
 * scores must start here: healthy() already scores 100, so a clamped comparison
 * passes whichever way the factor under test points (caught by mutation).
 */
function middling(overrides: Partial<DealScoreInput> = {}): DealScoreInput {
  return {
    status: 'open',
    lastActivityDate: daysAgo(12),
    nextFollowUpDate: daysAgo(2),
    expectedCloseDate: daysAhead(20),
    contactCount: 2,
    ...overrides,
  };
}

// ── COP-B11 second pass: the COP-M04 copier signals ───────────────────
//
// These three columns landed with COP-M04 and the deals edge function already
// returns them, so the scorer reads them instead of listing them as planned.

describe('scoreDeal — competitive pressure', () => {
  it('costs points when an incumbent is named, and names the vendor', () => {
    // middling(), not healthy(): the healthy fixture already scores 100, so a
    // clamped comparison would pass whichever direction the factor points.
    const withIncumbent = scoreDeal(middling({ incumbentVendor: 'Xerox' }), NOW);
    const without = scoreDeal(middling(), NOW);

    expect(withIncumbent.score).toBeLessThan(without.score);
    const factor = withIncumbent.factors.find((f) => f.key === 'incumbent_present');
    expect(factor?.points).toBeLessThan(0);
    expect(factor?.reason).toContain('Xerox');
  });

  it('does not raise a risk flag for competition alone', () => {
    const result = scoreDeal(healthy({ incumbentVendor: 'Ricoh' }), NOW);
    expect(result.risks.map((r) => r.key)).not.toContain('incumbent_present');
  });

  it('reports the vendor as missing rather than assuming none', () => {
    expect(scoreDeal(healthy(), NOW).missingSignals).toContain('incumbent vendor');
    // Whitespace is not an answer either.
    expect(scoreDeal(healthy({ incumbentVendor: '  ' }), NOW).missingSignals).toContain(
      'incumbent vendor',
    );
  });
});

describe('scoreDeal — lease buyout exposure', () => {
  it('treats zero exposure as a fact worth points, not as missing', () => {
    const result = scoreDeal(healthy({ leaseBuyoutExposure: 0 }), NOW);
    expect(result.missingSignals).not.toContain('lease buyout exposure');
    expect(result.factors.find((f) => f.key === 'no_buyout')?.points).toBe(5);
  });

  it('scores a heavy buyout against the deal size and flags it', () => {
    const result = scoreDeal(healthy({ amount: '40000', leaseBuyoutExposure: '14000' }), NOW);
    const factor = result.factors.find((f) => f.key === 'buyout_heavy');
    expect(factor?.points).toBe(-15);
    expect(factor?.reason).toContain('35%');
    expect(result.risks.find((r) => r.key === 'buyout_heavy')?.severity).toBe('warning');
  });

  it('escalates to critical when the buyout is half the deal or more', () => {
    const result = scoreDeal(healthy({ amount: 20000, leaseBuyoutExposure: 12000 }), NOW);
    expect(result.risks.find((r) => r.key === 'buyout_heavy')?.severity).toBe('critical');
  });

  it('scores a small buyout lightly when the deal has no amount to compare against', () => {
    const result = scoreDeal(healthy({ leaseBuyoutExposure: '3200.00' }), NOW);
    expect(result.factors.find((f) => f.key === 'buyout_present')?.points).toBe(-5);
    expect(result.risks.map((r) => r.key)).not.toContain('buyout_heavy');
  });

  it('treats an unparseable exposure as absent rather than as zero', () => {
    const result = scoreDeal(healthy({ leaseBuyoutExposure: 'tbd' }), NOW);
    expect(result.missingSignals).toContain('lease buyout exposure');
    expect(result.factors.map((f) => f.key)).not.toContain('no_buyout');
  });
});

describe('scoreDeal — forecast category', () => {
  it('rewards commit over best case over pipeline', () => {
    const commit = scoreDeal(middling({ forecastCategory: 'commit' }), NOW).score;
    const best = scoreDeal(middling({ forecastCategory: 'best_case' }), NOW).score;
    const pipeline = scoreDeal(middling({ forecastCategory: 'pipeline' }), NOW).score;
    expect(commit).toBeGreaterThan(best);
    expect(best).toBeGreaterThan(pipeline);
  });

  it('ignores an unknown bucket instead of guessing a weight', () => {
    const unknown = scoreDeal(middling({ forecastCategory: 'omitted' }), NOW);
    const none = scoreDeal(middling(), NOW);
    expect(unknown.score).toBe(none.score);
    expect(unknown.factors.map((f) => f.key)).not.toContain('forecast_omitted');
  });

  it('carries no weight for a closed deal — status already says that', () => {
    const closed = scoreDeal(healthy({ forecastCategory: 'closed' }), NOW);
    expect(closed.factors.map((f) => f.key)).not.toContain('forecast_closed');
  });
});

describe('scoreDeal — quote margin against tenant policy', () => {
  it('flags margin under the tenant floor, not a floor picked here', () => {
    const result = scoreDeal(healthy({ quoteMarginPct: 9 }), NOW, { minMarginPct: 22 });
    const risk = result.risks.find((r) => r.key === 'margin_below_policy');
    expect(risk?.message).toContain('22%');
    expect(result.factors.find((f) => f.key === 'margin_below_policy')?.points).toBe(-15);
  });

  it('falls back to the QUOTE-016 default floor when the tenant sets none', () => {
    expect(scoreDeal(healthy({ quoteMarginPct: 14 }), NOW).risks.map((r) => r.key)).toContain(
      'margin_below_policy',
    );
    expect(scoreDeal(healthy({ quoteMarginPct: 16 }), NOW).factors.map((f) => f.key)).toContain(
      'margin_healthy',
    );
  });

  it('escalates a negative margin to critical', () => {
    const result = scoreDeal(healthy({ quoteMarginPct: -3 }), NOW);
    expect(result.risks.find((r) => r.key === 'margin_below_policy')?.severity).toBe('critical');
  });

  it('flags a discount over policy without charging for it twice', () => {
    const result = scoreDeal(healthy({ quoteDiscountPct: 18 }), NOW, { maxDiscountPct: 10 });
    expect(result.risks.map((r) => r.key)).toContain('discount_over_policy');
    // The concession is already priced by the margin factor.
    expect(result.factors.map((f) => f.key)).not.toContain('discount_over_policy');
  });

  it('does not enforce a discount ceiling the tenant has not set', () => {
    expect(
      scoreDeal(healthy({ quoteDiscountPct: 40 }), NOW, { maxDiscountPct: 0 }).risks.map(
        (r) => r.key,
      ),
    ).not.toContain('discount_over_policy');
    expect(scoreDeal(healthy({ quoteDiscountPct: 40 }), NOW).risks.map((r) => r.key)).not.toContain(
      'discount_over_policy',
    );
  });
});

describe('scoreDeal — the score still explains itself', () => {
  it('every factor is accounted for in the total', () => {
    const input = healthy({
      incumbentVendor: 'Canon',
      leaseBuyoutExposure: 2500,
      amount: 60000,
      forecastCategory: 'commit',
      quoteMarginPct: 31,
    });
    const result = scoreDeal(input, NOW);
    const fromFactors = 50 + result.factors.reduce((sum, f) => sum + f.points, 0);
    expect(result.score).toBe(Math.max(0, Math.min(100, Math.round(fromFactors))));
  });

  it('stays inside 0-100 with every negative signal at once', () => {
    const result = scoreDeal(
      healthy({
        lastActivityDate: daysAgo(365),
        nextFollowUpDate: daysAgo(200),
        expectedCloseDate: daysAgo(200),
        stageEnteredAt: daysAgo(365),
        contactCount: 0,
        incumbentVendor: 'Konica Minolta',
        amount: 10000,
        leaseBuyoutExposure: 9000,
        forecastCategory: 'pipeline',
        quoteMarginPct: 2,
      }),
      NOW,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
