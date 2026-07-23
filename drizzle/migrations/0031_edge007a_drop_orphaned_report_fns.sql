-- EDGE-007a: drop the orphaned persona-report PL/pgSQL functions.
--
-- These 13 SECURITY DEFINER functions were the db.rpc() targets for the
-- persona-reports/ edge function, which was DELETED in EDGE-007. The canonical
-- reports/ edge function aggregates in JS (supabase-js queries) and never calls
-- them — a repo-wide grep for these names finds zero .ts/.js references. They
-- are pure orphans in the live DB: dead attack surface (SECURITY DEFINER) with
-- no caller. Decision (drop vs migrate-to-rpc): DROP — removing surface area is
-- simpler and safer than refactoring 7 handlers onto rpc() with no caller to
-- validate against; the JS handlers already return real data.
--
-- The .sql source files under drizzle/reports/ are deleted alongside this
-- migration. IF EXISTS makes this idempotent and safe whether or not the
-- functions were ever applied to a given environment. Names are unique (no
-- overloads), so the argument-less DROP FUNCTION form is unambiguous on PG10+.
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
