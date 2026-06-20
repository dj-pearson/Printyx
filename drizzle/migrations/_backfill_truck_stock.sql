-- US-SUPER-007: Predictive truck-stocking optimizer — inventory + settings + recs + callbacks.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_truck_stock.sql

CREATE TABLE IF NOT EXISTS "truck_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tech_user_id" varchar NOT NULL,
	"part_sku" varchar NOT NULL,
	"quantity_on_truck" integer NOT NULL DEFAULT 0,
	"capacity_constraint" integer,
	"last_audited_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "truck_inventory_tenant_idx" ON "truck_inventory" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "truck_inventory_tenant_tech_idx" ON "truck_inventory" USING btree ("tenant_id","tech_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "truck_inventory_tenant_tech_sku_uq" ON "truck_inventory" USING btree ("tenant_id","tech_user_id","part_sku");

CREATE TABLE IF NOT EXISTS "truck_stock_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tech_user_id" varchar NOT NULL,
	"max_total_quantity" integer NOT NULL DEFAULT 120,
	"max_distinct_skus" integer NOT NULL DEFAULT 40,
	"updated_by_user_id" varchar,
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "truck_stock_settings_tenant_tech_uq" ON "truck_stock_settings" USING btree ("tenant_id","tech_user_id");

CREATE TABLE IF NOT EXISTS "truck_stock_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tech_user_id" varchar NOT NULL,
	"generated_at" timestamp NOT NULL DEFAULT now(),
	"current_fill_rate" double precision NOT NULL DEFAULT 0,
	"projected_fill_rate" double precision NOT NULL DEFAULT 0,
	"capacity_total" integer,
	"capacity_distinct" integer,
	"recommended_items" jsonb,
	"status" varchar(16) NOT NULL DEFAULT 'draft',
	"picked_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "truck_stock_recs_tenant_idx" ON "truck_stock_recommendations" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "truck_stock_recs_tenant_tech_idx" ON "truck_stock_recommendations" USING btree ("tenant_id","tech_user_id");
CREATE INDEX IF NOT EXISTS "truck_stock_recs_tenant_status_idx" ON "truck_stock_recommendations" USING btree ("tenant_id","status");

CREATE TABLE IF NOT EXISTS "truck_stock_callbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tech_user_id" varchar,
	"ticket_id" varchar,
	"missing_part_sku" varchar,
	"note" varchar,
	"unit_cost" numeric(10,4),
	"created_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "truck_stock_callbacks_tenant_idx" ON "truck_stock_callbacks" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "truck_stock_callbacks_tenant_tech_idx" ON "truck_stock_callbacks" USING btree ("tenant_id","tech_user_id");
