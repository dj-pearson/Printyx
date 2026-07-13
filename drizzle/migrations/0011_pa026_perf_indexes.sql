-- PA-026: add composite (tenant_id, ...) and FK indexes to core tables that had
-- ZERO indexes despite tenant_id NOT NULL, so tenant-scoped list queries stop
-- sequentially scanning every tenant's rows. IF NOT EXISTS makes this safe to
-- (re)apply against the existing db:push-managed database.
CREATE INDEX IF NOT EXISTS "contracts_tenant_customer_idx" ON "contracts" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_tenant_status_idx" ON "contracts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_tenant_status_idx" ON "proposals" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_tenant_created_idx" ON "proposals" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_line_items_proposal_idx" ON "proposal_line_items" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_line_items_tenant_idx" ON "proposal_line_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_tenant_customer_idx" ON "quotes" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_tenant_status_idx" ON "quotes" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_tenant_status_idx" ON "tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_line_items_invoice_idx" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_line_items_tenant_idx" ON "invoice_line_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_tenant_account_idx" ON "opportunities" USING btree ("tenant_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_tenant_stage_idx" ON "opportunities" USING btree ("tenant_id","stage_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_status_idx" ON "purchase_orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_vendor_idx" ON "purchase_orders" USING btree ("tenant_id","vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_tenant_category_idx" ON "inventory_items" USING btree ("tenant_id","category");
