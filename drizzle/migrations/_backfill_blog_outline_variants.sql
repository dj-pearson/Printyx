-- US-BLOG-030: A/B outline variants scored against the SERP.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_outline_variants.sql

CREATE TABLE IF NOT EXISTS "blog_outline_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"brief_id" uuid REFERENCES "blog_briefs"("id") ON DELETE SET NULL,
	"keyword" varchar(500) NOT NULL,
	"angle" varchar(32),
	"target_intent" varchar(20),
	"outline" jsonb NOT NULL,
	"serp_fit_score" numeric(5,2),
	"differentiation_score" numeric(5,2),
	"scoring_rationale" text,
	"status" varchar(16) NOT NULL DEFAULT 'candidate',
	"ab_test_group" uuid,
	"post_id" uuid,
	"serp_snapshot_id" uuid,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_outline_variants_tenant_idx" ON "blog_outline_variants" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_outline_variants_brief_idx" ON "blog_outline_variants" USING btree ("brief_id");
CREATE INDEX IF NOT EXISTS "blog_outline_variants_tenant_keyword_idx" ON "blog_outline_variants" USING btree ("tenant_id","keyword");
