-- US-SUPER-006: Tech knowledge graph RAG — ticket embeddings sidecar + settings.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_service_knowledge.sql

CREATE TABLE IF NOT EXISTS "service_ticket_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"machine_model" varchar,
	"error_codes" varchar(500),
	"content" varchar(8000),
	"content_hash" varchar,
	"embedding" jsonb,
	"embedding_source" varchar(16) NOT NULL DEFAULT 'fallback',
	"embedded_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "service_ticket_embeddings_tenant_idx" ON "service_ticket_embeddings" USING btree ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "service_ticket_embeddings_tenant_ticket_uq" ON "service_ticket_embeddings" USING btree ("tenant_id","ticket_id");
CREATE INDEX IF NOT EXISTS "service_ticket_embeddings_tenant_model_idx" ON "service_ticket_embeddings" USING btree ("tenant_id","machine_model");

CREATE TABLE IF NOT EXISTS "service_knowledge_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"federated_opt_in" jsonb,
	"updated_by_user_id" varchar,
	"updated_at" timestamp NOT NULL DEFAULT now()
);

-- Production similarity path: enable pgvector and add a real vector column +
-- ivfflat index alongside the jsonb mirror. Guarded so v1 (jsonb + JS cosine)
-- works even where the extension isn't available.
DO $$
BEGIN
	CREATE EXTENSION IF NOT EXISTS vector;
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'service_ticket_embeddings' AND column_name = 'embedding_vec'
	) THEN
		ALTER TABLE "service_ticket_embeddings" ADD COLUMN "embedding_vec" vector(1536);
		-- ivfflat needs rows to train; create lazily in ops once backfilled:
		--   CREATE INDEX service_ticket_embeddings_vec_idx ON service_ticket_embeddings
		--     USING ivfflat (embedding_vec vector_cosine_ops) WITH (lists = 100);
	END IF;
EXCEPTION WHEN others THEN
	-- pgvector unavailable in this environment; v1 uses the jsonb embedding + JS cosine.
	NULL;
END $$;
