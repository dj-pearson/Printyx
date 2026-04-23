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

-- =============================================================================
-- Transactional multi-step ops
-- =============================================================================
-- supabase-js has no client-side transactions. These PL/pgSQL functions wrap
-- the three multi-step writes the edge function needs so a partial failure
-- rolls back the whole op.
--
--   public.pipeline_stages_reorder(p_tenant_id, p_stages jsonb)
--     Bulk update of `order` across many stages. One UPDATE, atomic.
--
--   public.pipeline_template_clone(p_tenant_id, p_source_id, p_new_name)
--     Deep copy template + all its stages. Rolls back on any failure.
--
--   public.pipeline_deal_transition(p_tenant_id, p_deal_id, p_to_stage_id,
--                                   p_changed_by, p_change_reason)
--     Writes history row + updates the deal + (best-effort) inserts any
--     on_enter automation log rows. All under one transaction frame.
-- =============================================================================

-- ─── Reorder ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pipeline_stages_reorder(
  p_tenant_id text,
  p_stages jsonb  -- [{ "id": "...", "order": N }, ...]
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_stages IS NULL OR jsonb_typeof(p_stages) <> 'array' THEN
    RAISE EXCEPTION 'p_stages must be a JSON array';
  END IF;

  UPDATE public.pipeline_stages AS s
     SET "order" = (v.ord)::integer,
         updated_at = now()
    FROM (
      SELECT (elem->>'id')::text AS id,
             COALESCE(elem->>'order', elem->>'ord')::int AS ord
        FROM jsonb_array_elements(p_stages) AS elem
    ) AS v
   WHERE s.id = v.id
     AND s.tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.pipeline_stages_reorder(text, jsonb) IS
  'Bulk-update the `order` column across many pipeline_stages atomically.';

GRANT EXECUTE ON FUNCTION public.pipeline_stages_reorder(text, jsonb) TO authenticated, service_role;

-- ─── Clone template ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pipeline_template_clone(
  p_tenant_id text,
  p_source_id text,
  p_new_name text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_name          text;
  v_source_pipeline_type text;
  v_new_id text;
  v_stages jsonb;
  v_template jsonb;
BEGIN
  SELECT name, pipeline_type
    INTO v_source_name, v_source_pipeline_type
    FROM public.pipeline_templates
   WHERE id = p_source_id
     AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source template % not found for tenant %', p_source_id, p_tenant_id
      USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.pipeline_templates (
    tenant_id, name, description, pipeline_type, is_default, is_active
  )
  VALUES (
    p_tenant_id,
    p_new_name,
    'Cloned from ' || v_source_name,
    v_source_pipeline_type,
    false,
    true
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.pipeline_stages (
    tenant_id, pipeline_template_id, name, display_name, description,
    "order", color, icon, stage_type, is_final_stage, automation_triggers,
    required_fields, sla_enabled, sla_days, default_probability,
    allowed_transitions
  )
  SELECT
    p_tenant_id, v_new_id, name, display_name, description,
    "order", color, icon, stage_type, is_final_stage, automation_triggers,
    required_fields, sla_enabled, sla_days, default_probability,
    allowed_transitions
  FROM public.pipeline_stages
  WHERE pipeline_template_id = p_source_id
    AND tenant_id = p_tenant_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s."order"), '[]'::jsonb)
    INTO v_stages
    FROM public.pipeline_stages s
   WHERE s.pipeline_template_id = v_new_id;

  SELECT to_jsonb(t)
    INTO v_template
    FROM public.pipeline_templates t
   WHERE t.id = v_new_id;

  RETURN jsonb_build_object(
    'template', v_template,
    'stages',   v_stages
  );
END;
$$;

COMMENT ON FUNCTION public.pipeline_template_clone(text, text, text) IS
  'Deep-copy a pipeline_templates row and all its pipeline_stages in one transaction.';

GRANT EXECUTE ON FUNCTION public.pipeline_template_clone(text, text, text) TO authenticated, service_role;

-- ─── Deal stage transition ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pipeline_deal_transition(
  p_tenant_id text,
  p_deal_id text,
  p_to_stage_id text,
  p_changed_by text,
  p_change_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_stage_id       text;
  v_from_stage_name     text;
  v_to_name             text;
  v_to_display_name     text;
  v_to_default_prob     integer;
  v_to_sla_enabled      boolean;
  v_to_sla_days         integer;
  v_to_automation       jsonb;
  v_base_time           timestamp;
  v_days_prev           integer;
  v_sla_deadline        timestamp;
  v_automations_logged  integer := 0;
  v_trigger             jsonb;
BEGIN
  -- Load deal (tenant-scoped)
  SELECT current_stage_id,
         COALESCE(updated_at, created_at)
    INTO v_from_stage_id, v_base_time
    FROM public.deals
   WHERE id = p_deal_id
     AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal % not found for tenant %', p_deal_id, p_tenant_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Resolve stage names
  IF v_from_stage_id IS NOT NULL THEN
    SELECT display_name
      INTO v_from_stage_name
      FROM public.pipeline_stages
     WHERE id = v_from_stage_id;
  END IF;

  SELECT name, display_name, default_probability,
         sla_enabled, sla_days, automation_triggers
    INTO v_to_name, v_to_display_name, v_to_default_prob,
         v_to_sla_enabled, v_to_sla_days, v_to_automation
    FROM public.pipeline_stages
   WHERE id = p_to_stage_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target stage % not found', p_to_stage_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- History row (matches actual table columns — NOT the drifted names the
  -- old edge handler was inserting)
  v_days_prev := CASE
    WHEN v_from_stage_id IS NULL THEN 0
    ELSE GREATEST(0, EXTRACT(DAY FROM (now() - v_base_time))::int)
  END;

  INSERT INTO public.deal_stage_history (
    tenant_id, deal_id,
    from_stage_id, from_stage_name,
    to_stage_id, to_stage_name,
    changed_by, change_reason,
    was_automatic, days_in_previous_stage,
    entered_at
  )
  VALUES (
    p_tenant_id, p_deal_id,
    v_from_stage_id, v_from_stage_name,
    p_to_stage_id, v_to_display_name,
    p_changed_by, p_change_reason,
    false, v_days_prev,
    now()
  );

  -- Deal update
  IF v_to_sla_enabled AND v_to_sla_days IS NOT NULL THEN
    v_sla_deadline := now() + make_interval(days => v_to_sla_days);
  END IF;

  UPDATE public.deals
     SET current_stage_id = p_to_stage_id,
         stage            = v_to_name,
         probability      = v_to_default_prob,
         sla_deadline     = COALESCE(v_sla_deadline, sla_deadline),
         updated_at       = now()
   WHERE id = p_deal_id
     AND tenant_id = p_tenant_id;

  -- Automation log for on_enter triggers (actual execution is still handled
  -- by a separate cron/worker — we just enqueue pending rows here)
  IF v_to_automation IS NOT NULL
     AND jsonb_typeof(v_to_automation) = 'array'
  THEN
    FOR v_trigger IN SELECT * FROM jsonb_array_elements(v_to_automation)
    LOOP
      IF v_trigger->>'triggerType' = 'on_enter'
         AND COALESCE((v_trigger->>'isActive')::boolean, false)
      THEN
        INSERT INTO public.pipeline_automation_logs (
          tenant_id, deal_id, stage_id,
          trigger_type, action_type, action_config,
          status
        )
        VALUES (
          p_tenant_id, p_deal_id, p_to_stage_id,
          v_trigger->>'triggerType',
          v_trigger->>'actionType',
          v_trigger->'actionConfig',
          'pending'
        );
        v_automations_logged := v_automations_logged + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'dealId',             p_deal_id,
    'fromStageId',        v_from_stage_id,
    'toStageId',          p_to_stage_id,
    'daysInPreviousStage', v_days_prev,
    'automationsLogged',  v_automations_logged,
    'slaDeadline',        v_sla_deadline
  );
END;
$$;

COMMENT ON FUNCTION public.pipeline_deal_transition(text, text, text, text, text) IS
  'Move a deal to a new stage: history + deal update + automation log — atomic.';

GRANT EXECUTE ON FUNCTION public.pipeline_deal_transition(text, text, text, text, text) TO authenticated, service_role;
