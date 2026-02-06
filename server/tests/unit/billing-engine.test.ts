/**
 * Unit Tests: Billing Engine Service
 * Tests for pricing calculations, tiered pricing, volume discounts,
 * meter reading validation, anomaly detection, and helper methods.
 *
 * Uses the BillingEngineService class directly - tests pure calculation
 * methods and mocks DB-dependent methods where needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB before importing the service
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => []),
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 'anomaly-1' }]),
      })),
    })),
  },
}));

vi.mock('@shared/schema', () => ({
  invoices: {},
  invoiceLineItems: {},
  contracts: {},
  contractTieredRates: {},
  businessRecords: {},
  meterReadings: {},
  autoInvoiceGeneration: {},
  billingRules: {},
  meterAnomalies: {},
  billingDisputes: {},
  creditMemos: {},
}));

import {
  BillingEngineService,
  type LineItemInput,
  type TieredRate,
  type VolumeDiscount,
} from '../../services/billing-engine-service';

// Access private methods for testing via prototype
const billingEngine = new BillingEngineService();

// Helper to access private methods
function callPrivate<T>(obj: any, method: string, ...args: any[]): T {
  return obj[method](...args);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BillingEngineService', () => {
  // ─── applyTieredPricing ────────────────────────────────────────────
  describe('applyTieredPricing (via calculateLineItemPrice)', () => {
    it('should calculate tiered pricing with single tier', () => {
      const tiers: TieredRate[] = [{ minVolume: 0, maxVolume: null, rate: 0.05 }];

      const result = callPrivate<any>(billingEngine, 'applyTieredPricing', 1000, tiers);

      expect(result.amount).toBe(50); // 1000 * 0.05
    });

    it('should calculate tiered pricing with multiple tiers', () => {
      const tiers: TieredRate[] = [
        { minVolume: 0, maxVolume: 500, rate: 0.05 },
        { minVolume: 500, maxVolume: 1000, rate: 0.03 },
        { minVolume: 1000, maxVolume: null, rate: 0.01 },
      ];

      const result = callPrivate<any>(billingEngine, 'applyTieredPricing', 1500, tiers);

      // Tier 1: 500 * 0.05 = 25
      // Tier 2: 500 * 0.03 = 15
      // Tier 3: 500 * 0.01 = 5
      expect(result.amount).toBe(45);
    });

    it('should handle zero usage', () => {
      const tiers: TieredRate[] = [{ minVolume: 0, maxVolume: null, rate: 0.05 }];

      const result = callPrivate<any>(billingEngine, 'applyTieredPricing', 0, tiers);

      expect(result.amount).toBe(0);
    });

    it('should handle usage within first tier only', () => {
      const tiers: TieredRate[] = [
        { minVolume: 0, maxVolume: 1000, rate: 0.1 },
        { minVolume: 1000, maxVolume: null, rate: 0.05 },
      ];

      const result = callPrivate<any>(billingEngine, 'applyTieredPricing', 300, tiers);

      expect(result.amount).toBe(30); // 300 * 0.10
    });
  });

  // ─── applyVolumeDiscounts ──────────────────────────────────────────
  describe('applyVolumeDiscounts', () => {
    it('should apply highest applicable discount', () => {
      const discounts: VolumeDiscount[] = [
        { threshold: 100, discountPercent: 5 },
        { threshold: 500, discountPercent: 10 },
        { threshold: 1000, discountPercent: 15 },
      ];

      const result = callPrivate<any>(billingEngine, 'applyVolumeDiscounts', 750, discounts);

      // Amount 750 >= 500 threshold → 10% discount
      expect(result.discount).toBe(75); // 750 * 10 / 100
      expect(result.percent).toBe(10);
    });

    it('should return no discount when below all thresholds', () => {
      const discounts: VolumeDiscount[] = [
        { threshold: 100, discountPercent: 5 },
        { threshold: 500, discountPercent: 10 },
      ];

      const result = callPrivate<any>(billingEngine, 'applyVolumeDiscounts', 50, discounts);

      expect(result.discount).toBe(0);
      expect(result.percent).toBe(0);
    });

    it('should apply highest tier discount when all thresholds met', () => {
      const discounts: VolumeDiscount[] = [
        { threshold: 100, discountPercent: 5 },
        { threshold: 500, discountPercent: 10 },
        { threshold: 1000, discountPercent: 20 },
      ];

      const result = callPrivate<any>(billingEngine, 'applyVolumeDiscounts', 2000, discounts);

      // 2000 >= 1000 → 20% discount
      expect(result.discount).toBe(400); // 2000 * 20 / 100
      expect(result.percent).toBe(20);
    });
  });

  // ─── calculateLineItemPrice ────────────────────────────────────────
  describe('calculateLineItemPrice', () => {
    it('should calculate base price with no billing rules', async () => {
      const item: LineItemInput = {
        description: 'B&W Copies',
        quantity: 1000,
        unitPrice: '0.05',
      };
      const contract = { id: 'c1' } as any;
      const rules: any[] = [];

      const result = await billingEngine.calculateLineItemPrice(item, contract, rules);

      expect(result.breakdown.baseAmount).toBe(50); // 1000 * 0.05
      expect(result.subtotal).toBe(50);
      expect(result.total).toBe(50);
      expect(result.discount).toBe(0);
      expect(result.appliedRules).toHaveLength(0);
    });

    it('should apply tiered pricing rule', async () => {
      const item: LineItemInput = {
        description: 'B&W Copies',
        quantity: 1500,
        unitPrice: '0.05',
      };
      const contract = { id: 'c1' } as any;
      const rules: any[] = [
        {
          ruleStatus: 'active',
          ruleType: 'tiered',
          ruleName: 'Tiered BW',
          priority: 1,
          tieredRates: [
            { minVolume: 0, maxVolume: 500, rate: 0.05 },
            { minVolume: 500, maxVolume: 1000, rate: 0.03 },
            { minVolume: 1000, maxVolume: null, rate: 0.01 },
          ],
        },
      ];

      const result = await billingEngine.calculateLineItemPrice(item, contract, rules);

      // Tiered: 500 * 0.05 + 500 * 0.03 + 500 * 0.01 = 25 + 15 + 5 = 45
      expect(result.breakdown.tieredAmount).toBe(45);
      expect(result.appliedRules).toContain('Tiered: Tiered BW');
    });

    it('should apply volume discount rule', async () => {
      const item: LineItemInput = {
        description: 'Color Copies',
        quantity: 500,
        unitPrice: '0.10',
      };
      const contract = { id: 'c1' } as any;
      const rules: any[] = [
        {
          ruleStatus: 'active',
          ruleType: 'volume_discount',
          ruleName: '10% Volume',
          priority: 1,
          volumeDiscounts: [{ threshold: 30, discountPercent: 10 }],
        },
      ];

      const result = await billingEngine.calculateLineItemPrice(item, contract, rules);

      // Base: 500 * 0.10 = 50
      // Volume discount: 50 * 10/100 = 5
      expect(result.breakdown.baseAmount).toBe(50);
      expect(result.breakdown.volumeDiscount).toBe(5);
      expect(result.discount).toBe(5);
      expect(result.subtotal).toBe(45); // 50 - 5
    });

    it('should apply flat rate rule', async () => {
      const item: LineItemInput = {
        description: 'Monthly Service',
        quantity: 1,
        unitPrice: '50.00',
      };
      const contract = { id: 'c1' } as any;
      const rules: any[] = [
        {
          ruleStatus: 'active',
          ruleType: 'flat_rate',
          ruleName: 'Fixed Monthly',
          priority: 1,
          baseCharge: '75.00',
        },
      ];

      const result = await billingEngine.calculateLineItemPrice(item, contract, rules);

      // Flat rate overrides base to 75.00
      expect(result.breakdown.baseAmount).toBe(75);
      expect(result.appliedRules).toContain('Flat Rate: Fixed Monthly');
    });

    it('should skip inactive rules', async () => {
      const item: LineItemInput = {
        description: 'B&W Copies',
        quantity: 1000,
        unitPrice: '0.05',
      };
      const contract = { id: 'c1' } as any;
      const rules: any[] = [
        {
          ruleStatus: 'inactive',
          ruleType: 'flat_rate',
          ruleName: 'Disabled Rule',
          priority: 1,
          baseCharge: '999.00',
        },
      ];

      const result = await billingEngine.calculateLineItemPrice(item, contract, rules);

      // Inactive rule should be skipped, use base calculation
      expect(result.breakdown.baseAmount).toBe(50); // 1000 * 0.05
      expect(result.appliedRules).toHaveLength(0);
    });

    it('should sort rules by priority (highest first)', async () => {
      const item: LineItemInput = {
        description: 'Test',
        quantity: 100,
        unitPrice: '1.00',
      };
      const contract = { id: 'c1' } as any;
      const rules: any[] = [
        {
          ruleStatus: 'active',
          ruleType: 'flat_rate',
          ruleName: 'Low Priority',
          priority: 1,
          baseCharge: '50.00',
        },
        {
          ruleStatus: 'active',
          ruleType: 'flat_rate',
          ruleName: 'High Priority',
          priority: 10,
          baseCharge: '75.00',
        },
      ];

      const result = await billingEngine.calculateLineItemPrice(item, contract, rules);

      // High priority runs first (sets base to 75), then low priority overrides to 50
      // The sorted order is highest-first, so the last flat_rate rule wins
      expect(result.breakdown.baseAmount).toBe(50);
    });
  });

  // ─── validateMeterReadings ─────────────────────────────────────────
  describe('validateMeterReadings', () => {
    it('should return warning for empty readings array', async () => {
      const result = await billingEngine.validateMeterReadings([], null, 'tenant-1');

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No meter readings provided');
    });

    it('should return warning for null readings', async () => {
      const result = await billingEngine.validateMeterReadings(null as any, null, 'tenant-1');

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No meter readings provided');
    });

    it('should detect negative BW reading', async () => {
      const readings = [
        {
          id: 'r1',
          equipmentId: 'eq-1',
          blackWhiteCount: -100,
          colorCount: 50,
        },
      ] as any[];

      const result = await billingEngine.validateMeterReadings(readings, null, 'tenant-1');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Negative reading');
    });

    it('should detect negative color reading', async () => {
      const readings = [
        {
          id: 'r1',
          equipmentId: 'eq-1',
          blackWhiteCount: 50,
          colorCount: -200,
        },
      ] as any[];

      const result = await billingEngine.validateMeterReadings(readings, null, 'tenant-1');

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Negative reading');
    });

    it('should pass for valid positive readings without equipment', async () => {
      const readings = [
        {
          id: 'r1',
          equipmentId: 'eq-1',
          blackWhiteCount: 1000,
          colorCount: 200,
        },
      ] as any[];

      const result = await billingEngine.validateMeterReadings(readings, null, 'tenant-1');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ─── generateAnomalyDescription ───────────────────────────────────
  describe('generateAnomalyDescription', () => {
    it('should describe spike anomaly', () => {
      const desc = callPrivate<string>(billingEngine, 'generateAnomalyDescription', {
        anomalyType: 'spike',
        bwDeviation: 500,
        colorDeviation: 100,
      });
      expect(desc).toContain('spike');
      expect(desc).toContain('500');
    });

    it('should describe negative reading', () => {
      const desc = callPrivate<string>(billingEngine, 'generateAnomalyDescription', {
        anomalyType: 'negative_reading',
      });
      expect(desc).toContain('Negative');
      expect(desc).toContain('data entry error');
    });

    it('should describe sudden drop', () => {
      const desc = callPrivate<string>(billingEngine, 'generateAnomalyDescription', {
        anomalyType: 'sudden_drop',
      });
      expect(desc).toContain('drop');
    });

    it('should describe stagnant reading', () => {
      const desc = callPrivate<string>(billingEngine, 'generateAnomalyDescription', {
        anomalyType: 'stagnant',
      });
      expect(desc).toContain('offline');
    });

    it('should handle unknown anomaly type', () => {
      const desc = callPrivate<string>(billingEngine, 'generateAnomalyDescription', {
        anomalyType: 'custom_unknown',
      });
      expect(desc).toContain('custom_unknown');
    });
  });

  // ─── generateSuggestedAction ───────────────────────────────────────
  describe('generateSuggestedAction', () => {
    it('should suggest review for spike', () => {
      const action = callPrivate<string>(billingEngine, 'generateSuggestedAction', {
        anomalyType: 'spike',
      });
      expect(action).toContain('Review');
    });

    it('should suggest correction for negative reading', () => {
      const action = callPrivate<string>(billingEngine, 'generateSuggestedAction', {
        anomalyType: 'negative_reading',
      });
      expect(action).toContain('Correct');
      expect(action).toContain('Do not bill');
    });

    it('should suggest contact for sudden drop', () => {
      const action = callPrivate<string>(billingEngine, 'generateSuggestedAction', {
        anomalyType: 'sudden_drop',
      });
      expect(action).toContain('Contact');
    });

    it('should suggest verification for stagnant reading', () => {
      const action = callPrivate<string>(billingEngine, 'generateSuggestedAction', {
        anomalyType: 'stagnant',
      });
      expect(action).toContain('Verify');
    });
  });

  // ─── calculateDueDate ──────────────────────────────────────────────
  describe('calculateDueDate', () => {
    it('should add 30 days for net30', () => {
      const before = new Date();
      const dueDate = callPrivate<Date>(billingEngine, 'calculateDueDate', 'net30');
      const expectedMin = new Date(before);
      expectedMin.setDate(expectedMin.getDate() + 29); // Allow for timing
      expect(dueDate.getTime()).toBeGreaterThan(expectedMin.getTime());
    });

    it('should add 15 days for net15', () => {
      const before = new Date();
      const dueDate = callPrivate<Date>(billingEngine, 'calculateDueDate', 'net15');
      const expectedMin = new Date(before);
      expectedMin.setDate(expectedMin.getDate() + 14);
      expect(dueDate.getTime()).toBeGreaterThan(expectedMin.getTime());
    });

    it('should add 60 days for net60', () => {
      const before = new Date();
      const dueDate = callPrivate<Date>(billingEngine, 'calculateDueDate', 'net60');
      const expectedMin = new Date(before);
      expectedMin.setDate(expectedMin.getDate() + 59);
      expect(dueDate.getTime()).toBeGreaterThan(expectedMin.getTime());
    });

    it('should be today for due_on_receipt', () => {
      const before = new Date();
      const dueDate = callPrivate<Date>(billingEngine, 'calculateDueDate', 'due_on_receipt');
      // Should be within a few seconds of now
      expect(Math.abs(dueDate.getTime() - before.getTime())).toBeLessThan(5000);
    });

    it('should default to 30 days for unknown terms', () => {
      const before = new Date();
      const dueDate = callPrivate<Date>(billingEngine, 'calculateDueDate', 'custom_terms');
      const expectedMin = new Date(before);
      expectedMin.setDate(expectedMin.getDate() + 29);
      expect(dueDate.getTime()).toBeGreaterThan(expectedMin.getTime());
    });
  });

  // ─── getMonthsDiff ─────────────────────────────────────────────────
  describe('getMonthsDiff', () => {
    it('should return 1 for same month', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      const diff = callPrivate<number>(billingEngine, 'getMonthsDiff', start, end);
      expect(diff).toBe(1); // max(0, 1) = 1
    });

    it('should return 3 for quarterly range', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-04-01');
      const diff = callPrivate<number>(billingEngine, 'getMonthsDiff', start, end);
      expect(diff).toBe(3);
    });

    it('should return 12 for annual range', () => {
      const start = new Date('2025-01-01');
      const end = new Date('2026-01-01');
      const diff = callPrivate<number>(billingEngine, 'getMonthsDiff', start, end);
      expect(diff).toBe(12);
    });

    it('should return minimum of 1', () => {
      const start = new Date('2026-01-15');
      const end = new Date('2026-01-20');
      const diff = callPrivate<number>(billingEngine, 'getMonthsDiff', start, end);
      expect(diff).toBe(1); // Same month = 0, but max(0, 1) = 1
    });
  });

  // ─── formatDate ────────────────────────────────────────────────────
  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2026-03-15T10:30:00Z');
      const formatted = callPrivate<string>(billingEngine, 'formatDate', date);
      expect(formatted).toBe('2026-03-15');
    });
  });
});
