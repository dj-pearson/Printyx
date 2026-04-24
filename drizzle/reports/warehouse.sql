-- ============================================================================
-- warehouse.sql — PL/pgSQL functions for warehouse-team reports.
--
-- Ports server/services/warehouse-reporting-service.ts (294 lines) to a
-- single SECURITY DEFINER function. Uses CTEs instead of the Express
-- service's multi-pass Array filtering.
--
-- Note on tenant_id type: warehouse_kitting_operations.tenant_id is
-- `varchar`, not `uuid` — the Express Drizzle schema declares it as
-- varchar. The edge function passes auth.tenantId (uuid::text) and this
-- function takes it as text to avoid casts.
--
-- Hierarchical access: the Express version used
-- HierarchicalQueryBuilder.getAccessibleUserIds() to scope to the caller's
-- team. We defer that logic to the edge function — the handler computes
-- accessible user ids and passes them here as p_technician_ids. When that
-- array is empty, the function filters to only the caller's own rows
-- (p_caller_id). When the array is present, it overrides.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.report_warehouse_team_quick_stats(
  p_tenant_id text,
  p_caller_id text,
  p_technician_ids text[] DEFAULT NULL,
  p_date_from timestamp DEFAULT NULL,
  p_date_to timestamp DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_from timestamp := COALESCE(p_date_from, NOW() - INTERVAL '30 days');
  v_date_to   timestamp := COALESCE(p_date_to, NOW());
  v_window_ms numeric;
  v_prev_from timestamp;

  -- Current-period aggregates
  v_total_kits int;
  v_completed int;
  v_in_progress int;
  v_rework int;
  v_first_pass int;
  v_passed int;
  v_total_minutes bigint;
  v_unique_techs int;
  v_active_techs int;

  -- Derived metrics
  v_fpy numeric;
  v_accuracy numeric;
  v_productivity numeric;
  v_quality_score numeric;

  -- Top technician
  v_top_tech text;
  v_techs_needing_support int;

  -- Previous-period aggregates for trend calc
  v_prev_completed int;
  v_prev_first_pass int;
  v_prev_passed int;
  v_prev_total_ops int;
  v_prev_minutes bigint;
  v_prev_fpy numeric;
  v_prev_accuracy numeric;
  v_prev_productivity numeric;

  -- Trend labels
  v_fpy_trend text;
  v_accuracy_trend text;
  v_productivity_trend text;

  v_scope_filter text;
BEGIN
  v_window_ms := EXTRACT(EPOCH FROM (v_date_to - v_date_from)) * 1000;
  v_prev_from := v_date_from - (v_date_to - v_date_from);

  -- Current period metrics (single pass).
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE operation_status = 'completed')::int,
    COUNT(*) FILTER (WHERE operation_status = 'in_progress')::int,
    COUNT(*) FILTER (WHERE rework_required = true)::int,
    COUNT(*) FILTER (WHERE first_pass_yield = true)::int,
    COUNT(*) FILTER (WHERE quality_status = 'pass')::int,
    COALESCE(SUM(total_duration_minutes), 0)::bigint,
    COUNT(DISTINCT assigned_technician)::int,
    COUNT(DISTINCT assigned_technician)
      FILTER (WHERE operation_status IN ('in_progress', 'completed'))::int
  INTO
    v_total_kits, v_completed, v_in_progress, v_rework,
    v_first_pass, v_passed, v_total_minutes,
    v_unique_techs, v_active_techs
  FROM warehouse_kitting_operations
  WHERE tenant_id = p_tenant_id
    AND created_at BETWEEN v_date_from AND v_date_to
    AND (
      -- Hierarchical scope: when p_technician_ids is NULL or empty, restrict
      -- to caller's own rows. Otherwise scope to the accessible set.
      -- Matches Express service's `accessibleUserIds.length > 0 ? inArray : FALSE`
      -- with "FALSE" softened to "caller-only" as a safer default.
      (
        (p_technician_ids IS NULL OR cardinality(p_technician_ids) = 0)
        AND assigned_technician = p_caller_id
      )
      OR (
        p_technician_ids IS NOT NULL AND cardinality(p_technician_ids) > 0
        AND assigned_technician = ANY(p_technician_ids)
      )
    );

  -- FPY = first_pass / completed (as percentage)
  v_fpy := CASE WHEN v_completed > 0 THEN (v_first_pass::numeric / v_completed) * 100 ELSE 0 END;
  v_accuracy := CASE WHEN v_total_kits > 0 THEN (v_passed::numeric / v_total_kits) * 100 ELSE 0 END;
  -- productivity = completed kits per hour
  v_productivity := CASE WHEN v_total_minutes > 0
    THEN v_completed::numeric / (v_total_minutes::numeric / 60)
    ELSE 0 END;
  -- quality_score = average of fpy + accuracy mapped to 1-5 scale
  v_quality_score := (v_fpy + v_accuracy) / 2 / 20;

  -- Top technician (highest FPY rate in current period)
  WITH tech_rollup AS (
    SELECT
      assigned_technician AS tech_id,
      COUNT(*) FILTER (WHERE operation_status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE first_pass_yield = true)::int AS fpy_count
    FROM warehouse_kitting_operations
    WHERE tenant_id = p_tenant_id
      AND created_at BETWEEN v_date_from AND v_date_to
      AND (
        (
          (p_technician_ids IS NULL OR cardinality(p_technician_ids) = 0)
          AND assigned_technician = p_caller_id
        )
        OR (
          p_technician_ids IS NOT NULL AND cardinality(p_technician_ids) > 0
          AND assigned_technician = ANY(p_technician_ids)
        )
      )
    GROUP BY assigned_technician
  ),
  tech_rates AS (
    SELECT
      tr.tech_id,
      CASE WHEN tr.completed > 0 THEN (tr.fpy_count::numeric / tr.completed) * 100 ELSE 0 END AS fpy_rate
    FROM tech_rollup tr
  )
  SELECT
    COALESCE(
      (SELECT u.name FROM tech_rates t
        LEFT JOIN users u ON u.id = t.tech_id
       ORDER BY t.fpy_rate DESC NULLS LAST LIMIT 1),
      'N/A'
    ),
    (SELECT COUNT(*) FROM tech_rates WHERE fpy_rate < 70)::int
  INTO v_top_tech, v_techs_needing_support;

  -- Previous-period metrics for trend calc.
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE operation_status = 'completed')::int,
    COUNT(*) FILTER (WHERE first_pass_yield = true)::int,
    COUNT(*) FILTER (WHERE quality_status = 'pass')::int,
    COALESCE(SUM(total_duration_minutes), 0)::bigint
  INTO
    v_prev_total_ops, v_prev_completed, v_prev_first_pass, v_prev_passed, v_prev_minutes
  FROM warehouse_kitting_operations
  WHERE tenant_id = p_tenant_id
    AND created_at BETWEEN v_prev_from AND v_date_from
    AND (
      (
        (p_technician_ids IS NULL OR cardinality(p_technician_ids) = 0)
        AND assigned_technician = p_caller_id
      )
      OR (
        p_technician_ids IS NOT NULL AND cardinality(p_technician_ids) > 0
        AND assigned_technician = ANY(p_technician_ids)
      )
    );

  v_prev_fpy := CASE WHEN v_prev_completed > 0
    THEN (v_prev_first_pass::numeric / v_prev_completed) * 100 ELSE 0 END;
  v_prev_accuracy := CASE WHEN v_prev_total_ops > 0
    THEN (v_prev_passed::numeric / v_prev_total_ops) * 100 ELSE 0 END;
  v_prev_productivity := CASE WHEN v_prev_minutes > 0
    THEN v_prev_completed::numeric / (v_prev_minutes::numeric / 60) ELSE 0 END;

  -- Trend labels (>5 point change = up/down, else stable) — matches Express
  v_fpy_trend := CASE
    WHEN v_fpy > v_prev_fpy + 5 THEN 'up'
    WHEN v_fpy < v_prev_fpy - 5 THEN 'down'
    ELSE 'stable' END;
  v_accuracy_trend := CASE
    WHEN v_accuracy > v_prev_accuracy + 5 THEN 'up'
    WHEN v_accuracy < v_prev_accuracy - 5 THEN 'down'
    ELSE 'stable' END;
  v_productivity_trend := CASE
    WHEN v_productivity > v_prev_productivity + 0.5 THEN 'up'
    WHEN v_productivity < v_prev_productivity - 0.5 THEN 'down'
    ELSE 'stable' END;

  RETURN jsonb_build_object(
    'performance', jsonb_build_object(
      'firstPassYield', round(v_fpy::numeric, 1),
      'accuracyRate', round(v_accuracy::numeric, 1),
      'productivity', round(v_productivity::numeric, 1),
      'qualityScore', round(v_quality_score::numeric, 2)
    ),
    'activity', jsonb_build_object(
      'totalKits', v_total_kits,
      'completedKits', v_completed,
      'inProgressKits', v_in_progress,
      'reworkRequired', v_rework
    ),
    'team', jsonb_build_object(
      'totalTechnicians', v_unique_techs,
      'activeTechnicians', v_active_techs,
      'topTechnician', v_top_tech,
      'techsNeedingSupport', v_techs_needing_support
    ),
    'trends', jsonb_build_object(
      'fpyTrend', v_fpy_trend,
      'accuracyTrend', v_accuracy_trend,
      'productivityTrend', v_productivity_trend
    )
  );
END;
$$;

COMMENT ON FUNCTION public.report_warehouse_team_quick_stats IS
  'Warehouse team FPY + activity + trends report. Caller must have operations.warehouse.view_team permission. Pass p_technician_ids with the hierarchy-accessible set; NULL / empty restricts to p_caller_id alone.';

REVOKE ALL ON FUNCTION public.report_warehouse_team_quick_stats(text, text, text[], timestamp, timestamp) FROM PUBLIC;

COMMIT;
