-- CRMX-008: real workflow execution runtime. Two additions to workflow_executions
-- so the runtime is idempotent (no double-fire on the same trigger event) and its
-- delays are durable (survive a restart, resumed by the sweeper):
--   * dedupe_key  — caller token unique per (tenant, workflow); NULL for manual runs.
--   * resume_at   — when a paused (wait_delay) execution may be resumed.
-- Hand-authored + idempotent (drizzle-kit snapshot in this tree is stale; see 0021/0024).
-- NOT auto-applied; run via db:migrate.

ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "dedupe_key" varchar;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "resume_at" timestamp;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_executions_dedupe_unique"
  ON "workflow_executions" ("tenant_id","workflow_id","dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_executions_resume_at_idx"
  ON "workflow_executions" ("resume_at")
  WHERE "resume_at" IS NOT NULL;
