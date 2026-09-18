/**
 * A percentage whose divisor is zero (PRICING-MARGIN-002).
 *
 * `(a / b) * 100` is correct until b is zero, and b is nearly always a total, a
 * target, a limit or a previous period - things an empty pipeline, an un-costed
 * contract or a customer in their first month legitimately have none of. The
 * result is Infinity, or NaN when both sides are zero, and because these land in
 * a template string or a bar width what shipped was "Infinity% of target" or a
 * bar a thousand screens wide. Nothing throws and nothing logs, so only the
 * empty tenant ever saw it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatPercent, percentBar, percentOf, percentOfOr } from '../../../client/src/lib/utils';

const repo = process.cwd();
const raw = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  raw(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('what the inline form did', () => {
  it('Infinity when the divisor is zero', () => {
    expect((5 / 0) * 100).toBe(Infinity);
    expect(percentOf(5, 0)).toBeNull();
  });

  it('NaN when both sides are zero', () => {
    expect(Number.isNaN((0 / 0) * 100)).toBe(true);
    expect(percentOf(0, 0)).toBeNull();
  });

  it('and "Infinity%" is what reached the screen', () => {
    expect(`${((5 / 0) * 100).toFixed(0)}%`).toBe('Infinity%');
    expect(formatPercent(percentOf(5, 0))).toBe('—');
    expect(formatPercent(percentOf(0, 0))).toBe('—');
  });
});

describe('percentOf', () => {
  it('computes the obvious cases', () => {
    expect(percentOf(25, 100)).toBe(25);
    expect(percentOf(1, 3)).toBeCloseTo(33.333, 3);
  });

  it('does not clamp - over 100 is often the real answer', () => {
    // Usage over a limit, a value over target.
    expect(percentOf(150, 100)).toBe(150);
    expect(percentOf(-20, 100)).toBe(-20);
  });

  it('is null for a missing operand, not 0', () => {
    // A zero here would be a claim: 0% of target is specific and quite bad.
    expect(percentOf(null, 100)).toBeNull();
    expect(percentOf(10, null)).toBeNull();
    expect(percentOf(undefined, undefined)).toBeNull();
  });

  it('is null for a non-finite operand', () => {
    expect(percentOf(Infinity, 100)).toBeNull();
    expect(percentOf(10, NaN)).toBeNull();
  });
});

describe('percentOfOr is the exact equivalent of the guarded inline form', () => {
  it('matches `whole > 0 ? (part / whole) * 100 : 0` across a range', () => {
    for (const [part, whole] of [
      [5, 20],
      [0, 20],
      [30, 10],
      [7, 3],
    ] as const) {
      expect(percentOfOr(part, whole)).toBeCloseTo((part / whole) * 100, 9);
    }
    expect(percentOfOr(5, 0)).toBe(0);
  });

  it('and still does not clamp, which is why it is separate from percentBar', () => {
    expect(percentOfOr(150, 100)).toBe(150);
    expect(percentBar(150, 100)).toBe(100);
    expect(percentBar(-5, 100)).toBe(0);
    expect(percentBar(5, 0)).toBe(0);
  });
});

describe('formatPercent', () => {
  it('rounds to whole percent by default and takes digits', () => {
    expect(formatPercent(33.333)).toBe('33%');
    expect(formatPercent(33.333, { digits: 1 })).toBe('33.3%');
  });

  it('renders an em dash for an absence, never NaN% or Infinity%', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
    expect(formatPercent(NaN)).toBe('—');
    expect(formatPercent(Infinity)).toBe('—');
  });

  it('signs a positive only when asked', () => {
    expect(formatPercent(12, { sign: true })).toBe('+12%');
    expect(formatPercent(-12, { sign: true })).toBe('-12%');
    expect(formatPercent(12)).toBe('12%');
  });
});

describe('the sites that had no guard at all', () => {
  it('the customer portal stops recomputing a trend the endpoint already nulls', () => {
    // AUDIT-021 made the endpoint answer null when the previous window has no
    // readings; this component divided by it anyway.
    const src = code('client/src/components/customer-portal/UsageAnalyticsDashboard.tsx');
    expect(src).toContain('percentOf(current - previous, previous)');
    expect(src).not.toContain('((current - previous) / previous) * 100');
  });

  it('a subscription usage bar cannot exceed its track', () => {
    expect(code('client/src/hooks/useSubscription.ts')).toContain('percentBar(usage, limit)');
  });

  it('"% of target" reads as a dash when no target is set', () => {
    const src = code('client/src/components/reports/KPIWidget.tsx');
    expect(src).toContain('formatPercent(percentOf(value, target))');
  });
});

describe('a margin nobody measured is gone, not zeroed', () => {
  it('MeterBilling no longer prints a 0.0% margin per contract', () => {
    // equipmentCost was hardcoded to 0, so the ternary could never take its
    // first branch and every contract showed exactly "Margin: 0.0%". A 0%
    // margin is a specific claim about a contract nobody has costed.
    const src = code('client/src/pages/MeterBilling.tsx');
    expect(src).not.toContain('Margin: {margin');
    expect(src).not.toContain('const equipmentCost = 0');
  });
});

describe('two formatters with different contracts do not share a name', () => {
  it('the AI dashboard formats a RATIO and says so', () => {
    const src = raw('client/src/pages/AIAnalyticsDashboard.tsx');
    expect(src).toContain('formatRatioPercent');
    expect(src).not.toMatch(/const formatPercent =/);
  });
});
