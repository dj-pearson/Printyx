-- US-BLOG-022: topical authority scorer — daily history per cluster.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_cluster_authority_snapshots.sql
--
-- After creating the table, apply RLS:
--   psql "$DATABASE_URL" -f drizzle/rls/blog.sql

CREATE TABLE IF NOT EXISTS "blog_cluster_authority_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cluster_id" uuid NOT NULL REFERENCES "blog_keyword_clusters"("id") ON DELETE CASCADE,
	"snapshot_date" date NOT NULL,
	"authority_score" numeric(5, 2) NOT NULL,
	"competitor_score" numeric(5, 2),
	"components" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_cluster_authority_snapshots_tenant_idx"
	ON "blog_cluster_authority_snapshots" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_cluster_authority_snapshots_cluster_date_idx"
	ON "blog_cluster_authority_snapshots" USING btree ("cluster_id","snapshot_date");
