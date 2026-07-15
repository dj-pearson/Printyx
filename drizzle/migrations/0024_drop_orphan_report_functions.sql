-- EDGE-007a: drop the orphaned SECURITY DEFINER report functions that were the
-- rpc() target of the persona-reports edge function (deleted in EDGE-007). The
-- canonical reports/ handlers aggregate in JS and never call these; a repo-wide
-- grep confirms zero rpc('report_*') callers. Their defining files under
-- drizzle/reports/*.sql are removed in the same change.
--
-- Each name is unique, so the argument list can be omitted. IF EXISTS makes this
-- a no-op on a fresh DB (where they were never created).
DROP FUNCTION IF EXISTS public.report_company_sales_performance;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_company_service_performance;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_executive_dashboard;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_platform_admin_dashboard;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_regional_performance;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_sales_personal_activity;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_sales_personal_pipeline;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_sales_personal_quota;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_sales_team_comparison;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_service_personal_calls;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_service_personal_time;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_service_team_quick_stats;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.report_warehouse_team_quick_stats;
