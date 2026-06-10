-- Align proposal_line_items with what the quote builder actually sends, so
-- line-item inserts can't silently fail on a missing column (PGRST204) and drop
-- the whole line item. The builder sends product_code, notes and a server-computed
-- per-line margin; only `notes` was previously covered (0014), and only if that
-- migration was applied.
--
-- Idempotent + drift-tolerant: ADD COLUMN IF NOT EXISTS, guarded by a table check.
-- Safe to run regardless of whether 0014 already landed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'proposal_line_items'
  ) THEN
    ALTER TABLE "proposal_line_items"
      ADD COLUMN IF NOT EXISTS "product_code" varchar,
      ADD COLUMN IF NOT EXISTS "notes" text,
      ADD COLUMN IF NOT EXISTS "margin" numeric;
  END IF;
END $$;
