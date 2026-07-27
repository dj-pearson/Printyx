-- CRMX-005: map canonical pipeline_stages back to legacy deal_stages so the
-- deal board can source stage CONFIG (probability/SLA/automation/forecast) from
-- pipeline_stages while keeping deal.stage_id (a deal_stages.id) as the identity —
-- no deal-row migration, no orphaning.
-- Hand-authored + idempotent (drizzle-kit snapshot in this tree is stale; see 0021).
-- NOT auto-applied; run via db:migrate.

ALTER TABLE "pipeline_stages" ADD COLUMN IF NOT EXISTS "legacy_stage_id" varchar;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pipeline_stages_tenant_legacy_idx"
  ON "pipeline_stages" ("tenant_id","legacy_stage_id");
