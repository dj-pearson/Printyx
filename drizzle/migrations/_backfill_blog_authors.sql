-- US-BLOG-028: credentialed authors (E-E-A-T) + per-post research signal / reviewer.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_authors.sql

CREATE TABLE IF NOT EXISTS "blog_authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"bio" text,
	"headshot_asset_id" uuid REFERENCES "blog_assets"("id") ON DELETE SET NULL,
	"headshot_url" text,
	"credentials" text,
	"job_title" varchar(200),
	"expertise_tags" text[],
	"social_links" jsonb,
	"schema_person" jsonb,
	"user_id" varchar,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_authors_tenant_idx" ON "blog_authors" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_authors_tenant_slug_idx" ON "blog_authors" USING btree ("tenant_id","slug");

ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "author_id" uuid;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "reviewed_by_author_id" uuid;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "original_research_signal" varchar(20);
