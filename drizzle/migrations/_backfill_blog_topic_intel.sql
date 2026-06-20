-- US-BLOG-017/019/020/022/025/026: Blog Topic Intelligence.
-- Community question mining, pillar-cluster overlay, keyword/post embeddings,
-- internal-link suggestions, cluster authority scores, citation-source overlay,
-- and readability snapshots.
--
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_topic_intel.sql
--
-- All embedding columns are jsonb float arrays for now. TODO(pgvector): once the
-- `vector` extension is enabled, migrate `embedding` columns to `vector(N)` with
-- an ivfflat/hnsw index and move cosine-similarity into SQL.

-- ---------------------------------------------------------------------------
-- US-BLOG-017 — community seeds + mined questions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_community_seeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"subreddits" jsonb,
	"quora_topics" jsonb,
	"stackexchange_sites" jsonb,
	"target_config" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_community_seeds_tenant_idx"
	ON "blog_community_seeds" USING btree ("tenant_id");

CREATE TABLE IF NOT EXISTS "blog_community_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source" varchar(20) NOT NULL,
	"source_context" varchar(255),
	"url" text,
	"title" text NOT NULL,
	"score" integer,
	"top_answer_snippet" text,
	"theme" varchar(255),
	"cluster_id" uuid REFERENCES "blog_keyword_clusters"("id") ON DELETE SET NULL,
	"captured_at" timestamp NOT NULL DEFAULT now(),
	"raw_data" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_community_questions_tenant_idx"
	ON "blog_community_questions" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_community_questions_tenant_theme_idx"
	ON "blog_community_questions" USING btree ("tenant_id","theme");
CREATE INDEX IF NOT EXISTS "blog_community_questions_tenant_source_idx"
	ON "blog_community_questions" USING btree ("tenant_id","source");

-- ---------------------------------------------------------------------------
-- US-BLOG-019 — pillar-cluster overlay + keyword embeddings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_cluster_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cluster_id" uuid NOT NULL REFERENCES "blog_keyword_clusters"("id") ON DELETE CASCADE,
	"name" varchar(200),
	"pillar_keyword" varchar(500),
	"supporting_keywords" jsonb,
	"status" varchar(16) NOT NULL DEFAULT 'planned',
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_cluster_extensions_tenant_idx"
	ON "blog_cluster_extensions" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_cluster_extensions_tenant_cluster_idx"
	ON "blog_cluster_extensions" USING btree ("tenant_id","cluster_id");

CREATE TABLE IF NOT EXISTS "blog_keyword_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"keyword_id" uuid NOT NULL REFERENCES "blog_keywords"("id") ON DELETE CASCADE,
	"embedding_model" varchar(64),
	-- TODO(pgvector): change to `vector(N)` + ivfflat index when pgvector is enabled.
	"embedding" jsonb,
	"dims" integer,
	"source_text" text,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_keyword_embeddings_tenant_idx"
	ON "blog_keyword_embeddings" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_keyword_embeddings_tenant_keyword_idx"
	ON "blog_keyword_embeddings" USING btree ("tenant_id","keyword_id");

-- ---------------------------------------------------------------------------
-- US-BLOG-020 — post embeddings + internal-link suggestions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_post_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"embedding_model" varchar(64),
	-- TODO(pgvector): change to `vector(N)` + hnsw index when pgvector is enabled.
	"embedding" jsonb,
	"dims" integer,
	"primary_keyword" varchar(500),
	"content_hash" varchar(128),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_post_embeddings_tenant_idx"
	ON "blog_post_embeddings" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_post_embeddings_tenant_post_idx"
	ON "blog_post_embeddings" USING btree ("tenant_id","post_id");

CREATE TABLE IF NOT EXISTS "blog_internal_link_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"target_post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"anchor_text" text,
	"similarity" numeric(6, 5),
	"insert_meta" jsonb,
	"status" varchar(16) NOT NULL DEFAULT 'suggested',
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_internal_link_suggestions_tenant_idx"
	ON "blog_internal_link_suggestions" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_internal_link_suggestions_tenant_source_idx"
	ON "blog_internal_link_suggestions" USING btree ("tenant_id","source_post_id");
CREATE INDEX IF NOT EXISTS "blog_internal_link_suggestions_tenant_target_idx"
	ON "blog_internal_link_suggestions" USING btree ("tenant_id","target_post_id");

-- ---------------------------------------------------------------------------
-- US-BLOG-022 — per-cluster authority score time series
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_cluster_authority_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cluster_id" uuid NOT NULL REFERENCES "blog_keyword_clusters"("id") ON DELETE CASCADE,
	"score" numeric(5, 2) NOT NULL,
	"breakdown" jsonb,
	"computed_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_cluster_authority_scores_tenant_idx"
	ON "blog_cluster_authority_scores" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_cluster_authority_scores_tenant_cluster_computed_idx"
	ON "blog_cluster_authority_scores" USING btree ("tenant_id","cluster_id","computed_at");

-- ---------------------------------------------------------------------------
-- US-BLOG-025 — OG/excerpt/order overlay on blog_citations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_citation_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"citation_id" uuid NOT NULL REFERENCES "blog_citations"("id") ON DELETE CASCADE,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"og_image_url" text,
	"excerpt" text,
	"display_order" integer,
	"fetch_adapter" varchar(64),
	"fetched_at" timestamp,
	"raw_data" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_citation_sources_tenant_idx"
	ON "blog_citation_sources" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_citation_sources_tenant_citation_idx"
	ON "blog_citation_sources" USING btree ("tenant_id","citation_id");
CREATE INDEX IF NOT EXISTS "blog_citation_sources_tenant_post_idx"
	ON "blog_citation_sources" USING btree ("tenant_id","post_id");

-- ---------------------------------------------------------------------------
-- US-BLOG-026 — latest readability + persona snapshot per post
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_readability_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"flesch_kincaid_grade" numeric(5, 2),
	"target_grade" numeric(5, 2),
	"persona_match_score" integer,
	"analysis" jsonb,
	"computed_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_readability_snapshots_tenant_idx"
	ON "blog_readability_snapshots" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_readability_snapshots_tenant_post_idx"
	ON "blog_readability_snapshots" USING btree ("tenant_id","post_id");
