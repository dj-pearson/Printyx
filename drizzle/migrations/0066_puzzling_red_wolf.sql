-- The rest of the purchase-order lifecycle (AUDIT-037), completing 0065.
--
-- 0065 gave submit, approve, reject and receive their audit columns. Rebinding
-- the create and update handlers to real columns left six more the function has
-- always written and never had: the submitter, the order step and the cancel
-- step with its reason.
--
-- Idempotent and table-guarded, in the 0046/0047/0064/0065 idiom.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) THEN
    ALTER TABLE "purchase_orders"
      ADD COLUMN IF NOT EXISTS "submitted_by" varchar,
      ADD COLUMN IF NOT EXISTS "ordered_at" timestamp,
      ADD COLUMN IF NOT EXISTS "ordered_by" varchar,
      ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp,
      ADD COLUMN IF NOT EXISTS "cancelled_by" varchar,
      ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
  END IF;
END $$;
