import { describe, expect, it } from 'vitest';
import { formatCurrency, formatCurrencyCompact, formatCurrencyWhole } from '@/lib/utils';

/**
 * 53 local copies of this existed across client/src in six different
 * behaviours. Thirteen dropped cents, including the three rendering dealer
 * cost, rep cost, suggested retail and MSRP - so a copier costing $3,499.50
 * showed as $3,500 to the rep quoting from it. Thirty-five did not coerce a
 * string, which matters because a Drizzle decimal arrives from Express as a
 * string and from PostgREST as a number: the same field is both, depending on
 * which backend answered. Thirty-two rendered "$NaN" for a missing value.
 */
describe('formatCurrency', () => {
  it('keeps cents by default - a price is not a rounded price', () => {
    expect(formatCurrency(3499.5)).toBe('$3,499.50');
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('accepts the string a decimal column arrives as', () => {
    expect(formatCurrency('3499.50')).toBe('$3,499.50');
    expect(formatCurrency('0')).toBe('$0.00');
  });

  it('renders an absence, not zero and not NaN', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency('')).toBe('—');
    expect(formatCurrency('not a number')).toBe('—');
    expect(formatCurrency(Infinity)).toBe('—');
    expect(formatCurrency(NaN)).toBe('—');
  });

  it('distinguishes a real zero from a missing value', () => {
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(null)).not.toBe('$0.00');
  });

  it('drops cents only when asked', () => {
    expect(formatCurrency(1234.56, { cents: false })).toBe('$1,235');
  });

  it('takes a custom absence marker for callers that need one', () => {
    expect(formatCurrency(null, { absent: 'Not priced' })).toBe('Not priced');
  });

  it('handles negatives, which refunds and adjustments produce', () => {
    expect(formatCurrency(-42.5)).toBe('-$42.50');
  });
});

/**
 * MONEY-FORMAT-002. Two named variants replaced the last 47 local copies. Both
 * exist because the call sites pass the formatter BY REFERENCE - to a recharts
 * tickFormatter, to metricOrDash - where there is no argument list to add an
 * option to.
 */
describe('formatCurrencyWhole', () => {
  it('is formatCurrency with cents off, and rounds rather than truncates', () => {
    expect(formatCurrencyWhole(1234.56)).toBe('$1,235');
    expect(formatCurrencyWhole('1234.56')).toBe('$1,235');
  });

  it('keeps the absence rule - a missing total is not zero', () => {
    expect(formatCurrencyWhole(null)).toBe('—');
    expect(formatCurrencyWhole(0)).toBe('$0');
  });
});

describe('formatCurrencyCompact', () => {
  it('abbreviates the way the ten local copies did, consistently', () => {
    expect(formatCurrencyCompact(1_250_000)).toBe('$1.3M');
    expect(formatCurrencyCompact(45_000)).toBe('$45K');
    expect(formatCurrencyCompact(450)).toBe('$450');
  });

  it('coerces a decimal column that arrived from Express as a string', () => {
    expect(formatCurrencyCompact('45000')).toBe('$45K');
  });

  it('renders an absence rather than $NaN, which none of the copies did', () => {
    expect(formatCurrencyCompact(null)).toBe('—');
    expect(formatCurrencyCompact(undefined)).toBe('—');
    expect(formatCurrencyCompact('not a number')).toBe('—');
  });

  it('handles negatives, which a pipeline adjustment produces', () => {
    expect(formatCurrencyCompact(-45_000)).toBe('-$45K');
  });
});
