import { describe, it, expect } from 'vitest';
import {
  insertBillingConfigurationSchema,
  insertBillingCycleSchema,
  insertBillingAdjustmentSchema,
} from '@shared/billing-drift-schema';

/**
 * PA-034 guard: the drift-table schemas-of-record must accept the field sets the
 * billing edge-function handlers actually write, and require tenantId. Keeps the
 * new Drizzle schema in sync with supabase/functions/billing/handlers/*.
 */
describe('billing drift schemas (PA-034)', () => {
  it('billing_configurations accepts the handler payload and requires tenantId', () => {
    const ok = insertBillingConfigurationSchema.safeParse({
      tenantId: 't1',
      configurationName: 'Standard',
      billingType: 'metered',
      baseRate: '0.02',
      taxInclusive: false,
      isDefault: true,
    });
    expect(ok.success).toBe(true);
    const missing = insertBillingConfigurationSchema.safeParse({ configurationName: 'x' });
    expect(missing.success).toBe(false);
  });

  it('billing_cycles accepts the run-cycle payload', () => {
    const ok = insertBillingCycleSchema.safeParse({
      tenantId: 't1',
      cycleName: 'Billing Cycle Jul 2026',
      cycleDate: '2026-07-15',
      status: 'processing',
      startedAt: new Date(),
    });
    expect(ok.success).toBe(true);
  });

  it('billing_adjustments accepts the create-adjustment payload', () => {
    const ok = insertBillingAdjustmentSchema.safeParse({
      tenantId: 't1',
      adjustmentType: 'credit',
      adjustmentReason: 'goodwill',
      amount: '25.00',
      requestedBy: 'user-1',
    });
    expect(ok.success).toBe(true);
    const missing = insertBillingAdjustmentSchema.safeParse({ adjustmentType: 'credit' });
    expect(missing.success).toBe(false);
  });
});
