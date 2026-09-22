/**
 * Fleet assessments (COP-B05).
 *
 * THE COMPUTED RESULT IS STORED, NOT RECOMPUTED ON READ, and that is the whole
 * reason this table exists. An assessment is a document a rep put in front of
 * a customer on a date. Recomputing it later - after a meter lands, after a
 * contract is re-rated - would silently change what was presented, and the
 * customer's copy would stop matching ours. So the snapshot is the record, and
 * a new assessment is a new row.
 *
 * `gaps` travels with the snapshot for the same reason: what could not be
 * costed that day is part of what was said that day.
 */

import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

export const fleetAssessments = pgTable(
  'fleet_assessments',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    /** The deal this was built for (AC5). Null for an account-level study. */
    dealId: varchar('deal_id'),
    /** business_records.id - the account whose fleet was assessed. */
    customerId: varchar('customer_id').notNull(),

    name: varchar('name', { length: 200 }),
    termMonths: integer('term_months').notNull().default(36),

    /** The FleetAssessmentResult as computed. Machines, totals, gaps. */
    currentState: jsonb('current_state').notNull(),
    /** The rep's proposed machines, as entered. */
    proposedFleet: jsonb('proposed_fleet'),
    /** The priced proposal, or its gaps. */
    proposedState: jsonb('proposed_state'),
    /** Monthly, annual and term deltas. */
    comparison: jsonb('comparison'),

    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantDealIdx: index('fleet_assessments_tenant_deal_idx').on(table.tenantId, table.dealId),
    tenantCustomerIdx: index('fleet_assessments_tenant_customer_idx').on(
      table.tenantId,
      table.customerId,
    ),
  }),
);

export type FleetAssessment = typeof fleetAssessments.$inferSelect;
export type NewFleetAssessment = typeof fleetAssessments.$inferInsert;
