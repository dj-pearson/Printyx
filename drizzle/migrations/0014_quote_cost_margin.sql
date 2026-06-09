-- QUOTE-002 / QUOTE-003: make the quote flow cost- and margin-aware.
--
-- Idempotent + tolerant of schema drift. The live product_models / proposals /
-- proposal_line_items tables predate parts of the Drizzle schema, so we guard
-- every ALTER with table-existence checks and ADD COLUMN IF NOT EXISTS.

-- product_models: dealer (hard) cost per pricing tier. Drizzle already declares
-- these; this guarantees they exist on the live table so quotes have a cost source.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_models'
  ) THEN
    ALTER TABLE "product_models"
      ADD COLUMN IF NOT EXISTS "new_dealer_cost" numeric(10, 2),
      ADD COLUMN IF NOT EXISTS "upgrade_dealer_cost" numeric(10, 2),
      ADD COLUMN IF NOT EXISTS "lexmark_dealer_cost" numeric(10, 2);
  END IF;
END $$;

-- proposal_line_items: per-line notes (the UI edit dialog already collects this,
-- but there was no column, which silently broke the whole line-item insert).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'proposal_line_items'
  ) THEN
    ALTER TABLE "proposal_line_items"
      ADD COLUMN IF NOT EXISTS "notes" text;
  END IF;
END $$;

-- proposals: rolled-up cost + margin so the manager view and reports do not have
-- to recompute from line items.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'proposals'
  ) THEN
    ALTER TABLE "proposals"
      ADD COLUMN IF NOT EXISTS "total_dealer_cost" numeric(10, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "total_margin_percentage" numeric(5, 2) DEFAULT '0';
  END IF;
END $$;
