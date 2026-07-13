-- CR-028: add tenant-scoped list/filter indexes to equipment and invoices,
-- which previously had NO indexes at all (full table scans on every
-- tenant/customer/status query). IF NOT EXISTS makes this safe to (re)apply
-- against the existing db:push-managed database.
CREATE INDEX IF NOT EXISTS "equipment_tenant_customer_idx" ON "equipment" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_tenant_status_idx" ON "equipment" USING btree ("tenant_id","equipment_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_tenant_customer_idx" ON "invoices" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_tenant_status_idx" ON "invoices" USING btree ("tenant_id","invoice_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_tenant_created_idx" ON "invoices" USING btree ("tenant_id","created_at");
