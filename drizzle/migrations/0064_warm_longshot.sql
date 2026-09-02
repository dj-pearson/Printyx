-- QUOTE-017's recurring-line columns, which no database has ever had.
--
-- 0000 created discount, is_recurring, recurring_frequency and recurring_duration
-- on proposal_line_items; 0002 dropped all four; 0047 restored `discount` by hand
-- when the quote builder started writing it. The three recurring columns were
-- never restored, so every recurring line the builder sent hit a column that does
-- not exist. The proposals edge function catches that PGRST204 and retries with
-- CORE_LINE_ITEM_COLUMNS only, which persisted a monthly charge as a one-time
-- amount and logged a warning - the line saved, its recurrence did not.
--
-- Written in the 0046/0047 idiom rather than left as drizzle-kit emitted it:
-- ADD COLUMN IF NOT EXISTS, guarded by a table check. `discount` is here because
-- the declaration in shared/schema.ts had lost it too, so drizzle-kit's snapshot
-- did not know it existed and the next generate would have emitted a DROP - but
-- real databases DO have it, courtesy of 0047, so a plain ADD would fail.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'proposal_line_items'
  ) THEN
    ALTER TABLE "proposal_line_items"
      ADD COLUMN IF NOT EXISTS "discount" numeric DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "is_recurring" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "recurring_frequency" varchar,
      ADD COLUMN IF NOT EXISTS "recurring_duration" integer;
  END IF;
END $$;
