-- Drop orphaned persona-report PL/pgSQL functions (EDGE-007a).
--
-- These SECURITY DEFINER functions were originally authored in
-- drizzle/reports/{director,executive,sales,sales-manager,service,warehouse}.sql
-- as the supabase.rpc() target for the per-persona reports edge functions.
--
-- Those persona-reports/* edge functions were deleted in EDGE-001/EDGE-007 and
-- the canonical supabase/functions/reports/ handlers compute every persona
-- report with inline JS aggregation instead of calling these functions (see
-- reports/handlers/reporting-engine.ts). A repo-wide audit (EDGE-007a) confirms
-- zero remaining .rpc() callers, so the functions are dead weight on the DB.
--
-- Resolution: drop-and-remove (over migrate-to-rpc). The .sql source files are
-- deleted in the same commit. Each name is unique (no overloads), so the
-- explicit signatures below match exactly; IF EXISTS keeps this idempotent and
-- safe to re-run even where the function was never applied.

DROP FUNCTION IF EXISTS public.report_company_sales_performance(uuid, timestamp, timestamp);
DROP FUNCTION IF EXISTS public.report_company_service_performance(uuid, timestamp, timestamp);
DROP FUNCTION IF EXISTS public.report_executive_dashboard(uuid, timestamp, timestamp);
DROP FUNCTION IF EXISTS public.report_platform_admin_dashboard();
DROP FUNCTION IF EXISTS public.report_regional_performance(uuid, timestamp, timestamp);
DROP FUNCTION IF EXISTS public.report_sales_personal_pipeline(uuid, uuid, timestamp, timestamp);
DROP FUNCTION IF EXISTS public.report_sales_personal_activity(uuid, uuid, timestamp, timestamp, text);
DROP FUNCTION IF EXISTS public.report_sales_personal_quota(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.report_sales_team_comparison(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.report_service_personal_calls(uuid, uuid, timestamp, timestamp, text);
DROP FUNCTION IF EXISTS public.report_service_personal_time(uuid, uuid, timestamp, timestamp);
DROP FUNCTION IF EXISTS public.report_service_team_quick_stats(uuid, uuid, uuid[], timestamp, timestamp);
DROP FUNCTION IF EXISTS public.report_warehouse_team_quick_stats(text, text, text[], timestamp, timestamp);
