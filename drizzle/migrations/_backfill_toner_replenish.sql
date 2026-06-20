-- US-SUPER-012: Multi-vendor toner auto-replenish — levels + orders + settings.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_toner_replenish.sql

CREATE TABLE IF NOT EXISTS "machine_supply_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"machine_id" varchar NOT NULL,
	"color" varchar(2) NOT NULL,
	"percent_remaining" double precision,
	"page_count_remaining" integer,
	"source" varchar(16) NOT NULL DEFAULT 'injected',
	"captured_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "machine_supply_levels_tenant_idx" ON "machine_supply_levels" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "machine_supply_levels_tenant_machine_color_idx" ON "machine_supply_levels" USING btree ("tenant_id","machine_id","color");
CREATE INDEX IF NOT EXISTS "machine_supply_levels_captured_idx" ON "machine_supply_levels" USING btree ("captured_at");

CREATE TABLE IF NOT EXISTS "supply_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"machine_id" varchar NOT NULL,
	"color" varchar(2),
	"status" varchar(20) NOT NULL DEFAULT 'pending_approval',
	"vendor" varchar,
	"part_number" varchar,
	"supply_name" varchar,
	"quantity" integer NOT NULL DEFAULT 1,
	"unit_cost" numeric(10,2),
	"total_cost" numeric(10,2),
	"predicted_depletion_date" timestamp,
	"trigger_reason" varchar(300),
	"tracking_number" varchar,
	"carrier" varchar,
	"expected_arrival_date" timestamp,
	"customer_notified" boolean NOT NULL DEFAULT false,
	"is_emergency" boolean NOT NULL DEFAULT false,
	"created_by_user_id" varchar,
	"shipped_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "supply_orders_tenant_idx" ON "supply_orders" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "supply_orders_tenant_status_idx" ON "supply_orders" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "supply_orders_tenant_machine_idx" ON "supply_orders" USING btree ("tenant_id","machine_id");

CREATE TABLE IF NOT EXISTS "tenant_supply_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"approval_cost_threshold" double precision NOT NULL DEFAULT 150,
	"default_lead_time_days" integer NOT NULL DEFAULT 5,
	"default_safety_buffer_days" integer NOT NULL DEFAULT 3,
	"updated_by_user_id" varchar,
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "machine_supply_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"machine_id" varchar NOT NULL,
	"auto_ship_enabled" boolean NOT NULL DEFAULT true,
	"cost_ceiling" double precision,
	"emergency_override" boolean NOT NULL DEFAULT false,
	"customer_managed" boolean NOT NULL DEFAULT false,
	"lead_time_days" integer,
	"safety_buffer_days" integer,
	"updated_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "machine_supply_settings_tenant_machine_uq" ON "machine_supply_settings" USING btree ("tenant_id","machine_id");
