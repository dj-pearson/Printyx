-- A bill knows which purchase order it is for (WF-P-02).
--
-- accounts_payable.purchase_order_number is free text and always has been, so
-- nothing could join a payable back to the order that caused it - and nothing
-- created one from a receipt in the first place. Receiving an order now raises the
-- expected bill, which only means anything if the link is real.
--
-- Nullable: a bill for rent, a subscription or a service call has no purchase
-- order, and those are the majority of rows in this table.
--
-- Idempotent and table-guarded, in the 0064/0065/0066/0067/0068 idiom.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounts_payable'
  ) THEN
    ALTER TABLE "accounts_payable"
      ADD COLUMN IF NOT EXISTS "purchase_order_id" varchar;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts_payable'
      AND column_name = 'purchase_order_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'accounts_payable'
      AND constraint_name = 'accounts_payable_purchase_order_id_fkey'
  ) THEN
    ALTER TABLE "accounts_payable"
      ADD CONSTRAINT "accounts_payable_purchase_order_id_fkey"
      FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id")
      ON DELETE SET NULL;
  END IF;
END $$;--> statement-breakpoint

-- Receiving looks this up before every receipt, to avoid raising a second bill on
-- a second partial receipt of the same order.
CREATE INDEX IF NOT EXISTS "accounts_payable_tenant_purchase_order_idx"
  ON "accounts_payable" USING btree ("tenant_id", "purchase_order_id");
