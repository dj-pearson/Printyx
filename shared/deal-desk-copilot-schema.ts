/**
 * Deal Desk Copilot Schema (US-SUPER-008).
 *
 * The copilot itself reads existing data (proposals, proposal_line_items,
 * service_tickets, invoices, business_records, customer_churn_scores); the only
 * net-new persistence is a tiny per-tenant settings row holding the GP floor
 * used by the live-margin panel's threshold warning.
 *
 * Re-exported from shared/schema.ts.
 * TODO(rbac): viewing margin requires requirePermission(['sales.quote.view_margin'])
 * (default MANAGER + OWNER) once that permission exists; until then the route
 * uses requireAuth + tenant scoping.
 */

import { doublePrecision, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// deal_desk_copilot_settings — per-tenant GP floor for the margin warning
// ---------------------------------------------------------------------------
export const dealDeskCopilotSettings = pgTable('deal_desk_copilot_settings', {
  tenantId: varchar('tenant_id').primaryKey(),
  /** Live-margin panel warns when quote GP% drops below this floor (percent). */
  gpFloorPct: doublePrecision('gp_floor_pct').notNull().default(30),
  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type DealDeskCopilotSettings = typeof dealDeskCopilotSettings.$inferSelect;
export type NewDealDeskCopilotSettings = typeof dealDeskCopilotSettings.$inferInsert;
