-- US-BLOG-018: competitor content gap analysis.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_competitor_gap.sql

-- 1) Per-tenant gap settings live alongside the other blog agent settings.
ALTER TABLE "blog_agent_settings"
  ADD COLUMN IF NOT EXISTS "own_domain" varchar(255),
  ADD COLUMN IF NOT EXISTS "competitor_domains" text[];

-- 2) Per-(tenant, domain, keyword) latest ranking snapshot.
CREATE TABLE IF NOT EXISTS "blog_competitor_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"domain" varchar(255) NOT NULL,
	"is_own" boolean NOT NULL DEFAULT false,
	"keyword" varchar(500) NOT NULL,
	"rank" integer,
	"search_volume" integer,
	"keyword_difficulty" integer,
	"cpc" numeric(10, 2),
	"intent" varchar(20),
	"source_adapter" varchar(32) NOT NULL DEFAULT 'dataforseo',
	"raw_data" jsonb,
	"fetched_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_competitor_keywords_tenant_idx" ON "blog_competitor_keywords" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_competitor_keywords_tenant_domain_idx" ON "blog_competitor_keywords" USING btree ("tenant_id","domain");
CREATE INDEX IF NOT EXISTS "blog_competitor_keywords_tenant_keyword_idx" ON "blog_competitor_keywords" USING btree ("tenant_id","keyword");

-- One row per (tenant, domain, keyword). Each scan replaces existing rows.
CREATE UNIQUE INDEX IF NOT EXISTS "blog_competitor_keywords_tenant_domain_keyword_uq"
  ON "blog_competitor_keywords" ("tenant_id", "domain", "keyword");
