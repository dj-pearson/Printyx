-- US-BLOG-072: audience-specific variants of one master post.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_post_variants.sql

CREATE TABLE IF NOT EXISTS "blog_post_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"audience_key" varchar(64) NOT NULL,
	"audience_label" varchar(200),
	"intro" text,
	"examples" jsonb,
	"cta" jsonb,
	"match_rules" jsonb,
	"is_default" boolean NOT NULL DEFAULT false,
	"served_count" integer NOT NULL DEFAULT 0,
	"conversion_count" integer NOT NULL DEFAULT 0,
	"status" varchar(16) NOT NULL DEFAULT 'active',
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_post_variants_tenant_idx" ON "blog_post_variants" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_post_variants_post_idx" ON "blog_post_variants" USING btree ("post_id");
CREATE INDEX IF NOT EXISTS "blog_post_variants_post_audience_idx" ON "blog_post_variants" USING btree ("post_id","audience_key");
