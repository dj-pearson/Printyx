-- US-BLOG-024: editorial calendar columns on blog_posts.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_posts_calendar.sql

ALTER TABLE "blog_posts"
  ADD COLUMN IF NOT EXISTS "reviewer_user_id" varchar,
  ADD COLUMN IF NOT EXISTS "cluster_id" uuid;

CREATE INDEX IF NOT EXISTS "blog_posts_tenant_assignee_idx" ON "blog_posts" USING btree ("tenant_id","author_user_id");
CREATE INDEX IF NOT EXISTS "blog_posts_tenant_reviewer_idx" ON "blog_posts" USING btree ("tenant_id","reviewer_user_id");
CREATE INDEX IF NOT EXISTS "blog_posts_tenant_cluster_idx" ON "blog_posts" USING btree ("tenant_id","cluster_id");
CREATE INDEX IF NOT EXISTS "blog_posts_tenant_scheduled_for_idx" ON "blog_posts" USING btree ("tenant_id","scheduled_for");
