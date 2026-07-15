/**
 * Schema-of-record for the billing DRIFT tables (PA-034).
 *
 * `billing_configurations`, `billing_cycles`, and `billing_adjustments` existed
 * only as raw-SQL tables in production (in no Drizzle schema or migration), so a
 * freshly-provisioned database silently 503'd billing writes. These definitions
 * + migration 0023 make them provisionable. Columns mirror exactly what the
 * billing edge-function handlers (supabase/functions/billing/handlers/*) read
 * and write.
 */
import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  decimal,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

export const billingConfigurations = pgTable(
  'billing_configurations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    configurationName: text('configuration_name'),
    billingType: text('billing_type'),
    billingFrequency: text('billing_frequency'),
    billingDay: integer('billing_day'),
    baseRate: decimal('base_rate', { precision: 12, scale: 4 }),
    minimumCharge: decimal('minimum_charge', { precision: 12, scale: 2 }),
    maximumCharge: decimal('maximum_charge', { precision: 12, scale: 2 }),
    overageRate: decimal('overage_rate', { precision: 12, scale: 4 }),
    setupFee: decimal('setup_fee', { precision: 12, scale: 2 }),
    maintenanceFee: decimal('maintenance_fee', { precision: 12, scale: 2 }),
    taxRate: decimal('tax_rate', { precision: 6, scale: 4 }),
    taxInclusive: boolean('tax_inclusive').default(false),
    contractLengthMonths: integer('contract_length_months'),
    earlyTerminationFee: decimal('early_termination_fee', { precision: 12, scale: 2 }),
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => ({ tenantIdx: index('billing_configurations_tenant_idx').on(t.tenantId) }),
);

export const billingCycles = pgTable(
  'billing_cycles',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    cycleName: text('cycle_name'),
    cycleDate: date('cycle_date'),
    status: varchar('status').default('processing'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    totalInvoicesGenerated: integer('total_invoices_generated').default(0),
    totalAmount: decimal('total_amount', { precision: 14, scale: 2 }).default('0'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({ tenantIdx: index('billing_cycles_tenant_idx').on(t.tenantId) }),
);

export const billingAdjustments = pgTable(
  'billing_adjustments',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    adjustmentType: text('adjustment_type'),
    adjustmentReason: text('adjustment_reason'),
    amount: decimal('amount', { precision: 14, scale: 2 }),
    description: text('description'),
    invoiceId: varchar('invoice_id'),
    businessRecordId: varchar('business_record_id'),
    status: varchar('status').default('pending'),
    requestedBy: varchar('requested_by'),
    approvedBy: varchar('approved_by'),
    approvedAt: timestamp('approved_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({ tenantIdx: index('billing_adjustments_tenant_idx').on(t.tenantId) }),
);

export const insertBillingConfigurationSchema = createInsertSchema(billingConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertBillingCycleSchema = createInsertSchema(billingCycles).omit({
  id: true,
  createdAt: true,
});
export const insertBillingAdjustmentSchema = createInsertSchema(billingAdjustments).omit({
  id: true,
  createdAt: true,
});

export type BillingConfiguration = typeof billingConfigurations.$inferSelect;
export type BillingCycle = typeof billingCycles.$inferSelect;
export type BillingAdjustment = typeof billingAdjustments.$inferSelect;
