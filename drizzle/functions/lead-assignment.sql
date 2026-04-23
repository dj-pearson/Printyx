-- =============================================================================
-- Lead Assignment — transactional + counter helpers
-- =============================================================================
-- Three PL/pgSQL functions the edge `lead-assignment/` function relies on:
--
--   public.lead_assignment_bump_rep_load(tenant, user)
--     Increments current_active_leads + leads_assigned_today +
--     leads_assigned_this_week on rep_capacity atomically. Single UPDATE —
--     no read-modify-write race under concurrent routing.
--
--   public.lead_assignment_round_robin(tenant, rule_id)
--     Advances round_robin_config.currentIndex on a rule atomically and
--     returns the user id at that index. Used when assignment_type =
--     'round_robin'. Prevents double-assignment when multiple routing
--     workers hit the same rule at once.
--
--   public.lead_assignment_reset_counters()
--     Daily maintenance — resets leads_assigned_today to 0 for all rows.
--     Intended to be called by pg_cron in Phase 6 US-026. Safe to call
--     manually for now.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.lead_assignment_bump_rep_load(
  p_tenant_id text,
  p_user_id   text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_row record;
BEGIN
  UPDATE public.rep_capacity
     SET current_active_leads     = COALESCE(current_active_leads, 0) + 1,
         leads_assigned_today     = COALESCE(leads_assigned_today, 0) + 1,
         leads_assigned_this_week = COALESCE(leads_assigned_this_week, 0) + 1,
         updated_at               = now()
   WHERE tenant_id = p_tenant_id
     AND user_id   = p_user_id
  RETURNING id, current_active_leads, leads_assigned_today, leads_assigned_this_week
      INTO v_row;

  IF NOT FOUND THEN
    -- No capacity row yet — insert a starter row so counts are correct.
    INSERT INTO public.rep_capacity (
      tenant_id, user_id,
      current_active_leads, leads_assigned_today, leads_assigned_this_week,
      is_available
    )
    VALUES (p_tenant_id, p_user_id, 1, 1, 1, true)
    RETURNING id, current_active_leads, leads_assigned_today, leads_assigned_this_week
      INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id',                      v_row.id,
    'currentActiveLeads',      v_row.current_active_leads,
    'leadsAssignedToday',      v_row.leads_assigned_today,
    'leadsAssignedThisWeek',   v_row.leads_assigned_this_week
  );
END;
$$;

COMMENT ON FUNCTION public.lead_assignment_bump_rep_load(text, text) IS
  'Atomically bump rep_capacity counters after a new lead is routed.';

GRANT EXECUTE ON FUNCTION public.lead_assignment_bump_rep_load(text, text)
  TO authenticated, service_role;

-- ─── Round-robin anchor advance ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lead_assignment_round_robin(
  p_tenant_id text,
  p_rule_id   text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_config jsonb;
  v_user_ids jsonb;
  v_idx integer;
  v_size integer;
  v_next_idx integer;
  v_picked text;
BEGIN
  -- Lock + read the rule's round-robin config in one go.
  SELECT round_robin_config
    INTO v_config
    FROM public.lead_assignment_rules
   WHERE id = p_rule_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rule % not found for tenant %', p_rule_id, p_tenant_id
      USING ERRCODE = 'no_data_found';
  END IF;

  v_user_ids := COALESCE(v_config -> 'userIds', '[]'::jsonb);
  v_size := jsonb_array_length(v_user_ids);
  IF v_size = 0 THEN
    RAISE EXCEPTION 'Rule % has no round-robin users configured', p_rule_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_idx := COALESCE((v_config ->> 'currentIndex')::int, 0);
  IF v_idx < 0 OR v_idx >= v_size THEN v_idx := 0; END IF;

  v_picked := v_user_ids ->> v_idx;
  v_next_idx := (v_idx + 1) % v_size;

  UPDATE public.lead_assignment_rules
     SET round_robin_config = jsonb_set(
           COALESCE(round_robin_config, '{}'::jsonb),
           '{currentIndex}',
           to_jsonb(v_next_idx)
         ),
         last_assigned_at = now(),
         assignments_count = COALESCE(assignments_count, 0) + 1,
         updated_at = now()
   WHERE id = p_rule_id
     AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'userId',    v_picked,
    'index',     v_idx,
    'nextIndex', v_next_idx,
    'poolSize',  v_size
  );
END;
$$;

COMMENT ON FUNCTION public.lead_assignment_round_robin(text, text) IS
  'Atomically pick the next user in a round-robin rule and advance the pointer.';

GRANT EXECUTE ON FUNCTION public.lead_assignment_round_robin(text, text)
  TO authenticated, service_role;

-- ─── Daily counter reset ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lead_assignment_reset_counters()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Weekly reset on Mondays; daily reset every call.
  UPDATE public.rep_capacity
     SET leads_assigned_today = 0,
         leads_assigned_this_week =
           CASE WHEN EXTRACT(ISODOW FROM now()) = 1 THEN 0 ELSE leads_assigned_this_week END,
         last_reset_at = now(),
         updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.lead_assignment_reset_counters() IS
  'Zero the daily (and Monday weekly) counters on rep_capacity. Call via pg_cron.';

GRANT EXECUTE ON FUNCTION public.lead_assignment_reset_counters()
  TO authenticated, service_role;
