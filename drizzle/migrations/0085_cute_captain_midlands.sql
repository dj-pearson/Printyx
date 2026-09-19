CREATE TABLE "competitor_battlecards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb,
	"positioning" text,
	"common_objections" jsonb,
	"where_we_win" text,
	"where_we_lose" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "competitor_battlecards_tenant_slug_uq" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE INDEX "competitor_battlecards_tenant_active_idx" ON "competitor_battlecards" USING btree ("tenant_id","is_active");