CREATE TABLE "deal_ai_summaries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"deal_id" varchar NOT NULL,
	"summary" text NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"source_entry_count" integer,
	"model" varchar(60),
	"total_tokens" integer,
	"generated_by" varchar,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deal_ai_summaries_deal_uq" UNIQUE("tenant_id","deal_id")
);
