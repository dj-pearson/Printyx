-- =============================================================================
-- Sales Pipeline — SQL functions
-- =============================================================================
-- Two complex-CTE queries extracted from server/routes-sales-pipeline.ts:
--
--   public.sales_pipeline_rep_metrics(p_tenant_id text)
--     Per-rep lead/revenue/activity rollups joined against users in sales roles.
--     Returns JSONB array, one object per rep.
--
--   public.sales_pipeline_summary(p_tenant_id text)
--     Tenant-wide pipeline stats (value, active/qualified opps, monthly revenue,
--     conversion rate, avg sales cycle). Returns a single JSONB object.
--
-- Both functions COALESCE goal figures to defaults (50K revenue / 5 deals per
-- rep, 200K tenant-wide) since the historical Express code referenced a
-- never-defined `crm_goals` table. When real goal tracking lands (see
-- shared/schema.ts::salesGoals), update these functions to join against it.
--
-- SECURITY INVOKER. Tenant isolation enforced by explicit p_tenant_id — caller
-- (edge function) must pass the JWT tenant, never trust client input.
-- =============================================================================

-- ─── Rep metrics ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sales_pipeline_rep_metrics(p_tenant_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'rep_name'), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'rep_id',          u.id,
        'rep_name',        COALESCE(u.first_name || ' ' || u.last_name, u.email, 'Unknown'),
        'manager_id',      u.manager_id,
        'total_leads',     COUNT(br.id) FILTER (WHERE br.record_type = 'lead'),
        'qualified_leads', COUNT(br.id) FILTER (
          WHERE br.record_type = 'lead'
            AND br.status IN (
              'qualified', 'demo_scheduled', 'demo_completed',
              'proposal_prep', 'proposal_sent', 'negotiation'
            )
        ),
        'demos_scheduled', COUNT(br.id) FILTER (WHERE br.status = 'demo_scheduled'),
        'demos_completed', COUNT(br.id) FILTER (WHERE br.status = 'demo_completed'),
        'proposals_sent',  COUNT(br.id) FILTER (WHERE br.status = 'proposal_sent'),
        'deals_closed',    COUNT(br.id) FILTER (WHERE br.status = 'closed_won'),
        'total_revenue',   COALESCE(
          SUM(br.estimated_deal_value::numeric) FILTER (WHERE br.status = 'closed_won'),
          0
        ),
        'avg_deal_size',   COALESCE(
          AVG(br.estimated_deal_value::numeric) FILTER (WHERE br.status = 'closed_won'),
          0
        ),
        'avg_sales_cycle', COALESCE(
          AVG(EXTRACT(DAY FROM br.updated_at - br.created_at)) FILTER (WHERE br.status = 'closed_won'),
          30
        ),
        'activity_score', CASE
          WHEN MAX(br.last_contact_date) >= NOW() - INTERVAL '3 days'  THEN 100
          WHEN MAX(br.last_contact_date) >= NOW() - INTERVAL '7 days'  THEN  80
          WHEN MAX(br.last_contact_date) >= NOW() - INTERVAL '14 days' THEN  60
          WHEN MAX(br.last_contact_date) >= NOW() - INTERVAL '30 days' THEN  40
          ELSE 20
        END,
        'last_activity', COALESCE(to_char(MAX(br.last_contact_date), 'MM/DD/YY'), 'No recent activity'),

        -- Hardcoded defaults (see header comment)
        'revenue_goal', 50000,
        'deals_goal',    5,
        'goal_achievement', ROUND(
          (COALESCE(SUM(br.estimated_deal_value::numeric) FILTER (WHERE br.status = 'closed_won'), 0) / 50000.0) * 100,
          1
        ),
        'conversion_rate', CASE
          WHEN COUNT(br.id) FILTER (WHERE br.record_type = 'lead') > 0
            THEN ROUND(
              (COUNT(br.id) FILTER (WHERE br.status = 'closed_won')::numeric
                / COUNT(br.id) FILTER (WHERE br.record_type = 'lead')::numeric) * 100,
              1
            )
          ELSE 0
        END
      ) AS row
      FROM users u
      LEFT JOIN business_records br
        ON br.owner_id = u.id
       AND br.tenant_id = u.tenant_id
      WHERE u.tenant_id = p_tenant_id
        AND u.role IN ('sales_rep', 'sales_manager', 'account_manager')
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.manager_id
    ) t;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.sales_pipeline_rep_metrics(text) IS
  'Per-rep lead+revenue rollup for the sales pipeline dashboard. Tenant-scoped.';

