-- CRMX-004: add custom_fields jsonb to the canonical CRM objects so user-defined
-- field values (validated against custom_field_definitions) have a home.
--   deals            → objectType 'deals'
--   business_records → objectTypes 'leads' and 'companies' (the account of record)
--   company_contacts → objectType 'contacts'
--
-- Hand-authored + idempotent (drizzle-kit snapshot in this tree is stale; see 0021).
-- NOT auto-applied; run via db:migrate.

ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb;
--> statement-breakpoint
ALTER TABLE "business_records" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb;
--> statement-breakpoint
ALTER TABLE "company_contacts" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb;
