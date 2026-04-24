-- ============================================================================
-- executive.sql — PL/pgSQL functions for executive + platform-admin reports.
--
-- Ports server/services/executive-reporting-service.ts (321 lines). Like the
-- Express original, much of the dashboard is composed of hardcoded placeholder
-- metrics (revenueGrowth, NPS, grossMargin, etc.) because the underlying
-- historical data isn't tracked yet. Fields that ARE real: totalRevenue, ARR,
-- MRR, customer_count, csat, tenant counts, DAU/MAU. See the `TODO` comments
-- in the Express service for the fields that need real telemetry.
--
-- Two functions:
--   report_executive_dashboard(tenant, date_from, date_to) — level 7+
--   report_platform_admin_dashboard()                      — level 8, no tenant filter
-- ============================================================================

BEGIN;

-- ─── report_executive_dashboard ────────────────────────────────────────────
-- Ports executive-reporting-service.ts::getExecutiveDashboard (lines 142-234).

CREATE OR REPLACE FUNCTION public.report_executive_dashboard(
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
  v_total_revenue numeric := 0;
  v_arr numeric := 0;
  v_mrr numeric := 0;
  v_total_employees int := 0;
  v_customer_count int := 0;
  v_csat numeric := 0;
  v_cac numeric;
  v_ltv numeric;
BEGIN
  -- Financial metrics from opportunities (recurring deals → ARR / MRR).
  SELECT
    COALESCE(SUM(CASE WHEN stage = 'Closed Won' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN stage = 'Closed Won' AND deal_type = 'recurring' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN stage = 'Closed Won' AND deal_type = 'recurring' THEN amount / 12.0 ELSE 0 END), 0)
  INTO v_total_revenue, v_arr, v_mrr
  FROM opportunities
  WHERE tenant_id = p_tenant_id
    AND (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at <= p_date_to);

  -- Employee count (all active tenant users).
  SELECT COUNT(DISTINCT id)::int INTO v_total_employees
  FROM users
  WHERE tenant_id = p_tenant_id;

  -- Customer count + average CSAT.
  SELECT COUNT(DISTINCT id)::int INTO v_customer_count
  FROM business_records
  WHERE tenant_id = p_tenant_id
    AND status = 'customer';

  SELECT COALESCE(AVG(satisfaction_rating), 0) INTO v_csat
  FROM service_calls
  WHERE tenant_id = p_tenant_id
    AND (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at <= p_date_to);

  -- Strategic metrics — CAC/LTV are rough heuristics pending real telemetry.
  v_cac := CASE WHEN v_customer_count > 0
    THEN (v_total_revenue / v_customer_count) * 0.3 ELSE 0 END;
  v_ltv := CASE WHEN v_customer_count > 0
    THEN (v_total_revenue / v_customer_count) * 3 ELSE 0 END;

  RETURN jsonb_build_object(
    'financial', jsonb_build_object(
      'totalRevenue', v_total_revenue,
      -- Placeholder: revenueGrowth needs historical snapshot comparison.
      'revenueGrowth', 15.3,
      'grossMargin', 65.0,
      'netProfit', v_total_revenue * 0.2,
      'arr', v_arr,
      'mrr', v_mrr
    ),
    'operational', jsonb_build_object(
      'totalEmployees', v_total_employees,
      'customerCount', v_customer_count,
      -- Placeholders: customer_growth + churn + NPS need historical tracking.
      'customerGrowth', 8.5,
      'customerChurn', 2.1,
      'nps', 45,
      'csat', round(v_csat::numeric, 2)
    ),
    'strategic', jsonb_build_object(
      'marketShare', 12.5,
      'cac', round(v_cac::numeric, 2),
      'ltv', round(v_ltv::numeric, 2),
      'ltvCacRatio', 3.0,
      'monthsToRecover', 8
    ),
    'kpis', jsonb_build_array(
      jsonb_build_object('name', 'Revenue Growth', 'value', 15.3, 'target', 20, 'status', 'yellow'),
      jsonb_build_object('name', 'Gross Margin', 'value', 65.0, 'target', 60, 'status', 'green'),
      jsonb_build_object(
        'name', 'Customer Satisfaction',
        'value', round(v_csat::numeric, 2),
        'target', 4.5,
        'status', CASE WHEN v_csat >= 4.5 THEN 'green' ELSE 'yellow' END
      ),
      jsonb_build_object('name', 'NPS', 'value', 45, 'target', 50, 'status', 'yellow'),
      jsonb_build_object('name', 'Churn Rate', 'value', 2.1, 'target', 3.0, 'status', 'green')
    )
  );
END;
$$;

COMMENT ON FUNCTION public.report_executive_dashboard IS
  'Executive dashboard (level 7+). Real fields: totalRevenue, ARR, MRR, totalEmployees, customerCount, csat. Other fields are placeholders pending historical telemetry.';

REVOKE ALL ON FUNCTION public.report_executive_dashboard(uuid, timestamp, timestamp) FROM PUBLIC;

-- ─── report_platform_admin_dashboard ───────────────────────────────────────
-- Ports executive-reporting-service.ts::getPlatformAdminDashboard (lines 239-312).
-- Cross-tenant — queries ALL tenants. Level 8 gate is enforced at the edge.

CREATE OR REPLACE FUNCTION public.report_platform_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_tenants int := 0;
  v_active_tenants int := 0;
  v_trial_tenants int := 0;
  v_paid_tenants int := 0;
  v_churned_tenants int := 0;
  v_total_users int := 0;
  v_dau int := 0;
  v_mau int := 0;
BEGIN
  -- Tenant rollup
  SELECT
    COUNT(DISTINCT id)::int,
    COUNT(DISTINCT id) FILTER (WHERE status = 'active')::int,
    COUNT(DISTINCT id) FILTER (WHERE subscription_plan = 'trial')::int,
    COUNT(DISTINCT id) FILTER (WHERE subscription_plan != 'trial')::int,
    COUNT(DISTINCT id) FILTER (WHERE status = 'churned')::int
  INTO
    v_total_tenants, v_active_tenants, v_trial_tenants,
    v_paid_tenants, v_churned_tenants
  FROM tenants;

  -- User activity — DAU / MAU from last_login timestamps.
  SELECT
    COUNT(DISTINCT id)::int,
    COUNT(DISTINCT id) FILTER (WHERE last_login > NOW() - INTERVAL '1 day')::int,
    COUNT(DISTINCT id) FILTER (WHERE last_login > NOW() - INTERVAL '30 days')::int
  INTO v_total_users, v_dau, v_mau
  FROM users;

  RETURN jsonb_build_object(
    'system', jsonb_build_object(
      -- System telemetry (uptime, response time, error rate) comes from
      -- the monitoring stack; hardcoded placeholders until that feed lands.
      'uptime', 99.95,
      'apiResponseTime', 145,
      'errorRate', 0.02,
      'activeUsers', v_dau,
      'requestsPerMinute', 1250
    ),
    'tenants', jsonb_build_object(
      'total', v_total_tenants,
      'active', v_active_tenants,
      'trial', v_trial_tenants,
      'paid', v_paid_tenants,
      'churned', v_churned_tenants,
      -- Placeholder: avg revenue per tenant needs real billing aggregate.
      'avgRevenuePerTenant', 2500
    ),
    'billing', jsonb_build_object(
      -- Placeholders until the billing edge function exposes real MRR/ARR.
      'totalMRR', v_total_tenants * 2500,
      'totalARR', v_total_tenants * 2500 * 12,
      'churnRate', 1.8,
      'expansionRevenue', v_total_tenants * 250,
      'contractionRevenue', v_total_tenants * 50
    ),
    'usage', jsonb_build_object(
      'totalUsers', v_total_users,
      'dailyActiveUsers', v_dau,
      'monthlyActiveUsers', v_mau,
      -- Placeholders — session tracking isn't implemented yet.
      'avgSessionDuration', 28,
      'featureAdoption', jsonb_build_object(
        'crm', 95, 'service', 88, 'billing', 76, 'reporting', 92
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION public.report_platform_admin_dashboard IS
  'Platform-wide cross-tenant metrics (level 8 only). Real fields: tenant counts, totalUsers, DAU, MAU. System/billing/session fields are placeholders.';

REVOKE ALL ON FUNCTION public.report_platform_admin_dashboard() FROM PUBLIC;

COMMIT;
