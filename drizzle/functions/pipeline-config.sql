-- =============================================================================
-- Pipeline Configuration — analytics SQL functions
-- =============================================================================
-- Two group-by aggregation queries that the supabase-js client can't express
-- cleanly. Ports the analytics endpoints from the deleted Express
-- `routes-pipeline-configuration.ts` to .rpc()-callable functions.
--
--   public.pipeline_conversion_analytics(p_tenant_id, p_template_id?)
--     Stage-to-stage conversion counts + avg duration, grouped by
--     (from_stage, to_stage). Returns JSONB array.
--
--   public.pipeline_velocity_analytics(p_tenant_id, p_template_id?)
--     Per-stage velocity — avg/min/max duration and count of deals
--     transitioning INTO that stage. Returns JSONB array.
--
-- Both SECURITY INVOKER, tenant-scoped by explicit parameter.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pipeline_conversion_analytics(
  p_tenant_id text,
  p_template_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'fromStageId',   h.from_stage_id,
        'fromStageName', h.from_stage_name,
        'toStageId',     h.to_stage_id,
        'toStageName',   h.to_stage_name,
        'count',         COUNT(*),
        'avgDuration',   COALESCE(ROUND(AVG(h.duration_days)::numeric, 2), 0)
      ) AS row
      FROM deal_stage_history h
      WHERE h.tenant_id = p_tenant_id
        AND (
          p_template_id IS NULL
          OR EXISTS (
            SELECT 1 FROM pipeline_stages s
             WHERE s.id = h.to_stage_id
               AND s.pipeline_template_id = p_template_id
          )
        )
      GROUP BY h.from_stage_id, h.from_stage_name, h.to_stage_id, h.to_stage_name
    ) t;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.pipeline_conversion_analytics(text, text) IS
  'Stage-to-stage conversion counts + avg duration for a tenant, optionally scoped to a template.';

GRANT EXECUTE ON FUNCTION public.pipeline_conversion_analytics(text, text) TO authenticated, service_role;

-- ─── Velocity ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pipeline_velocity_analytics(
  p_tenant_id text,
  p_template_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'stageId',   h.to_stage_id,
        'stageName', h.to_stage_name,
        'avgDays',   COALESCE(ROUND(AVG(h.duration_days)::numeric, 2), 0),
        'minDays',   COALESCE(MIN(h.duration_days), 0),
        'maxDays',   COALESCE(MAX(h.duration_days), 0),
        'count',     COUNT(*)
      ) AS row
      FROM deal_stage_history h
      WHERE h.tenant_id = p_tenant_id
        AND (
          p_template_id IS NULL
          OR EXISTS (
            SELECT 1 FROM pipeline_stages s
             WHERE s.id = h.to_stage_id
               AND s.pipeline_template_id = p_template_id
          )
        )
      GROUP BY h.to_stage_id, h.to_stage_name
    ) t;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.pipeline_velocity_analytics(text, text) IS
  'Per-stage velocity (avg/min/max duration + count) for a tenant, optionally scoped to a template.';

GRANT EXECUTE ON FUNCTION public.pipeline_velocity_analytics(text, text) TO authenticated, service_role;
