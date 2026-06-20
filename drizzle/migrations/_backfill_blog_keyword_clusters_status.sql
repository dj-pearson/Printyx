-- US-BLOG-019: pillar-cluster lifecycle status for the cluster visualizer.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_keyword_clusters_status.sql

ALTER TABLE "blog_keyword_clusters"
	ADD COLUMN IF NOT EXISTS "status" varchar(16) DEFAULT 'planned';
