-- ============================================================================
-- director.sql — PL/pgSQL functions for director-level reports (Level 5+).
--
-- Called via supabase.rpc() from supabase/functions/persona-reports/handlers/
-- director.ts. Keeps the complex CTEs in Postgres so (a) they're visible to
-- psql / explain plans, (b) edge functions stay thin, (c) Drizzle-in-Deno
-- isn't required.
--
-- All functions are SECURITY DEFINER — they run with the owner's privileges
-- (bypassing RLS) because they already filter by the caller-supplied
-- p_tenant_id. The edge function is responsible for passing the caller's
-- tenant + RBAC-gating who can call each report.
-- ============================================================================

BEGIN;

-- ─── report_company_sales_performance ──────────────────────────────────────
-- Ports director-reporting-service.ts::getCompanySalesPerformance (lines 124-242).

CREATE OR REPLACE FUNCTION public.report_company_sales_performance(
  p_tenant_id uuid,
  p_date_from timestamp DEFAULT NULL,
  p_date_to timestamp DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue numeric;
  v_total_deals int;
  v_total_closed int;
  v_pipeline_value numeric;
  v_total_quota numeric;
  v_regions jsonb;
  v_top_performers jsonb;
BEGIN
  -- Company metrics
  SELECT
    COALESCE(SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END), 0),
    COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END),
    COUNT(CASE WHEN o.stage IN ('Closed Won', 'Closed Lost') THEN 1 END),
    COALESCE(SUM(CASE WHEN o.stage NOT IN ('Closed Won', 'Closed Lost', 'Cancelled')
                       THEN o.weighted_amount ELSE 0 END), 0)
  INTO v_total_revenue, v_total_deals, v_total_closed, v_pipeline_value
  FROM opportunities o
  WHERE o.tenant_id = p_tenant_id
    AND (p_date_from IS NULL OR o.closed_at >= p_date_from)
    AND (p_date_to IS NULL OR o.closed_at <= p_date_to);

  -- Quota aggregate
  SELECT COALESCE(SUM(q.quota_amount), 0)
  INTO v_total_quota
  FROM sales_quotas q
  WHERE q.tenant_id = p_tenant_id;

  -- Regional performance
  SELECT jsonb_agg(
    jsonb_build_object(
      'regionId', rp.region_id,
      'regionName', rp.region_name,
      'revenue', rp.revenue,
      'deals', rp.deals,
      'winRate', CASE WHEN rp.closed > 0 THEN rp.deals::numeric / rp.closed * 100 ELSE 0 END,
      'quotaAttainment', CASE WHEN rp.quota > 0 THEN rp.revenue / rp.quota * 100 ELSE 0 END
    )
  )
  INTO v_regions
  FROM (
    SELECT
      r.id AS region_id,
      r.name AS region_name,
      COALESCE(SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END), 0) AS revenue,
      COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END) AS deals,
      COUNT(CASE WHEN o.stage IN ('Closed Won', 'Closed Lost') THEN 1 END) AS closed,
      COALESCE(SUM(q.quota_amount), 0) AS quota
    FROM regions r
    LEFT JOIN locations l ON l.region_id = r.id
    LEFT JOIN users u ON u.primary_location_id = l.id
    LEFT JOIN opportunities o ON o.owner_id = u.id
      AND o.tenant_id = p_tenant_id
      AND (p_date_from IS NULL OR o.closed_at >= p_date_from)
      AND (p_date_to IS NULL OR o.closed_at <= p_date_to)
    LEFT JOIN sales_quotas q ON q.user_id = u.id AND q.tenant_id = p_tenant_id
    WHERE r.tenant_id = p_tenant_id
    GROUP BY r.id, r.name
  ) rp;

  -- Top performers
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', tp.user_id,
      'userName', tp.user_name,
      'revenue', tp.revenue,
      'deals', tp.deals
    )
  )
  INTO v_top_performers
  FROM (
    SELECT
      u.id AS user_id,
      u.first_name || ' ' || COALESCE(u.last_name, '') AS user_name,
      COALESCE(SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END), 0) AS revenue,
      COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END) AS deals
    FROM users u
    LEFT JOIN opportunities o ON o.owner_id = u.id
      AND o.tenant_id = p_tenant_id
      AND (p_date_from IS NULL OR o.closed_at >= p_date_from)
      AND (p_date_to IS NULL OR o.closed_at <= p_date_to)
    WHERE u.tenant_id = p_tenant_id
    GROUP BY u.id, u.first_name, u.last_name
    ORDER BY revenue DESC NULLS LAST
    LIMIT 10
  ) tp;

  RETURN jsonb_build_object(
    'totalRevenue', v_total_revenue,
    'totalDeals', v_total_deals,
    'averageWinRate',
      CASE WHEN v_total_closed > 0
           THEN round(v_total_deals::numeric / v_total_closed * 100, 2)
           ELSE 0 END,
    'averageDealSize',
      CASE WHEN v_total_deals > 0
           THEN round(v_total_revenue / v_total_deals, 2)
           ELSE 0 END,
    'quotaAttainment',
      CASE WHEN v_total_quota > 0
           THEN round(v_total_revenue / v_total_quota * 100, 2)
           ELSE 0 END,
    'pipelineValue', v_pipeline_value,
    'regions', COALESCE(v_regions, '[]'::jsonb),
    'topPerformers', COALESCE(v_top_performers, '[]'::jsonb),
    'forecast', jsonb_build_object(
      'currentQuarter', v_total_revenue,
      'nextQuarter', v_pipeline_value * 0.3,
      'yearEnd', v_total_revenue * 1.5
    )
  );
