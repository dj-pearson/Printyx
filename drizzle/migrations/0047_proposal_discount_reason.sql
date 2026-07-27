-- QUOTE-016: every discounted quote must carry a recorded justification.
-- discount_reason: competitive_match | volume | promotion | manager_approved | other
-- discount_reason_note: free text (required by the UI when reason = other).
--
-- Idempotent + drift-tolerant: ADD COLUMN IF NOT EXISTS, guarded by a table check.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'proposals'
  ) THEN
    ALTER TABLE "proposals"
      ADD COLUMN IF NOT EXISTS "discount_reason" varchar,
      ADD COLUMN IF NOT EXISTS "discount_reason_note" text;
  END IF;

  -- Per-line discount column ships with the original schema, but guard against
  -- drifted databases that predate it (the quote builder now writes it).
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'proposal_line_items'
  ) THEN
    ALTER TABLE "proposal_line_items"
      ADD COLUMN IF NOT EXISTS "discount" numeric DEFAULT 0;
  END IF;
END $$;
