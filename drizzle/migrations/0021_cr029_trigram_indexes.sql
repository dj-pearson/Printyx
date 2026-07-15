-- CR-029: add pg_trgm GIN indexes for the text columns that universal-search
-- filters with leading-wildcard ILIKE ('%term%'), so those searches can use an
-- index instead of a sequential full scan across every tenant's rows.
--
-- The candidate (table, column) pairs are checked against information_schema
-- first and only indexed when the column actually exists — the universal-search
-- route references a few columns that are not present on every deployment's
-- schema, and this keeps the migration idempotent and non-failing regardless.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
DO $$
DECLARE
  rec RECORD;
  idx_name TEXT;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('business_records','company_name'),
      ('business_records','contact_name'),
      ('business_records','primary_contact_name'),
      ('business_records','email'),
      ('business_records','phone'),
      ('deals','name'),
      ('deals','title'),
      ('business_record_activities','title'),
      ('business_record_activities','subject'),
      ('business_record_activities','notes'),
      ('business_record_activities','description'),
      ('quotes','quote_number'),
      ('invoices','invoice_number'),
      ('invoices','po_number'),
      ('equipment','serial_number'),
      ('equipment','model_number'),
      ('equipment','manufacturer'),
      ('equipment','description')
    ) AS t(tbl, col)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = rec.tbl AND column_name = rec.col
    ) THEN
      idx_name := 'idx_trgm_' || rec.tbl || '_' || rec.col;
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I USING gin (%I gin_trgm_ops)',
        idx_name, rec.tbl, rec.col
      );
    END IF;
  END LOOP;
END $$;