END;
$$;

COMMENT ON FUNCTION public.report_company_sales_performance IS
  'Director-level company-wide sales report. Caller must have role level 5+. Filter by tenant + optional date range.';

-- ─── report_company_service_performance ────────────────────────────────────
-- Ports director-reporting-service.ts::getCompanyServicePerformance (lines 247-348).

CREATE OR REPLACE FUNCTION public.report_company_service_performance(
  p_tenant_id uuid,
  p_date_from timestamp DEFAULT NULL,
  p_date_to timestamp DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_calls int;
  v_avg_ftf numeric;
  v_avg_sla numeric;
  v_avg_satisfaction numeric;
  v_total_technicians int;
  v_avg_utilization numeric;
  v_regions jsonb;
  v_top_performers jsonb;
BEGIN
  -- Company metrics
  SELECT
    COUNT(sc.id),
    COALESCE(AVG(CASE WHEN sc.first_time_fix = true THEN 100 ELSE 0 END), 0),
    COALESCE(AVG(CASE WHEN sc.sla_status = 'on_time' THEN 100 ELSE 0 END), 0),
    COALESCE(AVG(sc.satisfaction_rating), 0),
    COUNT(DISTINCT u.id),
    -- Utilization is best computed via time_entries; placeholder when none exist.
    COALESCE(AVG(te.hours / 40.0 * 100), 0)
  INTO v_total_calls, v_avg_ftf, v_avg_sla, v_avg_satisfaction,
       v_total_technicians, v_avg_utilization
  FROM service_calls sc
  LEFT JOIN users u ON sc.technician_id = u.id
  LEFT JOIN time_entries te ON te.user_id = u.id
    AND te.tenant_id = p_tenant_id
    AND (p_date_from IS NULL OR te.created_at >= p_date_from)
    AND (p_date_to IS NULL OR te.created_at <= p_date_to)
  WHERE sc.tenant_id = p_tenant_id
    AND (p_date_from IS NULL OR sc.created_at >= p_date_from)
    AND (p_date_to IS NULL OR sc.created_at <= p_date_to);

  -- Regional performance
  SELECT jsonb_agg(
    jsonb_build_object(
      'regionId', rp.region_id,
      'regionName', rp.region_name,
      'calls', rp.calls,
      'ftfRate', rp.ftf_rate,
      'slaCompliance', rp.sla_compliance,
      'technicians', rp.technicians
    )
  )
  INTO v_regions
  FROM (
    SELECT
      r.id AS region_id,
      r.name AS region_name,
      COUNT(sc.id) AS calls,
      COALESCE(AVG(CASE WHEN sc.first_time_fix = true THEN 100 ELSE 0 END), 0) AS ftf_rate,
      COALESCE(AVG(CASE WHEN sc.sla_status = 'on_time' THEN 100 ELSE 0 END), 0) AS sla_compliance,
      COUNT(DISTINCT u.id) AS technicians
    FROM regions r
    LEFT JOIN locations l ON l.region_id = r.id
    LEFT JOIN users u ON u.primary_location_id = l.id
    LEFT JOIN service_calls sc ON sc.technician_id = u.id
      AND sc.tenant_id = p_tenant_id
      AND (p_date_from IS NULL OR sc.created_at >= p_date_from)
      AND (p_date_to IS NULL OR sc.created_at <= p_date_to)
    WHERE r.tenant_id = p_tenant_id
    GROUP BY r.id, r.name
  ) rp;

  -- Top performers
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', tp.user_id,
      'userName', tp.user_name,
      'ftfRate', tp.ftf_rate,
      'satisfaction', tp.satisfaction
    )
  )
  INTO v_top_performers
  FROM (
    SELECT
      u.id AS user_id,
      u.first_name || ' ' || COALESCE(u.last_name, '') AS user_name,
      COALESCE(AVG(CASE WHEN sc.first_time_fix = true THEN 100 ELSE 0 END), 0) AS ftf_rate,
      COALESCE(AVG(sc.satisfaction_rating), 0) AS satisfaction
    FROM users u
    LEFT JOIN service_calls sc ON sc.technician_id = u.id
      AND sc.tenant_id = p_tenant_id
      AND (p_date_from IS NULL OR sc.created_at >= p_date_from)
      AND (p_date_to IS NULL OR sc.created_at <= p_date_to)
    WHERE u.tenant_id = p_tenant_id
    GROUP BY u.id, u.first_name, u.last_name
    ORDER BY ftf_rate DESC NULLS LAST, satisfaction DESC NULLS LAST
    LIMIT 10
  ) tp;

  RETURN jsonb_build_object(
    'totalCalls', v_total_calls,
    'avgFirstTimeFixRate', v_avg_ftf,
    'avgSlaCompliance', v_avg_sla,
    'avgCustomerSatisfaction', v_avg_satisfaction,
    'totalTechnicians', v_total_technicians,
    'avgUtilization', v_avg_utilization,
    'regions', COALESCE(v_regions, '[]'::jsonb),
    'topPerformers', COALESCE(v_top_performers, '[]'::jsonb),
    'trends', jsonb_build_object(
      'callVolumeChange', 0,
      'ftfRateChange', 0,
      'slaComplianceChange', 0
    )
  );
END;
$$;

COMMENT ON FUNCTION public.report_company_service_performance IS
  'Director-level company-wide service report. Caller must have role level 5+. Trends placeholder until historical compare lands.';

-- ─── Grants ────────────────────────────────────────────────────────────────
-- Service-role (edge functions) is the only caller. Authenticated users
-- shouldn't call these functions directly — they go through the edge function
-- which enforces RBAC level gates.
REVOKE ALL ON FUNCTION public.report_company_sales_performance(uuid, timestamp, timestamp) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_company_service_performance(uuid, timestamp, timestamp) FROM PUBLIC;

-- Supabase's service_role can always call SECURITY DEFINER functions, so no
-- explicit grant needed. If you want the anon key to be able to call them
-- (it shouldn't), add: GRANT EXECUTE ON FUNCTION ... TO authenticated;

COMMIT;
