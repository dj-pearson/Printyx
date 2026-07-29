-- =============================================================================
-- Contract P&L materialized-view refresh (EDGE-023)
-- =============================================================================
--   public.refresh_contract_pnl_views() -> supabase/functions/contract-pnl/ (POST /refresh)
--
-- WHY THIS EXISTS: the Express handler runs
--   REFRESH MATERIALIZED VIEW contract_pnl_v;
--   REFRESH MATERIALIZED VIEW contract_pnl_monthly_v;
-- PostgREST cannot issue DDL-ish statements, so the edge function has no way to
-- express this except through an RPC. Same arrangement as
-- drizzle/functions/ai-employee-analytics.sql.
--
-- SECURITY DEFINER, unlike its siblings in this directory, and deliberately:
-- REFRESH MATERIALIZED VIEW requires ownership of the view, which the API roles
-- do not have. The function body takes NO arguments and touches only two
-- hard-coded view names, so there is no injection surface and nothing a caller
-- can redirect. search_path is pinned for the same reason.
--
-- NOT TENANT-SCOPED, and it cannot be: a materialized view refreshes WHOLLY,
-- there is no per-tenant refresh. That matches the Express behaviour exactly —
-- its per-tenant guard is the 60s cooldown in contract_pnl_settings, enforced by
-- the CALLER before this is invoked, not by the refresh itself.
--
-- Returns a jsonb marker rather than void so a caller can distinguish "views are
-- not created yet" (the migration has not been applied) from a real failure,
-- mirroring the Express 503 + viewMissing:true response.
--
-- Idempotent (CREATE OR REPLACE). Apply: \i drizzle/functions/contract-pnl-refresh.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refresh_contract_pnl_views()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW contract_pnl_v;
  REFRESH MATERIALIZED VIEW contract_pnl_monthly_v;
  RETURN jsonb_build_object('refreshed', true, 'refreshedAt', now());
EXCEPTION
  -- 42P01 = undefined_table. The views ship in
  -- drizzle/migrations/_backfill_contract_pnl.sql; if that has not been applied,
  -- report it as data rather than raising, so the endpoint can answer 503 with
  -- viewMissing:true exactly like the Express handler does.
  WHEN undefined_table THEN
    RETURN jsonb_build_object('refreshed', false, 'viewMissing', true);
END;
$$;

COMMENT ON FUNCTION public.refresh_contract_pnl_views() IS
  'EDGE-023: refreshes contract_pnl_v + contract_pnl_monthly_v for supabase/functions/contract-pnl POST /refresh. SECURITY DEFINER because REFRESH MATERIALIZED VIEW needs view ownership; takes no arguments and touches only two hard-coded views. Global, not per-tenant — the 60s per-tenant cooldown is enforced by the caller.';
