-- ============================================================================
-- sales.sql — PL/pgSQL functions for sales persona reports.
--
-- Ports the 3 core personal-view queries + team comparison from
-- server/services/sales-reporting-service.ts (763 lines). The remaining 5
-- endpoints (commissions, leaderboard, team/pipeline, team/pipeline-summary,
-- cache/invalidate) return 501 from the handler — they need either the
-- hierarchical query builder (for team scope) or additional per-deal queries
-- that go beyond the template. See tasks/followup-reports-migration.md for
-- the leftover inventory.
-- ============================================================================

BEGIN;

-- ─── report_sales_personal_pipeline ───────────────────────────────────────
-- Pipeline by stage with conversion-rate window function.
-- Ports sales-reporting-service.ts::getPersonalPipeline (lines 147-220).

CREATE OR REPLACE FUNCTION public.report_sales_personal_pipeline(
  p_tenant_id uuid,
  p_user_id uuid,
  p_date_from timestamp DEFAULT NULL,
  p_date_to timestamp DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH stage_stats AS (
    SELECT
      o.stage,
      COUNT(o.id)::int AS cnt,
      COALESCE(SUM(o.amount), 0)::numeric AS total_value,
      COALESCE(SUM(o.weighted_amount), 0)::numeric AS weighted_value,
      COALESCE(AVG(o.amount), 0)::numeric AS avg_deal,
      -- Stable ordering: Lead=1 → Discovery=3 → Negotiation=5 → Closed Won=6.
      CASE o.stage
        WHEN 'Lead' THEN 1 WHEN 'Qualified' THEN 2 WHEN 'Discovery' THEN 3
        WHEN 'Proposal' THEN 4 WHEN 'Negotiation' THEN 5 WHEN 'Closed Won' THEN 6
        ELSE 7 END AS stage_order
    FROM opportunities o
    WHERE o.owner_id = p_user_id
      AND o.tenant_id = p_tenant_id
      AND o.stage NOT IN ('Closed Lost', 'Cancelled')
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at <= p_date_to)
    GROUP BY o.stage
  ),
  with_conversion AS (
    SELECT
      s.stage, s.cnt, s.total_value, s.weighted_value, s.avg_deal, s.stage_order,
      CASE
        WHEN LAG(s.cnt) OVER (ORDER BY s.stage_order) > 0
          THEN (s.cnt::numeric / LAG(s.cnt) OVER (ORDER BY s.stage_order)) * 100
        ELSE 0
      END AS conversion_rate
    FROM stage_stats s
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'stage', stage,
        'count', cnt,
        'totalValue', total_value,
        'weightedValue', weighted_value,
        'averageDealSize', round(avg_deal, 2),
        'conversionRate', round(conversion_rate::numeric, 2)
      )
      ORDER BY stage_order
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM with_conversion;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.report_sales_personal_pipeline(uuid, uuid, timestamp, timestamp) FROM PUBLIC;

-- ─── report_sales_personal_activity ───────────────────────────────────────
-- Day / week rollup of call/email/meeting/demo/proposal counts for one rep.
-- Ports sales-reporting-service.ts::getPersonalActivity (lines 226-265).

