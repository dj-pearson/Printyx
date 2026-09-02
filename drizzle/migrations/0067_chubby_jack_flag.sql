-- Purchase-order line items get the six columns the function has always written
-- (WF-P-01), and the foreign key its inventory embed needs.
--
-- supabase/functions/purchase-orders/ wrote nineteen references to
-- `purchase_order_line_items`, a relation declared by no schema and no migration.
-- The real table is `purchase_order_items` (created by 0000, reshaped by 0001).
-- Repointing the function at it left six columns with nowhere to go:
-- inventory_item_id, part_number, manufacturer_part_number, unit_of_measure,
-- notes and last_received_date. inventory_item_id is the load-bearing one - the
-- receive path moves stock through it, which is what WF-P-02 builds on.
--
-- The FK is what makes the PostgREST embed
-- `inventory_item:inventory_items(id, name, part_number, manufacturer, unit_cost)`
-- resolve; without it those selects answer PGRST200. It is safe to add here
-- because the column is new and therefore entirely NULL, and inventory_items.id
-- is `varchar PRIMARY KEY`, matching.
--
-- WHAT drizzle-kit EMITTED AND WHY THIS FILE IS SHORTER. The generated version
-- carried eight more statements - proposals.total_dealer_cost,
-- total_margin_percentage, discount_reason, discount_reason_note, share_token,
-- share_expires_at, customer_feedback and proposal_templates.template_content -
-- none of them this change. Every one is already applied by 0042, 0043, 0045 or
-- 0047; they re-appear because the snapshot chain is behind (COP-M00). Shipping
-- them as bare ADD COLUMN would fail on any database that ran those migrations,
-- so they were dropped. The snapshot drizzle-kit wrote alongside this file
-- records them as present, which closes that drift for the next generate.
--
-- Idempotent and table-guarded, in the 0064/0065/0066 idiom, so it is safe on a
-- drifted database.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_order_items'
  ) THEN
    ALTER TABLE "purchase_order_items"
      ADD COLUMN IF NOT EXISTS "inventory_item_id" varchar,
      ADD COLUMN IF NOT EXISTS "part_number" varchar,
      ADD COLUMN IF NOT EXISTS "manufacturer_part_number" varchar,
      ADD COLUMN IF NOT EXISTS "unit_of_measure" varchar DEFAULT 'EA',
      ADD COLUMN IF NOT EXISTS "notes" text,
      ADD COLUMN IF NOT EXISTS "last_received_date" timestamp;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_items'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_order_items'
      AND column_name = 'inventory_item_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'purchase_order_items'
      AND constraint_name = 'purchase_order_items_inventory_item_id_fkey'
  ) THEN
    ALTER TABLE "purchase_order_items"
      ADD CONSTRAINT "purchase_order_items_inventory_item_id_fkey"
      FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id")
      ON DELETE SET NULL;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "purchase_order_items_po_line_idx"
  ON "purchase_order_items" USING btree ("purchase_order_id", "line_number");
