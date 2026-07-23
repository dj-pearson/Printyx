-- CR-029: trigram GIN indexes for the columns universal search filters with a
-- leading-wildcard ILIKE (%term%). pg_trgm's gin_trgm_ops turns those otherwise
-- unindexable %...% scans into index lookups.
--
-- 0026_search_trgm_indexes already covers business_records.company_name /
-- primary_contact_name / primary_contact_email and deals.title (which is what
-- the drizzle field deals.name maps to). This adds the remaining searched
-- columns. business_record_activities is intentionally omitted: the search there
-- references phantom title/notes fields (the real columns are subject/description)
-- so it already degrades to no rows — indexing it would be indexing a query that
-- does not run.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_records_primary_contact_phone_trgm"
  ON "business_records" USING gin ("primary_contact_phone" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_quote_number_trgm"
  ON "quotes" USING gin ("quote_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_invoice_number_trgm"
  ON "invoices" USING gin ("invoice_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_po_number_trgm"
  ON "invoices" USING gin ("po_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_serial_number_trgm"
  ON "equipment" USING gin ("serial_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_model_number_trgm"
  ON "equipment" USING gin ("model_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_manufacturer_trgm"
  ON "equipment" USING gin ("manufacturer" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_description_trgm"
  ON "equipment" USING gin ("description" gin_trgm_ops);