CREATE OR REPLACE FUNCTION public.report_sales_personal_activity(
  p_tenant_id uuid,
  p_user_id uuid,
  p_date_from timestamp,
  p_date_to timestamp,
  p_granularity text DEFAULT 'day' -- 'day' or 'week'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fmt text;
  v_result jsonb;
BEGIN
  v_fmt := CASE WHEN lower(p_granularity) = 'week' THEN 'IYYY-IW' ELSE 'YYYY-MM-DD' END;

  WITH rollup AS (
    SELECT
      TO_CHAR(a.activity_date, v_fmt) AS bucket,
      SUM(CASE WHEN a.activity_type = 'call' THEN 1 ELSE 0 END)::int AS calls,
      SUM(CASE WHEN a.activity_type = 'email' THEN 1 ELSE 0 END)::int AS emails,
      SUM(CASE WHEN a.activity_type = 'meeting' THEN 1 ELSE 0 END)::int AS meetings,
      SUM(CASE WHEN a.activity_type = 'demo' THEN 1 ELSE 0 END)::int AS demos,
      SUM(CASE WHEN a.activity_type = 'proposal' THEN 1 ELSE 0 END)::int AS proposals
    FROM activities a
    WHERE a.user_id = p_user_id
      AND a.tenant_id = p_tenant_id
      AND a.activity_date >= p_date_from
      AND a.activity_date <= p_date_to
    GROUP BY TO_CHAR(a.activity_date, v_fmt)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date', bucket,
        'calls', calls,
        'emails', emails,
        'meetings', meetings,
        'demos', demos,
        'proposals', proposals
      )
      ORDER BY bucket
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM rollup;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.report_sales_personal_activity(uuid, uuid, timestamp, timestamp, text) FROM PUBLIC;

-- ─── report_sales_personal_quota ──────────────────────────────────────────
-- Quota attainment for one rep in one period.
-- Ports sales-reporting-service.ts::getPersonalQuotaAttainment (lines 271-349).

CREATE OR REPLACE FUNCTION public.report_sales_personal_quota(
  p_tenant_id uuid,
  p_user_id uuid,
  p_period text DEFAULT 'current' -- 'current' | 'previous' | 'ytd'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamp;
  v_end timestamp;
  v_quota_period text;
  v_quota_amount numeric := 0;
  v_actual_revenue numeric := 0;
  v_deals_won int := 0;
  v_avg_deal numeric := 0;
  v_user_name text;
BEGIN
  -- Resolve the window + quota_period token from p_period.
  CASE lower(p_period)
    WHEN 'current' THEN
      v_start := DATE_TRUNC('month', CURRENT_DATE);
      v_end := v_start + INTERVAL '1 month';
      v_quota_period := 'monthly';
    WHEN 'previous' THEN
      v_start := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
      v_end := v_start + INTERVAL '1 month';
      v_quota_period := 'monthly';
    WHEN 'ytd' THEN
      v_start := DATE_TRUNC('year', CURRENT_DATE);
      v_end := CURRENT_DATE + INTERVAL '1 day';
      v_quota_period := 'yearly';
    ELSE
      RAISE EXCEPTION 'Unsupported period: %', p_period;
  END CASE;

  -- User display name.
  SELECT COALESCE(
    NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
    u.email,
    u.id::text
  )
  INTO v_user_name
  FROM users u
  WHERE u.id = p_user_id;

  -- Quota row for the period.
  SELECT COALESCE(q.quota_amount, 0)
  INTO v_quota_amount
  FROM quotas q
  WHERE q.user_id = p_user_id
    AND q.quota_period = v_quota_period
    AND q.quota_year = EXTRACT(YEAR FROM v_start)
    AND (
      v_quota_period = 'yearly'
      OR q.quota_month = EXTRACT(MONTH FROM v_start)
    )
  LIMIT 1;

  -- Won revenue + deal count.
  SELECT
    COALESCE(SUM(o.amount), 0),
    COUNT(*)::int,
    COALESCE(AVG(o.amount), 0)
  INTO v_actual_revenue, v_deals_won, v_avg_deal
  FROM opportunities o
  WHERE o.owner_id = p_user_id
    AND o.tenant_id = p_tenant_id
    AND o.stage = 'Closed Won'
    AND o.close_date >= v_start
    AND o.close_date < v_end;

  RETURN jsonb_build_object(
    'userId', p_user_id,
    'userName', COALESCE(v_user_name, ''),
    'quotaAmount', v_quota_amount,
    'actualRevenue', v_actual_revenue,
    'attainmentPercent',
      CASE WHEN v_quota_amount > 0
        THEN round((v_actual_revenue / v_quota_amount * 100)::numeric, 2)
        ELSE 0 END,
    'dealsWon', v_deals_won,
    'averageDealSize', round(v_avg_deal::numeric, 2),
    -- rank + trend are placeholders; leaderboard query would compute rank,
    -- and prev-period comparison would set trend.
    'rank', 1,
    'trend', 'flat'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_sales_personal_quota(uuid, uuid, text) FROM PUBLIC;

-- ─── report_sales_team_comparison ─────────────────────────────────────────
-- One-row-per-rep summary for a team. Caller supplies the accessible user IDs
-- (computed by the edge function from the caller's role level).
-- Ports sales-reporting-service.ts::getTeamComparison (the /team/comparison
-- + /team/pipeline endpoints both consume this).

CREATE OR REPLACE FUNCTION public.report_sales_team_comparison(
  p_tenant_id uuid,
  p_user_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_user_ids IS NULL OR cardinality(p_user_ids) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH rep_stats AS (
    SELECT
      u.id AS user_id,
      COALESCE(
        NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
        u.email,
        u.id::text
      ) AS user_name,
      COALESCE(SUM(o.weighted_amount) FILTER (
        WHERE o.stage NOT IN ('Closed Won', 'Closed Lost', 'Cancelled')
      ), 0)::numeric AS pipeline_value,
      COUNT(o.id) FILTER (
        WHERE o.stage NOT IN ('Closed Won', 'Closed Lost', 'Cancelled')
      )::int AS deals_in_progress,
      COUNT(o.id) FILTER (WHERE o.stage = 'Closed Won')::int AS won,
      COUNT(o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost'))::int AS closed_total,
      COALESCE(AVG(o.amount) FILTER (WHERE o.stage = 'Closed Won'), 0)::numeric AS avg_deal
    FROM users u
    LEFT JOIN opportunities o
      ON o.owner_id = u.id
      AND o.tenant_id = p_tenant_id
    WHERE u.id = ANY(p_user_ids)
    GROUP BY u.id, u.first_name, u.last_name, u.email
  ),
  activities_this_week AS (
    SELECT
      a.user_id,
      COUNT(*)::int AS count
    FROM activities a
    WHERE a.tenant_id = p_tenant_id
      AND a.user_id = ANY(p_user_ids)
      AND a.activity_date >= DATE_TRUNC('week', CURRENT_DATE)
    GROUP BY a.user_id
  ),
  quota_month AS (
    SELECT q.user_id, q.quota_amount
    FROM quotas q
    WHERE q.user_id = ANY(p_user_ids)
      AND q.quota_period = 'monthly'
      AND q.quota_year = EXTRACT(YEAR FROM CURRENT_DATE)
      AND q.quota_month = EXTRACT(MONTH FROM CURRENT_DATE)
  ),
  month_revenue AS (
    SELECT o.owner_id AS user_id, COALESCE(SUM(o.amount), 0) AS revenue
    FROM opportunities o
    WHERE o.tenant_id = p_tenant_id
      AND o.owner_id = ANY(p_user_ids)
      AND o.stage = 'Closed Won'
      AND o.close_date >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY o.owner_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'userId', r.user_id,
        'userName', r.user_name,
        'pipelineValue', r.pipeline_value,
        'dealsInProgress', r.deals_in_progress,
        'winRate',
          CASE WHEN r.closed_total > 0
            THEN round((r.won::numeric / r.closed_total * 100), 2)
            ELSE 0 END,
        'averageDealSize', round(r.avg_deal, 2),
        'activitiesThisWeek', COALESCE(aw.count, 0),
        'quotaAttainment',
          CASE WHEN COALESCE(qm.quota_amount, 0) > 0
            THEN round((COALESCE(mr.revenue, 0) / qm.quota_amount * 100)::numeric, 2)
            ELSE 0 END
      )
      ORDER BY r.pipeline_value DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM rep_stats r
  LEFT JOIN activities_this_week aw ON aw.user_id = r.user_id
  LEFT JOIN quota_month qm ON qm.user_id = r.user_id
  LEFT JOIN month_revenue mr ON mr.user_id = r.user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.report_sales_team_comparison(uuid, uuid[]) FROM PUBLIC;

COMMIT;
