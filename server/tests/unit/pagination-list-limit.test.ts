import { describe, it, expect } from 'vitest';
import { parseListLimit, LIST_LIMIT_MAX, LIST_LIMIT_DEFAULT } from '../../lib/pagination';

describe('parseListLimit (CR-013)', () => {
  it('returns the default when the param is absent', () => {
    expect(parseListLimit(undefined)).toBe(LIST_LIMIT_DEFAULT);
    expect(parseListLimit('')).toBe(LIST_LIMIT_DEFAULT);
    expect(parseListLimit(null)).toBe(LIST_LIMIT_DEFAULT);
  });

  it('honors a custom default', () => {
    expect(parseListLimit(undefined, { def: 20 })).toBe(20);
  });

  it('clamps values above the max to the ceiling', () => {
    expect(parseListLimit('100000')).toBe(LIST_LIMIT_MAX);
    expect(parseListLimit(999999, { max: 200 })).toBe(200);
  });

  it('returns null (→ caller 400s) on invalid input', () => {
    expect(parseListLimit('abc')).toBeNull();
    expect(parseListLimit('-5')).toBeNull();
    expect(parseListLimit('0')).toBeNull();
    expect(parseListLimit(-1)).toBeNull();
  });

  it('accepts valid in-range values and floors fractions', () => {
    expect(parseListLimit('25')).toBe(25);
    expect(parseListLimit('50.9')).toBe(50);
  });
});
