-- ============================================================================
-- sales-manager.sql — PL/pgSQL functions for sales-manager (L4) regional
-- reports.
--
-- Ports one core function (regional-performance) as the manager-persona
-- template. The other 3 endpoints (pipeline, quota, activity) follow the
-- same shape — they groupby regions instead of users and join with
-- locations / users to count team size. Each becomes an additional function
-- in this file when it lands.
--
-- Source: server/services/sales-manager-reporting-service.ts (629 lines).
-- ============================================================================

BEGIN;

-- ─── report_regional_performance ──────────────────────────────────────────
-- Regional rollup: revenue, wins, quota attainment, team size. One row per
-- region in the tenant, ranked by revenue.

CREATE OR REPLACE FUNCTION public.report_regional_performance(
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
  v_regions jsonb;
  v_total_revenue numeric := 0;
  v_total_deals int := 0;
  v_avg_win_rate numeric := 0;
  v_top jsonb;
  v_bottom jsonb;
BEGIN
  WITH region_rollup AS (
    SELECT
      r.id AS region_id,
      r.name AS region_name,
      COUNT(DISTINCT l.id)::int AS location_count,
      COUNT(DISTINCT u.id)::int AS team_size,
      COALESCE(SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END), 0)::numeric AS revenue,
      COUNT(o.id) FILTER (WHERE o.stage = 'Closed Won')::int AS deals_won,
      COUNT(o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost'))::int AS closed_total,
      COALESCE(AVG(o.amount) FILTER (WHERE o.stage = 'Closed Won'), 0)::numeric AS avg_deal,
      COALESCE(SUM(q.quota_amount), 0)::numeric AS quota_total,
      COUNT(a.id)::int AS activity_count
    FROM regions r
    LEFT JOIN locations l ON l.region_id = r.id
    LEFT JOIN users u ON u.primary_location_id = l.id AND u.tenant_id = p_tenant_id
    LEFT JOIN opportunities o
      ON o.owner_id = u.id
      AND o.tenant_id = p_tenant_id
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at <= p_date_to)
    LEFT JOIN quotas q
      ON q.user_id = u.id
      AND q.tenant_id = p_tenant_id
      AND q.quota_year = EXTRACT(YEAR FROM COALESCE(p_date_from, CURRENT_DATE))
    LEFT JOIN activities a
      ON a.user_id = u.id
      AND a.tenant_id = p_tenant_id
      AND (p_date_from IS NULL OR a.activity_date >= p_date_from)
      AND (p_date_to IS NULL OR a.activity_date <= p_date_to)
    WHERE r.tenant_id = p_tenant_id
    GROUP BY r.id, r.name
  ),
  ranked AS (
    SELECT
      region_id, region_name, location_count, team_size, revenue, deals_won,
      closed_total, avg_deal, quota_total, activity_count,
      CASE WHEN closed_total > 0
        THEN (deals_won::numeric / closed_total * 100) ELSE 0 END AS win_rate,
      CASE WHEN quota_total > 0
        THEN (revenue / quota_total * 100) ELSE 0 END AS quota_attainment,
      -- Activity score: activities per team member, normalised to 0-100 via
      -- division by an arbitrary cap (50 activities/person/period = 100).
      LEAST(100, CASE WHEN team_size > 0
        THEN (activity_count::numeric / team_size / 50 * 100) ELSE 0 END)::numeric AS activity_score,
      ROW_NUMBER() OVER (ORDER BY revenue DESC)::int AS ranking
    FROM region_rollup
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'regionId', region_id,
          'regionName', region_name,
          'locationCount', location_count,
          'teamSize', team_size,
          'totalRevenue', revenue,
          'dealsWon', deals_won,
          'winRate', round(win_rate::numeric, 2),
          'averageDealSize', round(avg_deal, 2),
          'quotaAttainment', round(quota_attainment::numeric, 2),
          'activityScore', round(activity_score, 2),
          'ranking', ranking
        )
        ORDER BY ranking
      ),
      '[]'::jsonb
    ),
    COALESCE(SUM(revenue), 0)::numeric,
    COALESCE(SUM(deals_won), 0)::int,
    COALESCE(AVG(win_rate), 0)::numeric
  INTO v_regions, v_total_revenue, v_total_deals, v_avg_win_rate
  FROM ranked;

  -- Top and bottom for the summary object.
  SELECT jsonb_build_object(
    'regionId', region_id, 'regionName', region_name,
    'totalRevenue', revenue, 'winRate', round(win_rate::numeric, 2)
  )
  INTO v_top
  FROM (
    SELECT * FROM jsonb_array_elements(v_regions) e
      CROSS JOIN LATERAL (
        SELECT
          (e.value->>'regionId')::uuid AS region_id,
          e.value->>'regionName' AS region_name,
          (e.value->>'totalRevenue')::numeric AS revenue,
          (e.value->>'winRate')::numeric AS win_rate
      ) x
    ORDER BY revenue DESC NULLS LAST
    LIMIT 1
  ) top_q;

  SELECT jsonb_build_object(
    'regionId', region_id, 'regionName', region_name,
    'totalRevenue', revenue, 'winRate', round(win_rate::numeric, 2)
  )
  INTO v_bottom
  FROM (
    SELECT * FROM jsonb_array_elements(v_regions) e
      CROSS JOIN LATERAL (
        SELECT
          (e.value->>'regionId')::uuid AS region_id,
          e.value->>'regionName' AS region_name,
          (e.value->>'totalRevenue')::numeric AS revenue,
          (e.value->>'winRate')::numeric AS win_rate
      ) x
    ORDER BY revenue ASC NULLS LAST
    LIMIT 1
  ) bot_q;

  RETURN jsonb_build_object(
    'regions', v_regions,
    'summary', jsonb_build_object(
      'totalRevenue', v_total_revenue,
      'totalDeals', v_total_deals,
      'averageWinRate', round(v_avg_win_rate, 2),
      'topRegion', v_top,
      'bottomRegion', v_bottom
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_regional_performance(uuid, timestamp, timestamp) FROM PUBLIC;

COMMIT;
