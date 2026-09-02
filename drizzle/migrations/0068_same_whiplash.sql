-- A purchase order knows what it is FOR (WF-P-03).
--
-- purchase_orders carried its vendor and its status and nothing about the sale
-- that caused it. The Book Order item on contracts.tsx has been navigating to
-- /purchase-orders?contractId=<id> all along, and the PO page rendered that id as
-- a blue hint above the form and never sent it, so the link between a signed
-- contract and the equipment ordered to fulfil it existed only in the URL bar.
--
-- All three columns are nullable on purpose: a stock-replenishment PO (the
-- low-stock suggestion path creates these) has no contract, no deal and no
-- customer, and making any of them required would break that path.
--
-- The foreign keys are what let PostgREST embed the contract on the PO detail
-- rather than the page making a second round trip for a number it already has.
-- Each is guarded on its target table existing, so this is safe on a database
-- that has not got all three.
--
-- Idempotent and table-guarded, in the 0064/0065/0066/0067 idiom.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) THEN
    ALTER TABLE "purchase_orders"
      ADD COLUMN IF NOT EXISTS "source_contract_id" varchar,
      ADD COLUMN IF NOT EXISTS "source_deal_id" varchar,
      ADD COLUMN IF NOT EXISTS "customer_id" varchar;
  END IF;
END $$;--> statement-breakpoint

DO $$
DECLARE
  link record;
BEGIN
  FOR link IN
    SELECT * FROM (VALUES
      ('source_contract_id', 'contracts',         'purchase_orders_source_contract_id_fkey'),
      ('source_deal_id',     'deals',             'purchase_orders_source_deal_id_fkey'),
      ('customer_id',        'business_records',  'purchase_orders_customer_id_fkey')
    ) AS t(col, target, constraint_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = link.target
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'purchase_orders'
        AND column_name = link.col
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'purchase_orders'
        AND constraint_name = link.constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE "purchase_orders" ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I("id") ON DELETE SET NULL',
        link.constraint_name, link.col, link.target
      );
    END IF;
  END LOOP;
END $$;--> statement-breakpoint

-- The Needs Ordering queue (WF-P-04) asks "which contracts have no PO", and the
-- contract detail asks the same question one row at a time.
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_source_contract_idx"
  ON "purchase_orders" USING btree ("tenant_id", "source_contract_id");
