-- CRMX-013: enable pg_trgm and add GIN trigram indexes backing the ranked
-- global_search() function (drizzle/functions/global-search.sql). Trigram
-- indexes accelerate both the `%` similarity operator and ILIKE substring
-- matches the search relies on.
--
-- Only the Drizzle-schema-verified tables/columns are indexed here — the
-- raw-SQL/drift tables (service_tickets, invoices) are scanned by the function
-- behind exception guards and are indexed separately if/when they are folded
-- into the schema.
--
-- Hand-authored + idempotent (drizzle-kit snapshot in this tree is stale; see
-- 0021/0024/0025). NOT auto-applied; run via db:migrate.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_records_company_name_trgm"
  ON "business_records" USING gin ("company_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_records_primary_contact_name_trgm"
  ON "business_records" USING gin ("primary_contact_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_records_primary_contact_email_trgm"
  ON "business_records" USING gin ("primary_contact_email" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_contacts_first_name_trgm"
  ON "company_contacts" USING gin ("first_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_contacts_last_name_trgm"
  ON "company_contacts" USING gin ("last_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_contacts_email_trgm"
  ON "company_contacts" USING gin ("email" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_title_trgm"
  ON "deals" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_company_name_trgm"
  ON "deals" USING gin ("company_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_title_trgm"
  ON "proposals" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_proposal_number_trgm"
  ON "proposals" USING gin ("proposal_number" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_models_product_name_trgm"
  ON "product_models" USING gin ("product_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_models_product_code_trgm"
  ON "product_models" USING gin ("product_code" gin_trgm_ops);
