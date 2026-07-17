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
--
-- DRIFT REPAIR: this column is declared in shared/schema.ts and created by 0000, but
-- it is ABSENT from the live database (indexing it raised 42703 undefined_column).
-- 0000 has never actually executed here — it is a from-scratch baseline whose 498
-- CREATE TABLEs carry no IF NOT EXISTS, so it aborts on the first already-existing
-- table and rolls back whole. The live schema came from db:push at an older revision.
-- Adding the column here keeps this file self-contained and idempotent, matching the
-- db:push-managed-database contract stated in the header above. Nullable varchar, per
-- shared/schema.ts, so this is a metadata-only ALTER (no table rewrite).
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "external_customer_id" varchar;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_external_customer_idx" ON "invoices" USING btree ("external_customer_id");--> statement-breakpoint

-- audit_logs had NO indexes at all despite being append-heavy and read newest-first.
-- Both of these columns exist on the live table, so this one applies cleanly.
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_timestamp_idx" ON "audit_logs" USING btree ("tenant_id","timestamp");--> statement-breakpoint

-- REMOVED: audit_logs(tenant_id, resource, resource_id).
--
-- The live audit_logs is a DIFFERENT TABLE from the one shared/security-schema.ts
-- declares — not merely an older revision of it. Live has (id, user_id, action,
-- table_name, record_id, old_values, new_values, timestamp, ip_address, user_agent,
-- tenant_id), all varchar/nullable. The Drizzle definition expects resource /
-- resource_id / session_id / severity / category / request_id / parent_action_id /
-- additional_context, with uuid keys and several NOT NULL. `resource` therefore does
-- not exist (indexing it raised 42703) and its live counterpart is `table_name`.
--
-- NOT fixed by ADD COLUMN: that would leave a table matching neither definition, and
-- would not repair the callers — server/security-compliance.ts:111 inserts severity/
-- category, and routes-security-{compliance,dashboard}.ts group by them, so the whole
-- Drizzle-auditLogs code path is broken against this database regardless of indexes.
-- Reconciling the two shapes needs a data migration (rename table_name -> resource,
-- record_id -> resource_id, backfill the NOT NULL enums, varchar -> uuid casts that
-- can fail on non-uuid data). That is its own story, not a line in a perf migration.
--
-- Deliberately NOT re-pointed at (tenant_id, table_name, record_id) either: no code
-- queries those columns today, so such an index would carry write cost for no read.
-- Add the index as part of the reconciliation, once callers and table agree.

-- AP/AR aging views filter by tenant + status and sort by due date.
CREATE INDEX IF NOT EXISTS "accounts_payable_tenant_status_due_idx" ON "accounts_payable" USING btree ("tenant_id","status","due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_receivable_tenant_status_due_idx" ON "accounts_receivable" USING btree ("tenant_id","status","due_date");--> statement-breakpoint

-- Activity timeline reads by record (newest first); tenant index backs the feed.
CREATE INDEX IF NOT EXISTS "business_record_activities_record_created_idx" ON "business_record_activities" USING btree ("business_record_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_record_activities_tenant_idx" ON "business_record_activities" USING btree ("tenant_id");--> statement-breakpoint

-- Every tenant-scoped user lookup/list scans by tenant_id.
CREATE INDEX IF NOT EXISTS "users_tenant_idx" ON "users" USING btree ("tenant_id");
