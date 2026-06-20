-- US-BLOG-029/032/034/035/037/038: in-editor authoring tools — original-data
-- integration + charts, inline AI rewrite, plagiarism/AI-content scans, image &
-- stock media, inline fact-checker, and diagram/chart generation.
--
-- Reuses existing blog tables (blog_assets for images/diagrams, blog_citations
-- for data-source URLs, blog_posts, blog_brand_voices, blog_ai_costs) and adds
-- four new tables. FKs are enforced here (per the blog module convention of
-- keeping FKs out of the Drizzle schema files).
--
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_authoring_tools.sql

-- ---------------------------------------------------------------------------
-- blog_data_assets — datasets behind charts/tables (US-BLOG-029, 038)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_data_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid REFERENCES "blog_posts"("id") ON DELETE SET NULL,
	"name" varchar(300) NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"source_ref" text,
	"columns" jsonb,
	"rows" jsonb,
	"row_count" integer,
	"encrypted_config" jsonb,
	"citation_id" uuid REFERENCES "blog_citations"("id") ON DELETE SET NULL,
	"refreshed_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_data_assets_tenant_idx"
	ON "blog_data_assets" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_data_assets_tenant_post_idx"
	ON "blog_data_assets" USING btree ("tenant_id","post_id");

-- ---------------------------------------------------------------------------
-- blog_chart_specs — persisted chart/diagram specs (US-BLOG-029, 038)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_chart_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid REFERENCES "blog_posts"("id") ON DELETE SET NULL,
	"data_asset_id" uuid REFERENCES "blog_data_assets"("id") ON DELETE SET NULL,
	"chart_type" varchar(20) NOT NULL,
	"title" varchar(500),
	"spec" jsonb,
	"source" jsonb,
	"description" text,
	"alt_text" text,
	"asset_id" uuid REFERENCES "blog_assets"("id") ON DELETE SET NULL,
	"png_ref" varchar(1000),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_chart_specs_tenant_idx"
	ON "blog_chart_specs" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_chart_specs_tenant_post_idx"
	ON "blog_chart_specs" USING btree ("tenant_id","post_id");
CREATE INDEX IF NOT EXISTS "blog_chart_specs_data_asset_idx"
	ON "blog_chart_specs" USING btree ("data_asset_id");

-- ---------------------------------------------------------------------------
-- blog_content_scans — plagiarism + AI-detection results (US-BLOG-034)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_content_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"scan_type" varchar(20) NOT NULL,
	"provider" varchar(40),
	"score" integer,
	"matches" jsonb,
	"threshold_pct" integer,
	"passed" boolean,
	"cost_cents" integer NOT NULL DEFAULT 0,
	"created_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_content_scans_tenant_idx"
	ON "blog_content_scans" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_content_scans_post_idx"
	ON "blog_content_scans" USING btree ("post_id");
CREATE INDEX IF NOT EXISTS "blog_content_scans_tenant_type_idx"
	ON "blog_content_scans" USING btree ("tenant_id","scan_type");

-- ---------------------------------------------------------------------------
-- blog_factcheck_runs — claim-extraction + verification jobs (US-BLOG-037)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_factcheck_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"status" varchar(16) NOT NULL DEFAULT 'queued',
	"claims" jsonb,
	"claim_count" integer,
	"flagged_count" integer,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_factcheck_runs_tenant_idx"
	ON "blog_factcheck_runs" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_factcheck_runs_post_idx"
	ON "blog_factcheck_runs" USING btree ("post_id");
CREATE INDEX IF NOT EXISTS "blog_factcheck_runs_tenant_status_idx"
	ON "blog_factcheck_runs" USING btree ("tenant_id","status");
