-- WF-P-07: one project model.
--
-- `projects` survives and gains the four things `implementation_projects` had
-- that it needed. The losing table is dropped, but only if it is empty: no
-- reachable code ever wrote to it (no client tree named the prefix, its edge
-- function was in the unreferenced baseline and its Express router had no
-- importer), so it should be, and if some tenant's database says otherwise the
-- rows are kept under a retired name rather than destroyed.
--
-- docs/WF-P-07-project-model-decision.md.

DO $$
DECLARE
  row_count bigint;
BEGIN
  IF to_regclass('public.implementation_projects') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.implementation_projects' INTO row_count;

  IF row_count = 0 THEN
    ALTER TABLE public.implementation_projects DISABLE ROW LEVEL SECURITY;
    DROP TABLE public.implementation_projects CASCADE;
  ELSE
    RAISE NOTICE 'implementation_projects holds % row(s); renaming rather than dropping', row_count;
    ALTER TABLE public.implementation_projects
      RENAME TO implementation_projects_retired_wf_p_07;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "contract_id" varchar;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "handoff_id" varchar;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "project_type" varchar;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "milestones" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_tenant_handoff_idx" ON "projects" USING btree ("tenant_id","handoff_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_tenant_contract_idx" ON "projects" USING btree ("tenant_id","contract_id");
