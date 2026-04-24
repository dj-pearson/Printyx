-- ============================================================================
-- service.sql — PL/pgSQL functions for service-technician persona reports.
--
-- Ports the core queries from server/services/service-reporting-service.ts
-- (665 lines). This pass ships 3 functions: personal calls, personal time,
-- team quick-stats. Parts usage / dispatch queue / single-call detail return
-- 501 from the handler until those ports land.
-- ============================================================================

BEGIN;

-- ─── report_service_personal_calls ────────────────────────────────────────
-- Rep's own service tickets + in-query summary.
-- Ports service-reporting-service.ts::getPersonalServiceCalls (lines 191-313).

CREATE OR REPLACE FUNCTION public.report_service_personal_calls(
  p_tenant_id uuid,
  p_user_id uuid,
  p_date_from timestamp DEFAULT NULL,
  p_date_to timestamp DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calls jsonb;
  v_total int;
  v_completed int;
  v_in_progress int;
  v_scheduled int;
  v_avg_duration numeric;
  v_ftf_rate numeric;
  v_avg_sat numeric;
  v_by_priority jsonb;
  v_by_category jsonb;
BEGIN
  -- Calls list (ordered by priority then scheduled date).
  WITH base AS (
    SELECT
      st.id,
      st.ticket_number,
      br.name AS customer_name,
      COALESCE(e.model_name, 'N/A') AS equipment_model,
      COALESCE(e.serial_number, 'N/A') AS serial_number,
      st.priority,
      st.status,
      st.scheduled_date,
      st.completed_at AS completed_date,
      COALESCE(
        EXTRACT(EPOCH FROM (st.completed_at - st.scheduled_date)) / 60, 0
      )::numeric AS duration,
      st.category,
      st.resolution_type,
      COALESCE(st.first_time_fix, false) AS first_time_fix,
      st.customer_satisfaction_rating
    FROM service_tickets st
    LEFT JOIN business_records br ON br.id = st.customer_id
    LEFT JOIN equipment e ON e.id = st.equipment_id
    WHERE st.assigned_technician_id = p_user_id
      AND st.tenant_id = p_tenant_id
      AND (p_date_from IS NULL OR st.created_at >= p_date_from)
      AND (p_date_to IS NULL OR st.created_at <= p_date_to)
      AND (p_status IS NULL OR st.status = p_status)
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'ticketId', id,
          'ticketNumber', ticket_number,
          'customerName', customer_name,
          'equipmentModel', equipment_model,
          'serialNumber', serial_number,
          'priority', priority,
          'status', status,
          'scheduledDate', scheduled_date,
          'completedDate', completed_date,
          'duration', round(duration, 2),
          'category', category,
          'resolutionType', resolution_type,
          'firstTimeFixRate', first_time_fix,
          'customerSatisfaction', customer_satisfaction_rating
        )
        ORDER BY
          CASE priority
            WHEN 'critical' THEN 1 WHEN 'high' THEN 2
            WHEN 'medium' THEN 3 WHEN 'low' THEN 4
            ELSE 5
          END,
          scheduled_date ASC NULLS LAST
      ),
      '[]'::jsonb
    ),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'completed')::int,
    COUNT(*) FILTER (WHERE status = 'in_progress')::int,
    COUNT(*) FILTER (WHERE status = 'scheduled')::int,
    COALESCE(AVG(duration) FILTER (WHERE status = 'completed' AND duration > 0), 0)::numeric,
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'completed' AND duration > 0) > 0
        THEN COUNT(*) FILTER (WHERE status = 'completed' AND first_time_fix)::numeric
             / COUNT(*) FILTER (WHERE status = 'completed' AND duration > 0) * 100
      ELSE 0
    END,
    COALESCE(AVG(customer_satisfaction_rating) FILTER (WHERE customer_satisfaction_rating IS NOT NULL), 0)::numeric
  INTO v_calls, v_total, v_completed, v_in_progress, v_scheduled,
       v_avg_duration, v_ftf_rate, v_avg_sat
  FROM base;

  -- Bucket rollups — simple object-shaped counts.
  SELECT
    COALESCE(jsonb_object_agg(priority, cnt), '{}'::jsonb)
  INTO v_by_priority
  FROM (
    SELECT st.priority, COUNT(*)::int AS cnt
    FROM service_tickets st
    WHERE st.assigned_technician_id = p_user_id
      AND st.tenant_id = p_tenant_id
      AND (p_date_from IS NULL OR st.created_at >= p_date_from)
      AND (p_date_to IS NULL OR st.created_at <= p_date_to)
      AND (p_status IS NULL OR st.status = p_status)
    GROUP BY st.priority
  ) p;

  SELECT
    COALESCE(jsonb_object_agg(category, cnt), '{}'::jsonb)
  INTO v_by_category
  FROM (
    SELECT st.category, COUNT(*)::int AS cnt
    FROM service_tickets st
    WHERE st.assigned_technician_id = p_user_id
      AND st.tenant_id = p_tenant_id
      AND (p_date_from IS NULL OR st.created_at >= p_date_from)
      AND (p_date_to IS NULL OR st.created_at <= p_date_to)
      AND (p_status IS NULL OR st.status = p_status)
    GROUP BY st.category
  ) c;

  RETURN jsonb_build_object(
    'calls', v_calls,
    'summary', jsonb_build_object(
      'totalCalls', v_total,
      'completed', v_completed,
      'inProgress', v_in_progress,
      'scheduled', v_scheduled,
      'averageDuration', round(v_avg_duration, 2),
      'firstTimeFixRate', round(v_ftf_rate, 2),
      'averageSatisfaction', round(v_avg_sat, 2),
      'callsByPriority', v_by_priority,
      'callsByCategory', v_by_category
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_service_personal_calls(uuid, uuid, timestamp, timestamp, text) FROM PUBLIC;

-- ─── report_service_personal_time ─────────────────────────────────────────
-- Time tracking entries + summary (billable vs non-billable, by activity).

CREATE OR REPLACE FUNCTION public.report_service_personal_time(
  p_tenant_id uuid,
  p_user_id uuid,
  p_date_from timestamp,
  p_date_to timestamp
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entries jsonb;
  v_total numeric;
  v_billable numeric;
  v_non_billable numeric;
  v_travel numeric;
  v_productive numeric;
  v_by_activity jsonb;
  v_by_day jsonb;
BEGIN
  -- Entries + aggregates in one sweep.
  WITH base AS (
    SELECT
      te.id,
      te.created_at::date AS entry_date,
      COALESCE(st.ticket_number, '') AS ticket_number,
      COALESCE(br.name, '') AS customer_name,
      te.activity_type,
      te.hours,
      te.billable,
      te.status,
      te.notes
    FROM time_entries te
    LEFT JOIN service_tickets st ON st.id = te.ticket_id
    LEFT JOIN business_records br ON br.id = st.customer_id
    WHERE te.user_id = p_user_id
      AND te.tenant_id = p_tenant_id
      AND te.created_at BETWEEN p_date_from AND p_date_to
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', entry_date,
          'ticketNumber', ticket_number,
          'customerName', customer_name,
          'activityType', activity_type,
          'hours', hours,
          'billable', billable,
          'status', status,
          'notes', notes
        )
        ORDER BY entry_date DESC
      ),
      '[]'::jsonb
    ),
    COALESCE(SUM(hours), 0)::numeric,
    COALESCE(SUM(hours) FILTER (WHERE billable = true), 0)::numeric,
    COALESCE(SUM(hours) FILTER (WHERE billable = false), 0)::numeric,
    COALESCE(SUM(hours) FILTER (WHERE activity_type = 'travel'), 0)::numeric,
    COALESCE(SUM(hours) FILTER (WHERE activity_type IN ('diagnostic', 'repair')), 0)::numeric
  INTO v_entries, v_total, v_billable, v_non_billable, v_travel, v_productive
  FROM base;

  -- Hours by activity_type.
  SELECT COALESCE(jsonb_object_agg(activity_type, hrs), '{}'::jsonb)
  INTO v_by_activity
  FROM (
    SELECT te.activity_type, COALESCE(SUM(te.hours), 0)::numeric AS hrs
    FROM time_entries te
    WHERE te.user_id = p_user_id
      AND te.tenant_id = p_tenant_id
      AND te.created_at BETWEEN p_date_from AND p_date_to
    GROUP BY te.activity_type
  ) a;

  -- Hours by day (ordered).
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('date', d, 'hours', hrs)
      ORDER BY d
    ),
    '[]'::jsonb
  )
  INTO v_by_day
  FROM (
    SELECT te.created_at::date AS d, COALESCE(SUM(te.hours), 0)::numeric AS hrs
    FROM time_entries te
    WHERE te.user_id = p_user_id
      AND te.tenant_id = p_tenant_id
      AND te.created_at BETWEEN p_date_from AND p_date_to
    GROUP BY te.created_at::date
  ) d;

  RETURN jsonb_build_object(
    'entries', v_entries,
    'summary', jsonb_build_object(
      'totalHours', round(v_total, 2),
      'billableHours', round(v_billable, 2),
      'nonBillableHours', round(v_non_billable, 2),
      'travelHours', round(v_travel, 2),
      'productiveHours', round(v_productive, 2),
      'utilizationRate',
        CASE WHEN v_total > 0
          THEN round((v_billable / v_total * 100)::numeric, 2)
          ELSE 0 END,
      'hoursByActivity', v_by_activity,
      'hoursByDay', v_by_day
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_service_personal_time(uuid, uuid, timestamp, timestamp) FROM PUBLIC;

-- ─── report_service_team_quick_stats ──────────────────────────────────────
-- Team-wide lightweight stats for embedded widgets. Caller supplies the
-- accessible tech IDs (same pattern as warehouse).

CREATE OR REPLACE FUNCTION public.report_service_team_quick_stats(
  p_tenant_id uuid,
  p_caller_id uuid,
  p_technician_ids uuid[] DEFAULT NULL,
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
  v_total_calls int;
  v_completed int;
  v_in_progress int;
  v_overdue int;
  v_ftf_rate numeric;
  v_avg_sat numeric;
  v_avg_duration numeric;
  v_unique_techs int;
  v_top_tech text;
BEGIN
  -- Core metrics.
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'completed')::int,
    COUNT(*) FILTER (WHERE status IN ('in_progress', 'scheduled'))::int,
    COUNT(*) FILTER (WHERE sla_status = 'overdue')::int,
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'completed') > 0
        THEN COUNT(*) FILTER (WHERE status = 'completed' AND first_time_fix)::numeric
             / COUNT(*) FILTER (WHERE status = 'completed') * 100
      ELSE 0
    END,
    COALESCE(AVG(customer_satisfaction_rating) FILTER (WHERE customer_satisfaction_rating IS NOT NULL), 0),
    COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - scheduled_date)) / 60)
             FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL), 0),
    COUNT(DISTINCT assigned_technician_id)::int
  INTO
    v_total_calls, v_completed, v_in_progress, v_overdue,
    v_ftf_rate, v_avg_sat, v_avg_duration, v_unique_techs
  FROM service_tickets
  WHERE tenant_id = p_tenant_id
    AND created_at BETWEEN v_date_from AND v_date_to
    AND (
      (
        (p_technician_ids IS NULL OR cardinality(p_technician_ids) = 0)
        AND assigned_technician_id = p_caller_id
      )
      OR (
        p_technician_ids IS NOT NULL AND cardinality(p_technician_ids) > 0
        AND assigned_technician_id = ANY(p_technician_ids)
      )
    );

  -- Top tech by FTF rate.
  SELECT COALESCE(
    NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
    u.email,
    u.id::text
  )
  INTO v_top_tech
  FROM (
    SELECT assigned_technician_id AS tech_id,
      CASE
        WHEN COUNT(*) FILTER (WHERE status = 'completed') > 0
          THEN COUNT(*) FILTER (WHERE status = 'completed' AND first_time_fix)::numeric
               / COUNT(*) FILTER (WHERE status = 'completed') * 100
        ELSE 0
      END AS ftf
    FROM service_tickets
    WHERE tenant_id = p_tenant_id
      AND created_at BETWEEN v_date_from AND v_date_to
      AND (
        (
          (p_technician_ids IS NULL OR cardinality(p_technician_ids) = 0)
          AND assigned_technician_id = p_caller_id
        )
        OR (
          p_technician_ids IS NOT NULL AND cardinality(p_technician_ids) > 0
          AND assigned_technician_id = ANY(p_technician_ids)
        )
      )
    GROUP BY assigned_technician_id
    ORDER BY ftf DESC NULLS LAST
    LIMIT 1
  ) top
  LEFT JOIN users u ON u.id = top.tech_id;

  RETURN jsonb_build_object(
    'activity', jsonb_build_object(
      'totalCalls', v_total_calls,
      'completed', v_completed,
      'inProgress', v_in_progress,
      'overdue', v_overdue
    ),
    'performance', jsonb_build_object(
      'firstTimeFixRate', round(v_ftf_rate::numeric, 1),
      'averageSatisfaction', round(v_avg_sat::numeric, 2),
      'averageDurationMinutes', round(v_avg_duration::numeric, 1)
    ),
    'team', jsonb_build_object(
      'totalTechnicians', v_unique_techs,
      'topTechnician', COALESCE(v_top_tech, 'N/A')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_service_team_quick_stats(uuid, uuid, uuid[], timestamp, timestamp) FROM PUBLIC;

COMMIT;
