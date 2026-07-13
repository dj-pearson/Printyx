import { describe, it, expect } from 'vitest';
import { calcPricingInputSchema } from '../../routes-pricing';

describe('calcPricingInputSchema (CR-020)', () => {
  it('rejects a missing dealerCost', () => {
    const result = calcPricingInputSchema.safeParse({ productId: 'p1' });
    expect(result.success).toBe(false);
  });

  it('rejects a garbage (non-numeric) dealerCost instead of producing NaN', () => {
    const result = calcPricingInputSchema.safeParse({ dealerCost: 'not-a-number' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative dealerCost', () => {
    const result = calcPricingInputSchema.safeParse({ dealerCost: -5 });
    expect(result.success).toBe(false);
  });

  it('coerces a numeric string dealerCost to a number', () => {
    const result = calcPricingInputSchema.safeParse({ dealerCost: '123.45' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dealerCost).toBe(123.45);
      expect(Number.isNaN(result.data.dealerCost)).toBe(false);
      expect(result.data.quantity).toBe(1); // default applied
    }
  });

  it('honors a legitimate zero dealerCost', () => {
    const result = calcPricingInputSchema.safeParse({ dealerCost: 0 });
    expect(result.success).toBe(true);
  });
});
