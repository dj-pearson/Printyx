/**
 * Multi-Vendor Toner Auto-Replenish Schema (US-SUPER-012).
 *
 * Toner ships before a machine runs out, across every vendor (Canon, Konica,
 * Ricoh, Xerox) via the address-book vendor adapters (ABK-001). Builds on
 * shared/auto-supply-replenishment-schema.ts + shared/address-book-schema.ts.
 *
 *   - machine_supply_levels    : captured toner % + page-life per machine/color
 *   - supply_orders            : replenishment orders (pending_approval | auto_ship | …)
 *   - tenant_supply_settings   : per-tenant approval threshold + default lead/buffer
 *   - machine_supply_settings  : per-machine auto-ship toggle, cost ceiling,
 *                                emergency override, customer-managed opt-out
 *
 * NOTE: the legacy auto_supply_orders table (auto-supply-replenishment-schema.ts)
 * uses an INTEGER tenant_id (drift); these net-new tables use a varchar tenant_id
 * consistent with the rest of the schema. Vendor reads sit behind a named adapter
 * stub (credentials via the credential vault) — live ABK wiring is a TODO.
 *
 * Re-exported from shared/schema.ts.
 * TODO(rbac): requirePermission(['service.supply.manage']) once it exists.
 */

import {
  boolean,
  decimal,
  doublePrecision,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Toner color channels. */
export const SUPPLY_COLORS = ['k', 'c', 'm', 'y'] as const;
export type SupplyColor = (typeof SUPPLY_COLORS)[number];

/** Replenishment order lifecycle. */
export const SUPPLY_ORDER_STATUSES = [
  'pending_approval',
  'auto_ship',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type SupplyOrderStatus = (typeof SUPPLY_ORDER_STATUSES)[number];

// ---------------------------------------------------------------------------
// machine_supply_levels — captured toner readings (one row per machine/color/run)
// ---------------------------------------------------------------------------
export const machineSupplyLevels = pgTable(
  'machine_supply_levels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** equipment.id of the MFP. */
    machineId: varchar('machine_id').notNull(),
    /** k | c | m | y. */
    color: varchar('color', { length: 2 }).notNull(),
    percentRemaining: doublePrecision('percent_remaining'),
    pageCountRemaining: integer('page_count_remaining'),
    /** 'adapter' (live vendor read) | 'injected' (synthetic, no creds yet). */
    source: varchar('source', { length: 16 }).notNull().default('injected'),
    capturedAt: timestamp('captured_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('machine_supply_levels_tenant_idx').on(table.tenantId),
    tenantMachineColorIdx: index('machine_supply_levels_tenant_machine_color_idx').on(
      table.tenantId,
      table.machineId,
      table.color,
    ),
    capturedIdx: index('machine_supply_levels_captured_idx').on(table.capturedAt),
  }),
);

// ---------------------------------------------------------------------------
// supply_orders — replenishment orders
// ---------------------------------------------------------------------------
export const supplyOrders = pgTable(
  'supply_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    machineId: varchar('machine_id').notNull(),
    color: varchar('color', { length: 2 }),
    /** pending_approval | auto_ship | shipped | delivered | cancelled. */
    status: varchar('status', { length: 20 }).notNull().default('pending_approval'),
    vendor: varchar('vendor'),
    partNumber: varchar('part_number'),
    supplyName: varchar('supply_name'),
    quantity: integer('quantity').notNull().default(1),
    unitCost: decimal('unit_cost', { precision: 10, scale: 2 }),
    totalCost: decimal('total_cost', { precision: 10, scale: 2 }),
    /** Predicted depletion date that triggered the order. */
    predictedDepletionDate: timestamp('predicted_depletion_date'),
    triggerReason: varchar('trigger_reason', { length: 300 }),
    /** Shipment tracking. */
    trackingNumber: varchar('tracking_number'),
    carrier: varchar('carrier'),
    expectedArrivalDate: timestamp('expected_arrival_date'),
    customerNotified: boolean('customer_notified').notNull().default(false),
    /** manual emergency ship vs the daily evaluator. */
    isEmergency: boolean('is_emergency').notNull().default(false),
    createdByUserId: varchar('created_by_user_id'),
    shippedAt: timestamp('shipped_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('supply_orders_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('supply_orders_tenant_status_idx').on(table.tenantId, table.status),
    tenantMachineIdx: index('supply_orders_tenant_machine_idx').on(table.tenantId, table.machineId),
  }),
);

// ---------------------------------------------------------------------------
// tenant_supply_settings — per-tenant approval threshold + defaults
// ---------------------------------------------------------------------------
export const tenantSupplySettings = pgTable('tenant_supply_settings', {
  tenantId: varchar('tenant_id').primaryKey(),
  /** Orders above this auto-ship cost go to pending_approval instead. */
  approvalCostThreshold: doublePrecision('approval_cost_threshold').notNull().default(150),
  /** Vendor lead time (days) used in the depletion trigger. */
  defaultLeadTimeDays: integer('default_lead_time_days').notNull().default(5),
  /** Extra safety buffer (days) before predicted depletion. */
  defaultSafetyBufferDays: integer('default_safety_buffer_days').notNull().default(3),
  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// machine_supply_settings — per-machine auto-ship config + suppression
// ---------------------------------------------------------------------------
export const machineSupplySettings = pgTable(
  'machine_supply_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    machineId: varchar('machine_id').notNull(),
    /** Whether auto-ship is enabled for this machine. */
    autoShipEnabled: boolean('auto_ship_enabled').notNull().default(true),
    /** Per-machine cost ceiling for auto-ship (overrides tenant threshold if lower). */
    costCeiling: doublePrecision('cost_ceiling'),
    /** Emergency override: ship even if other gates would block. */
    emergencyOverride: boolean('emergency_override').notNull().default(false),
    /** Suppression: machine marked "customer-managed supplies" (opt out). */
    customerManaged: boolean('customer_managed').notNull().default(false),
    /** Optional per-machine lead/buffer overrides (null = tenant default). */
    leadTimeDays: integer('lead_time_days'),
    safetyBufferDays: integer('safety_buffer_days'),
    updatedByUserId: varchar('updated_by_user_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantMachineUnique: uniqueIndex('machine_supply_settings_tenant_machine_uq').on(
      table.tenantId,
      table.machineId,
    ),
  }),
);

export type MachineSupplyLevel = typeof machineSupplyLevels.$inferSelect;
export type SupplyOrder = typeof supplyOrders.$inferSelect;
export type TenantSupplySettings = typeof tenantSupplySettings.$inferSelect;
export type MachineSupplySettings = typeof machineSupplySettings.$inferSelect;
