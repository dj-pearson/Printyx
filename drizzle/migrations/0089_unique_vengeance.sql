CREATE TABLE "radar_plays" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"play_type" varchar(40) NOT NULL,
	"dedupe_key" varchar(200) NOT NULL,
	"customer_id" varchar,
	"company_name" varchar,
	"equipment_ids" jsonb DEFAULT '[]'::jsonb,
	"contract_id" varchar,
	"reason" text NOT NULL,
	"trigger_date" timestamp,
	"estimated_value" numeric(14, 2),
	"score" integer DEFAULT 0 NOT NULL,
	"score_factors" jsonb,
	"owner_id" varchar,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"deal_id" varchar,
	"dismissed_reason" varchar,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "radar_plays_dedupe_uq" UNIQUE("tenant_id","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "radar_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"lease_window_days" integer DEFAULT 120 NOT NULL,
	"contract_window_days" integer DEFAULT 90 NOT NULL,
	"volume_overage_pct" integer DEFAULT 15 NOT NULL,
	"service_call_threshold" integer DEFAULT 4 NOT NULL,
	"service_lookback_days" integer DEFAULT 180 NOT NULL,
	"color_underuse_pct" integer DEFAULT 5 NOT NULL,
	"meter_silence_days" integer DEFAULT 90 NOT NULL,
	"scan_enabled" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "radar_plays_tenant_status_idx" ON "radar_plays" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "radar_plays_tenant_owner_idx" ON "radar_plays" USING btree ("tenant_id","owner_id");