GRANT EXECUTE ON FUNCTION public.sales_pipeline_rep_metrics(text) TO authenticated, service_role;

-- ─── Pipeline summary ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sales_pipeline_summary(p_tenant_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_value                numeric;
  v_active_opportunities       integer;
  v_qualified_opportunities    integer;
  v_monthly_revenue            numeric;
  v_total_leads                integer;
  v_closed_won                 integer;
  v_conversion_rate            numeric;
  v_avg_sales_cycle            numeric;
  v_last_month_revenue         numeric;
  v_growth_rate                numeric;
  v_revenue_goal               numeric := 200000;
  v_goal_achievement           numeric;
BEGIN
  -- Single-pass aggregation of the major pipeline metrics
  SELECT
    COALESCE(SUM(estimated_deal_value::numeric) FILTER (
      WHERE record_type = 'lead' AND status NOT IN ('closed_won', 'closed_lost')
    ), 0),
    COUNT(*) FILTER (
      WHERE record_type = 'lead' AND status NOT IN ('closed_won', 'closed_lost')
    ),
    COUNT(*) FILTER (
      WHERE status IN (
        'qualified', 'demo_scheduled', 'demo_completed',
        'proposal_prep', 'proposal_sent', 'negotiation'
      )
    ),
    COALESCE(SUM(estimated_deal_value::numeric) FILTER (
      WHERE status = 'closed_won' AND updated_at >= date_trunc('month', NOW())
    ), 0),
    COUNT(*) FILTER (WHERE record_type = 'lead'),
    COUNT(*) FILTER (WHERE status = 'closed_won'),
    COALESCE(AVG(EXTRACT(DAY FROM updated_at - created_at)) FILTER (
      WHERE status = 'closed_won'
    ), 30)
  INTO
    v_total_value,
    v_active_opportunities,
    v_qualified_opportunities,
    v_monthly_revenue,
    v_total_leads,
    v_closed_won,
    v_avg_sales_cycle
  FROM business_records
  WHERE tenant_id = p_tenant_id;

  -- Last month's revenue (for growth calc) — separate query to avoid
  -- window-function complexity on a single-row aggregate.
  SELECT COALESCE(SUM(estimated_deal_value::numeric), 0) INTO v_last_month_revenue
    FROM business_records
   WHERE tenant_id = p_tenant_id
     AND status = 'closed_won'
     AND updated_at >= date_trunc('month', NOW() - INTERVAL '1 month')
     AND updated_at <  date_trunc('month', NOW());

  v_conversion_rate := CASE
    WHEN v_total_leads > 0
      THEN ROUND((v_closed_won::numeric / v_total_leads::numeric) * 100, 1)
    ELSE 0
  END;

  v_growth_rate := CASE
    WHEN v_last_month_revenue > 0
      THEN ROUND(((v_monthly_revenue / v_last_month_revenue) - 1) * 100, 1)
    ELSE 0
  END;

  v_goal_achievement := ROUND((v_monthly_revenue / v_revenue_goal) * 100, 1);

  RETURN jsonb_build_object(
    'totalValue',              v_total_value,
    'activeOpportunities',     v_active_opportunities,
    'qualifiedOpportunities',  v_qualified_opportunities,
    'monthlyRevenue',          v_monthly_revenue,
    'conversionRate',          v_conversion_rate,
    'avgSalesCycle',           v_avg_sales_cycle,
    'growthRate',              v_growth_rate,
    'goalAchievement',         v_goal_achievement
  );
END;
$$;

COMMENT ON FUNCTION public.sales_pipeline_summary(text) IS
  'Tenant-wide sales-pipeline KPIs for the dashboard header. Tenant-scoped.';

GRANT EXECUTE ON FUNCTION public.sales_pipeline_summary(text) TO authenticated, service_role;
