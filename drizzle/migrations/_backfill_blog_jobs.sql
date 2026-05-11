-- US-BLOG-012: background job queue.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_jobs.sql

CREATE TABLE IF NOT EXISTS "blog_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"type" varchar(64) NOT NULL,
	"payload" jsonb,
	"status" varchar(16) NOT NULL DEFAULT 'queued',
	"priority" integer NOT NULL DEFAULT 50,
	"scheduled_at" timestamp NOT NULL DEFAULT now(),
	"attempts" integer NOT NULL DEFAULT 0,
	"max_attempts" integer NOT NULL DEFAULT 5,
	"last_error" jsonb,
	"result" jsonb,
	"idempotency_key" varchar(200),
	"locked_until" timestamp,
	"locked_by" varchar(200),
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_jobs_tenant_idx" ON "blog_jobs" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_jobs_tenant_status_idx" ON "blog_jobs" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "blog_jobs_run_queue_idx" ON "blog_jobs" USING btree ("status","scheduled_at","priority");

-- (tenant_id, idempotency_key) UNIQUE when non-null — caller dedups by setting
-- idempotency_key to a deterministic value (e.g., 'retention_cleanup:2026-05-11').
-- Using a partial unique index lets multiple rows with NULL keys coexist.
CREATE UNIQUE INDEX IF NOT EXISTS "blog_jobs_tenant_idempotency_uq"
  ON "blog_jobs" ("tenant_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
