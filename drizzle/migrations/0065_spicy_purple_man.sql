-- The purchase-order workflow's audit trail (AUDIT-037).
--
-- supabase/functions/purchase-orders/ has written these eight columns since it
-- shipped and none of them existed, so submit, approve, reject and receive each
-- answered a 42703. They are not new state: the function already implements the
-- whole workflow, and without them a rejection has no reason and a receipt has
-- no receiver.
--
-- Idempotent and table-guarded, in the 0046/0047/0064 idiom, so it is safe on a
-- drifted database.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) THEN
    ALTER TABLE "purchase_orders"
      ADD COLUMN IF NOT EXISTS "submitted_at" timestamp,
      ADD COLUMN IF NOT EXISTS "approval_notes" text,
      ADD COLUMN IF NOT EXISTS "rejected_at" timestamp,
      ADD COLUMN IF NOT EXISTS "rejected_by" varchar,
      ADD COLUMN IF NOT EXISTS "rejection_reason" text,
      ADD COLUMN IF NOT EXISTS "received_by" varchar,
      ADD COLUMN IF NOT EXISTS "last_receipt_date" timestamp,
      ADD COLUMN IF NOT EXISTS "receipt_notes" text;
  END IF;
END $$;
