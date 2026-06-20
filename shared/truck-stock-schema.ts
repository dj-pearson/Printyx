/**
 * Predictive Parts Truck-Stocking Optimizer Schema (US-SUPER-007).
 *
 * Recommends optimal parts to stock on each tech's truck from their serviced
 * fleet + last-90-day parts-used patterns, so techs stop returning to base for
 * parts. Pairs with US-SUPER-001 (predictive failure).
 *
 *   - truck_inventory             : what each tech currently carries (per SKU)
 *   - truck_stock_settings        : per-tech capacity (max total qty / distinct SKUs)
 *   - truck_stock_recommendations : a Sunday-night optimizer run per tech
 *   - truck_stock_callbacks       : "had to come back for a part" events (accuracy)
 *
 * Parts cost comes from inventory_items (unit_cost / part_number); a tech's
 * "territory" is derived from the fleet they actually serve (service_tickets
 * assigned to them) since there is no explicit tech→territory table (documented
 * stub). Cross-table FKs are enforced in the backfill migration only.
 *
 * Re-exported from shared/schema.ts.
 * TODO(rbac): requirePermission(['service.truck_stock.manage']) once it exists.
 */

import {
  decimal,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Recommendation/restock lifecycle. */
export const TRUCK_STOCK_STATUSES = ['draft', 'picking', 'received'] as const;
export type TruckStockStatus = (typeof TRUCK_STOCK_STATUSES)[number];

// ---------------------------------------------------------------------------
// truck_inventory — current per-tech truck stock by part SKU
// ---------------------------------------------------------------------------
export const truckInventory = pgTable(
  'truck_inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    techUserId: varchar('tech_user_id').notNull(),
    partSku: varchar('part_sku').notNull(),
    quantityOnTruck: integer('quantity_on_truck').notNull().default(0),
    /** Optional per-row capacity hint (per the story's column list). */
    capacityConstraint: integer('capacity_constraint'),
    lastAuditedAt: timestamp('last_audited_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('truck_inventory_tenant_idx').on(table.tenantId),
    tenantTechIdx: index('truck_inventory_tenant_tech_idx').on(table.tenantId, table.techUserId),
    tenantTechSkuUnique: uniqueIndex('truck_inventory_tenant_tech_sku_uq').on(
      table.tenantId,
      table.techUserId,
      table.partSku,
    ),
  }),
);

// ---------------------------------------------------------------------------
// truck_stock_settings — per-tech capacity constraint
// ---------------------------------------------------------------------------
export const truckStockSettings = pgTable(
  'truck_stock_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    techUserId: varchar('tech_user_id').notNull(),
    /** Max total quantity (parts × volume) the truck can hold. */
    maxTotalQuantity: integer('max_total_quantity').notNull().default(120),
    /** Max distinct SKUs the truck can hold. */
    maxDistinctSkus: integer('max_distinct_skus').notNull().default(40),
    updatedByUserId: varchar('updated_by_user_id'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantTechUnique: uniqueIndex('truck_stock_settings_tenant_tech_uq').on(
      table.tenantId,
      table.techUserId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// truck_stock_recommendations — one optimizer run per tech
// ---------------------------------------------------------------------------
export const truckStockRecommendations = pgTable(
  'truck_stock_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    techUserId: varchar('tech_user_id').notNull(),
    generatedAt: timestamp('generated_at').notNull().defaultNow(),
    /** Expected fill rate (0..100) of next-90-day jobs from CURRENT stock. */
    currentFillRate: doublePrecision('current_fill_rate').notNull().default(0),
    /** Expected fill rate (0..100) with the RECOMMENDED stock. */
    projectedFillRate: doublePrecision('projected_fill_rate').notNull().default(0),
    /** Capacity snapshot used for the run. */
    capacityTotal: integer('capacity_total'),
    capacityDistinct: integer('capacity_distinct'),
    /**
     * [{ sku, description, recommendedQty, currentQty, delta, unitCost, usage90d }]
     */
    recommendedItems: jsonb('recommended_items'),
    /** draft | picking | received (restock workflow). */
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    pickedAt: timestamp('picked_at'),
    receivedAt: timestamp('received_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('truck_stock_recs_tenant_idx').on(table.tenantId),
    tenantTechIdx: index('truck_stock_recs_tenant_tech_idx').on(table.tenantId, table.techUserId),
    tenantStatusIdx: index('truck_stock_recs_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

// ---------------------------------------------------------------------------
// truck_stock_callbacks — "had to return for a part" events (accuracy stats)
// ---------------------------------------------------------------------------
export const truckStockCallbacks = pgTable(
  'truck_stock_callbacks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    techUserId: varchar('tech_user_id'),
    ticketId: varchar('ticket_id'),
    /** The SKU that was missing from the truck and caused the callback. */
    missingPartSku: varchar('missing_part_sku'),
    /** Optional notes / root-cause detail. */
    note: varchar('note'),
    unitCost: decimal('unit_cost', { precision: 10, scale: 4 }),
    createdByUserId: varchar('created_by_user_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('truck_stock_callbacks_tenant_idx').on(table.tenantId),
    tenantTechIdx: index('truck_stock_callbacks_tenant_tech_idx').on(
      table.tenantId,
      table.techUserId,
    ),
  }),
);

export type TruckInventory = typeof truckInventory.$inferSelect;
export type TruckStockSettings = typeof truckStockSettings.$inferSelect;
export type TruckStockRecommendation = typeof truckStockRecommendations.$inferSelect;
export type TruckStockCallback = typeof truckStockCallbacks.$inferSelect;
