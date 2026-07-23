-- PA-042: persist the raw parsed CSV rows on the validation record so the
-- execute step can insert them without the client re-sending the file.
ALTER TABLE "data_import_validations"
	ADD COLUMN IF NOT EXISTS "raw_rows" jsonb;
