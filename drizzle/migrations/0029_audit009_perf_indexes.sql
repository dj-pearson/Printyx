-- AUDIT-009: composite indexes for the remaining hot multi-tenant read paths.
--
-- Hand-authored, following the 0010_cr028_perf_indexes / 0011_pa026_perf_indexes
-- precedent. `npm run db:generate` CANNOT be used here: drizzle's snapshots stop at
-- 0009 while migrations on disk run to 0028, so generate diffs the schema against a
-- 20-migration-old snapshot and emits a ~2.2k-line migration that recreates 114
-- tables (and renumbers to 0012, colliding with the existing 0012_auto_orders.sql).
-- See the AUDIT-009 notes in prd.json.
--
-- IF NOT EXISTS keeps this safe to (re)apply against the existing db:push-managed
-- database, matching 0010/0011.
--
-- Scope note: equipment, contracts, invoices(tenant_id,*) and inventory_items were
-- ALREADY covered by CR-028/PA-026 and are deliberately absent here rather than
-- duplicated. inventory_items(tenant_id) is served by the existing
-- (tenant_id, category) index via the leftmost-prefix rule.
--
-- Sort direction: plain btree (ASC). PostgreSQL scans a btree backwards at the same
-- cost, so a DESC index only matters for MIXED-direction multi-column sorts, which
-- none of these queries do. This also matches the existing *_created_idx convention.

-- proposals is the live quotes table (proposal_type='quote'); callers filter by
-- type BEFORE status, which the existing (tenant_id, status) index cannot serve.
CREATE INDEX IF NOT EXISTS "proposals_tenant_type_status_idx" ON "proposals" USING btree ("tenant_id","proposal_type","status");--> statement-breakpoint

-- QUOTE-020 makes line_number the ordering source of truth and every read path
-- orders by it. The composite also covers proposal_id-only lookups (leftmost
-- prefix), so the narrower PA-026 index is dropped rather than left redundant.
CREATE INDEX IF NOT EXISTS "proposal_line_items_proposal_line_idx" ON "proposal_line_items" USING btree ("proposal_id","line_number");--> statement-breakpoint
DROP INDEX IF EXISTS "proposal_line_items_proposal_idx";--> statement-breakpoint

-- external_customer_id doubles as the service-ticket reference and backs the
-- ?ticketId= filter on GET /billing/invoices; it is queried without a tenant prefix.
CREATE INDEX IF NOT EXISTS "invoices_external_customer_idx" ON "invoices" USING btree ("external_customer_id");--> statement-breakpoint

-- audit_logs had NO indexes at all despite being append-heavy and read newest-first.
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_timestamp_idx" ON "audit_logs" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_resource_idx" ON "audit_logs" USING btree ("tenant_id","resource","resource_id");--> statement-breakpoint

-- AP/AR aging views filter by tenant + status and sort by due date.
CREATE INDEX IF NOT EXISTS "accounts_payable_tenant_status_due_idx" ON "accounts_payable" USING btree ("tenant_id","status","due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_receivable_tenant_status_due_idx" ON "accounts_receivable" USING btree ("tenant_id","status","due_date");--> statement-breakpoint

-- Activity timeline reads by record (newest first); tenant index backs the feed.
CREATE INDEX IF NOT EXISTS "business_record_activities_record_created_idx" ON "business_record_activities" USING btree ("business_record_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_record_activities_tenant_idx" ON "business_record_activities" USING btree ("tenant_id");--> statement-breakpoint

-- Every tenant-scoped user lookup/list scans by tenant_id.
CREATE INDEX IF NOT EXISTS "users_tenant_idx" ON "users" USING btree ("tenant_id");
