-- =============================================================================
-- AI employee analytics overview (EDGE-019)
-- =============================================================================
--   public.ai_employee_analytics_overview(tenant) -> supabase/functions/ai-employees/ (/analytics/overview)
--
-- WHY THIS EXISTS: the Express handler this mirrors (getAnalyticsOverview() in
-- server/services/ai-employee-service.ts) is five raw SQL queries using
-- COUNT(*) FILTER, GROUP BY, a LEFT JOIN and a generate_series day series.
-- PostgREST can express NONE of that, so the ai-employees edge function cannot
-- reproduce it with .from()/.select() calls. Rather than reimplement the
-- aggregation in JS — duplicating non-trivial logic across two runtimes, where
-- it would drift — both backends call this one function.
--
-- The queries below intentionally reproduce the Node service's SQL clause for
-- clause, so applying this file does not move any number the dashboard shows.
--
-- KEYS ARE camelCase ON PURPOSE. client/src/pages/AIEmployeeDashboard.tsx reads
-- `analytics.totalEmployees`, `.performanceTrends.tasksCompleted` etc. directly
-- off the response (unlike the employee LIST, which it normalises through
-- toAiEmployee()). Returning snake_case here would silently render the whole
-- dashboard as zeroes rather than erroring — the shape is part of the contract.
--
-- costSavings is null BY DESIGN: nothing in the schema records a savings figure.
-- AUDIT-015 removed an invented $1,250 constant here; do not reintroduce one.
--
-- PARAMETER TYPE DIFFERS FROM ITS SIBLINGS ON PURPOSE: lead-scoring.sql and
-- billing-aggregates.sql take `p_tenant_id text` because their tables store
-- tenant_id as varchar. ai_employees.tenant_id / ai_employee_tasks.tenant_id are
-- `uuid` (see drizzle/rls/ai-employee-tables.sql), and `uuid = text` is not a
-- valid comparison in a function body, where the parameter has a known type.
-- Declaring the parameter `uuid` keeps the index usable and lets PostgREST
-- reject a malformed id with a 400 instead of erroring mid-query.
--
-- SECURITY INVOKER (the default) and tenant-scoped via an explicit parameter,
-- matching drizzle/functions/billing-aggregates.sql. Idempotent (CREATE OR
-- REPLACE), so re-running after an edit is safe.
--
-- Apply:  \i drizzle/functions/ai-employee-analytics.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ai_employee_analytics_overview(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH totals AS (
    SELECT
      COUNT(*)::int AS total_employees,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active_employees,
      COALESCE(AVG(user_satisfaction_rating), 0)::float AS customer_satisfaction
    FROM ai_employees
    WHERE tenant_id = p_tenant_id
  ),
  by_type AS (
    SELECT employee_type AS type,
           COUNT(*)::int AS count,
           COALESCE(AVG(success_rate), 0)::float AS efficiency
    FROM ai_employees
    WHERE tenant_id = p_tenant_id
    GROUP BY employee_type
  ),
  today AS (
    SELECT
      COUNT(*) FILTER (WHERE assigned_at >= date_trunc('day', now()))::int AS total_today,
      COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= date_trunc('day', now()))::int AS completed_today,
      COALESCE(AVG(quality_score), 0)::float AS avg_quality,
      COALESCE(AVG(execution_time_minutes), 0)::float AS avg_minutes
    FROM ai_employee_tasks
    WHERE tenant_id = p_tenant_id
  ),
  recent AS (
    SELECT t.id,
           t.task_type AS type,
           t.status,
           COALESCE(e.employee_name, 'Unassigned') AS employee,
           t.execution_time_minutes AS minutes,
           t.assigned_at
    FROM ai_employee_tasks t
    LEFT JOIN ai_employees e
      ON e.id = t.employee_id AND e.tenant_id = t.tenant_id
    WHERE t.tenant_id = p_tenant_id
    ORDER BY t.assigned_at DESC NULLS LAST
    LIMIT 10
  ),
  -- Last 7 days, oldest first. generate_series keeps days with NO tasks at 0
  -- instead of collapsing the series, which would misalign the chart.
  trends AS (
    SELECT d::date AS day,
           COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS tasks_completed,
           COALESCE(AVG(t.quality_score), 0)::float AS quality,
           COALESCE(AVG(t.execution_time_minutes), 0)::float AS response_time
    FROM generate_series(
           date_trunc('day', now()) - interval '6 days',
           date_trunc('day', now()),
           interval '1 day'
         ) d
    LEFT JOIN ai_employee_tasks t
      ON t.tenant_id = p_tenant_id
     AND t.assigned_at >= d
     AND t.assigned_at < d + interval '1 day'
    GROUP BY d
  )
  -- Every jsonb_agg carries its own ORDER BY: a CTE's ORDER BY does not bind the
  -- aggregate, and for `trends` the order IS the contract — the three arrays are
  -- read positionally as one 7-day series, so an unordered agg would scramble
  -- the chart rather than fail.
  SELECT jsonb_build_object(
    'totalEmployees',       (SELECT total_employees FROM totals),
    'activeEmployees',      (SELECT active_employees FROM totals),
    'totalTasksToday',      (SELECT total_today FROM today),
    'completedTasksToday',  (SELECT completed_today FROM today),
    'averageQualityScore',  (SELECT avg_quality FROM today),
    'averageResponseTime',  (SELECT avg_minutes FROM today),
    -- No source of truth for a savings figure. Reported as unknown, never invented.
    'costSavings',          NULL,
    'customerSatisfaction', (SELECT customer_satisfaction FROM totals),
    'employeeTypes', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'type', COALESCE(type, ''),
                'count', count,
                'efficiency', efficiency)
              ORDER BY count DESC)
       FROM by_type), '[]'::jsonb),
    'recentTasks', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'id', id::text,
                'type', COALESCE(type, ''),
                'status', COALESCE(status, ''),
                'employee', COALESCE(employee, ''),
                -- Matches the Node service: null minutes render as an em dash.
                'duration', CASE WHEN minutes IS NULL THEN '—' ELSE minutes::text || 'm' END)
              ORDER BY assigned_at DESC NULLS LAST)
       FROM recent), '[]'::jsonb),
    'performanceTrends', jsonb_build_object(
      'tasksCompleted', COALESCE((SELECT jsonb_agg(tasks_completed ORDER BY day) FROM trends), '[]'::jsonb),
      'qualityScores',  COALESCE((SELECT jsonb_agg(quality        ORDER BY day) FROM trends), '[]'::jsonb),
      'responseTime',   COALESCE((SELECT jsonb_agg(response_time  ORDER BY day) FROM trends), '[]'::jsonb)
    )
  );
$$;

COMMENT ON FUNCTION public.ai_employee_analytics_overview(uuid) IS
  'EDGE-019: dashboard aggregates for supabase/functions/ai-employees /analytics/overview. Mirrors getAnalyticsOverview() in server/services/ai-employee-service.ts — keep the two in sync. Returns camelCase keys because AIEmployeeDashboard.tsx reads them directly.';
