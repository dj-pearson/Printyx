-- =============================================================================
-- Dashboard Widget Data Function
-- =============================================================================
-- Centralizes the 34 dashboard widget data queries in one PL/pgSQL function so
-- the edge function (supabase/functions/dashboard-widgets) can dispatch with a
-- single .rpc() call. Ports server/routes-dashboard-widgets.ts getWidgetData.
--
-- The function is SECURITY INVOKER (default). When called via the service-role
-- key (as the edge function does), RLS is bypassed; tenant isolation is
-- enforced by the explicit p_tenant_id parameter on every query — NEVER trust
-- the JWT inside this function, always pass tenant_id from the edge handler.
--
-- Return shape: jsonb that matches the Express response shape per widget_key.
-- Unknown widget_key returns `{"value": "—", "subtitle": "Widget data not configured"}`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.dashboard_widget_data(
  p_widget_key text,
  p_tenant_id  text,
  p_user_id    text DEFAULT NULL,
  p_role_code  text DEFAULT NULL,
  p_role_level integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_of_month      timestamp := date_trunc('month', now());
  v_start_of_last_month timestamp := date_trunc('month', now() - interval '1 month');
  v_end_of_last_month   timestamp := date_trunc('month', now());
  v_today               date      := current_date;
  v_thirty_days_ahead   timestamp := now() + interval '30 days';
  v_current_num         numeric;
  v_previous_num        numeric;
  v_pct_change          integer;
  v_count_a             integer;
  v_count_b             integer;
  v_rate                integer;
  v_total               numeric;
  v_items               jsonb;
  v_month_points        jsonb;
  v_month_label         text;
  v_month_start         timestamp;
  v_month_end           timestamp;
BEGIN
  CASE p_widget_key

  -- ── SALES ──────────────────────────────────────────────────────────────────

  WHEN 'my-revenue' THEN
    SELECT COALESCE(SUM(total_amount::numeric), 0) INTO v_current_num
      FROM invoices
     WHERE tenant_id = p_tenant_id AND created_at >= v_start_of_month;
    SELECT COALESCE(SUM(total_amount::numeric), 0) INTO v_previous_num
      FROM invoices
     WHERE tenant_id = p_tenant_id
       AND created_at >= v_start_of_last_month
       AND created_at <  v_start_of_month;
    v_pct_change := CASE WHEN v_previous_num > 0
      THEN ROUND(((v_current_num - v_previous_num) / v_previous_num) * 100)::int
      ELSE 0 END;
    RETURN jsonb_build_object(
      'value',       '$' || to_char(v_current_num, 'FM999,999,999,999'),
      'change',      v_pct_change,
      'changeLabel', 'vs last month',
      'subtitle',    'This month'
    );

  WHEN 'my-deals' THEN
    SELECT COUNT(*) INTO v_count_a FROM deals
     WHERE tenant_id = p_tenant_id
       AND status NOT IN ('won', 'lost', 'cancelled');
    RETURN jsonb_build_object('value', COALESCE(v_count_a, 0), 'subtitle', 'Active opportunities');

  WHEN 'my-leads' THEN
    SELECT COUNT(*) INTO v_count_a FROM business_records
     WHERE tenant_id = p_tenant_id AND record_type = 'lead';
    RETURN jsonb_build_object('value', COALESCE(v_count_a, 0), 'subtitle', 'Active prospects');

  WHEN 'my-quotes' THEN
    SELECT COUNT(*) INTO v_count_a FROM deals
     WHERE tenant_id = p_tenant_id
       AND status IN ('proposal', 'quote_sent', 'negotiation');
    RETURN jsonb_build_object('value', COALESCE(v_count_a, 0), 'subtitle', 'Awaiting response');

  WHEN 'win-rate' THEN
    SELECT COUNT(*) INTO v_count_a FROM deals
     WHERE tenant_id = p_tenant_id
       AND status = 'won'
       AND created_at >= v_start_of_month;
    SELECT COUNT(*) INTO v_count_b FROM deals
     WHERE tenant_id = p_tenant_id
       AND status IN ('won', 'lost')
       AND created_at >= v_start_of_month;
    v_rate := CASE WHEN v_count_b > 0
      THEN ROUND((v_count_a::numeric / v_count_b::numeric) * 100)::int ELSE 0 END;
    RETURN jsonb_build_object(
      'value', v_rate, 'max', 100,
      'displayValue', v_rate || '%',
      'suffix', '%',
      'subtitle', 'This month'
    );

  WHEN 'deal-pipeline' THEN
    SELECT jsonb_agg(stage ORDER BY stage_order)
      INTO v_items
      FROM (
        SELECT
          s.stage_order,
          jsonb_build_object(
            'name',  s.name,
            'count', COALESCE(agg.cnt, 0),
            'value', COALESCE(agg.amt, 0)
          ) AS stage
        FROM (VALUES
          (1, 'New Lead',    'new_lead'),
          (2, 'Qualified',   'qualified'),
          (3, 'Proposal',    'proposal'),
          (4, 'Negotiation', 'negotiation'),
          (5, 'Closing',     'closing')
        ) AS s(stage_order, name, key)
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt, COALESCE(SUM(amount::numeric), 0) AS amt
            FROM deals d
           WHERE d.tenant_id = p_tenant_id AND lower(d.status) = s.key
        ) agg ON TRUE
      ) pipeline;
    RETURN jsonb_build_object('stages', COALESCE(v_items, '[]'::jsonb));

  WHEN 'sales-leaderboard' THEN
    SELECT jsonb_agg(member)
      INTO v_items
      FROM (
        SELECT jsonb_build_object(
          'id',       ROW_NUMBER() OVER (ORDER BY total DESC)::text,
          'name',     COALESCE(NULLIF(name, ''), 'Unknown'),
          'value',    '$' || to_char(total, 'FM999,999,999,999'),
          'subtitle', 'This month'
        ) AS member
        FROM (
          SELECT
            COALESCE(u.first_name || ' ' || u.last_name, u.email) AS name,
            COALESCE(SUM(i.total_amount::numeric), 0)             AS total
          FROM invoices i
          JOIN users u ON u.id = i.created_by
          WHERE i.tenant_id = p_tenant_id AND i.created_at >= v_start_of_month
          GROUP BY u.id, u.first_name, u.last_name, u.email
          ORDER BY total DESC
          LIMIT 8
        ) t
      ) s;
    RETURN jsonb_build_object('members', COALESCE(v_items, '[]'::jsonb));

  WHEN 'follow-ups-today' THEN
    SELECT jsonb_agg(item)
      INTO v_items
      FROM (
        SELECT jsonb_build_object(
          'id',       id,
          'title',    COALESCE(company_name, first_name || ' ' || last_name, 'Contact'),
          'subtitle', 'Follow up scheduled today',
          'priority', COALESCE(priority, 'medium'),
          'href',     '/customers/' || id
        ) AS item
        FROM business_records
        WHERE tenant_id = p_tenant_id
          AND next_follow_up_date::date = v_today
        ORDER BY priority DESC NULLS LAST
        LIMIT 10
      ) s;
    RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));

  -- ── SERVICE ────────────────────────────────────────────────────────────────

  WHEN 'my-tickets' THEN
    SELECT COUNT(*) INTO v_count_a FROM service_tickets
     WHERE tenant_id = p_tenant_id
       AND status IN ('open', 'in_progress', 'dispatched');
    RETURN jsonb_build_object('value', COALESCE(v_count_a, 0), 'subtitle', 'Open tickets');

  WHEN 'emergency-tickets' THEN
    SELECT COUNT(*) INTO v_count_a FROM service_tickets
     WHERE tenant_id = p_tenant_id
       AND priority = 'critical'
       AND status NOT IN ('resolved', 'closed', 'cancelled');
    RETURN jsonb_build_object('value', COALESCE(v_count_a, 0), 'subtitle', 'Needs immediate attention');

  WHEN 'todays-schedule' THEN
    SELECT jsonb_agg(item)
      INTO v_items
      FROM (
        SELECT jsonb_build_object(
          'id',       st.id,
          'title',    COALESCE(st.title, 'Service Call'),
          'subtitle', COALESCE(br.company_name, 'Unknown customer'),
          'priority', COALESCE(st.priority, 'medium'),
          'href',     '/service-hub/' || st.id
        ) AS item
        FROM service_tickets st
        LEFT JOIN business_records br ON br.id = st.customer_id
        WHERE st.tenant_id = p_tenant_id
          AND st.scheduled_date::date = v_today
          AND st.status NOT IN ('resolved', 'closed', 'cancelled')
        ORDER BY st.scheduled_date
        LIMIT 8
      ) s;
    RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));

  WHEN 'technician-status' THEN
    SELECT jsonb_agg(row)
      INTO v_items
      FROM (
        SELECT jsonb_build_object(
          'id',          id,
          'name',        COALESCE(first_name || ' ' || last_name, email, 'Unknown'),
          'status',      'available',
          'statusLabel', 'Available',
          'detail',      ''
        ) AS row
        FROM users
        WHERE tenant_id = p_tenant_id AND is_active = true
        LIMIT 10
      ) s;
    RETURN jsonb_build_object('rows', COALESCE(v_items, '[]'::jsonb));

  WHEN 'avg-response-time' THEN
    -- Placeholder: no historic response_time tracking wired up yet
    RETURN jsonb_build_object(
      'value',       '1.8',
      'suffix',      ' hrs',
      'displayValue','1.8 hrs',
      'subtitle',    'Average this month',
      'change',      -12,
      'changeLabel', 'vs last month'
    );

  WHEN 'sla-compliance' THEN
    SELECT COUNT(*) INTO v_count_b FROM service_tickets
     WHERE tenant_id = p_tenant_id AND created_at >= v_start_of_month;
    SELECT COUNT(*) INTO v_count_a FROM service_tickets
     WHERE tenant_id = p_tenant_id
       AND created_at >= v_start_of_month
       AND status IN ('resolved', 'closed');
    v_rate := CASE WHEN v_count_b > 0
      THEN ROUND((v_count_a::numeric / v_count_b::numeric) * 100)::int ELSE 0 END;
    RETURN jsonb_build_object(
      'value', v_rate, 'max', 100,
      'displayValue', v_rate || '%',
      'suffix', '%',
      'subtitle', 'This month'
    );

  WHEN 'completion-rate' THEN
    SELECT COUNT(*) INTO v_count_b FROM service_tickets
     WHERE tenant_id = p_tenant_id AND created_at >= v_start_of_month;
    SELECT COUNT(*) INTO v_count_a FROM service_tickets
     WHERE tenant_id = p_tenant_id
       AND created_at >= v_start_of_month
       AND status IN ('resolved', 'closed', 'completed');
    v_rate := CASE WHEN v_count_b > 0
      THEN ROUND((v_count_a::numeric / v_count_b::numeric) * 100)::int ELSE 0 END;
    RETURN jsonb_build_object(
      'value',    v_rate || '%',
      'subtitle', v_count_a || ' of ' || v_count_b || ' this month',
      'progress', v_rate
    );

  -- ── FINANCE ────────────────────────────────────────────────────────────────

  WHEN 'monthly-revenue' THEN
    SELECT COALESCE(SUM(total_amount::numeric), 0) INTO v_current_num
      FROM invoices
     WHERE tenant_id = p_tenant_id AND created_at >= v_start_of_month;
    SELECT COALESCE(SUM(total_amount::numeric), 0) INTO v_previous_num
      FROM invoices
     WHERE tenant_id = p_tenant_id
       AND created_at >= v_start_of_last_month
       AND created_at <  v_start_of_month;
    v_pct_change := CASE WHEN v_previous_num > 0
      THEN ROUND(((v_current_num - v_previous_num) / v_previous_num) * 100)::int
      ELSE 0 END;
    RETURN jsonb_build_object(
      'value',       '$' || to_char(v_current_num, 'FM999,999,999,999'),
      'change',      v_pct_change,
      'changeLabel', 'vs last month'
    );

  WHEN 'outstanding-invoices' THEN
    SELECT COALESCE(SUM(balance_due::numeric), 0), COUNT(*) INTO v_total, v_count_a
      FROM invoices
     WHERE tenant_id = p_tenant_id AND invoice_status IN ('open', 'partial');
    RETURN jsonb_build_object(
      'value',    '$' || to_char(v_total, 'FM999,999,999,999'),
      'subtitle', v_count_a || ' invoices'
    );

  WHEN 'overdue-invoices' THEN
    SELECT COALESCE(SUM(balance_due::numeric), 0), COUNT(*) INTO v_total, v_count_a
      FROM invoices
     WHERE tenant_id = p_tenant_id AND invoice_status = 'overdue';
    RETURN jsonb_build_object(
      'value',    '$' || to_char(v_total, 'FM999,999,999,999'),
      'subtitle', v_count_a || ' overdue'
    );

  WHEN 'revenue-trend' THEN
    SELECT jsonb_agg(point ORDER BY ord)
      INTO v_month_points
      FROM (
        SELECT
          i AS ord,
          jsonb_build_object(
            'label',        to_char(date_trunc('month', now() - (interval '1 month' * (5 - i))), 'Mon'),
            'value',        COALESCE(m.total, 0),
            'displayValue', '$' || to_char(COALESCE(m.total, 0), 'FM999,999,999,999')
          ) AS point
        FROM generate_series(0, 5) AS i
        LEFT JOIN LATERAL (
          SELECT SUM(total_amount::numeric) AS total
            FROM invoices
           WHERE tenant_id = p_tenant_id
             AND created_at >= date_trunc('month', now() - (interval '1 month' * (5 - i)))
             AND created_at <  date_trunc('month', now() - (interval '1 month' * (5 - i)) + interval '1 month')
        ) m ON TRUE
      ) t;
    RETURN jsonb_build_object('points', COALESCE(v_month_points, '[]'::jsonb));

  WHEN 'collections-rate' THEN
    SELECT COALESCE(SUM(total_amount::numeric), 0) INTO v_previous_num
      FROM invoices
     WHERE tenant_id = p_tenant_id AND created_at >= v_start_of_month;
    SELECT COALESCE(SUM(amount_paid::numeric), 0) INTO v_current_num
      FROM invoices
     WHERE tenant_id = p_tenant_id AND created_at >= v_start_of_month;
    v_rate := CASE WHEN v_previous_num > 0
      THEN ROUND((v_current_num / v_previous_num) * 100)::int ELSE 0 END;
    RETURN jsonb_build_object(
      'value', v_rate, 'max', 100,
      'displayValue', v_rate || '%',
      'suffix', '%',
      'subtitle', 'Collected on time'
    );

  -- ── OPERATIONS ─────────────────────────────────────────────────────────────

  WHEN 'active-contracts' THEN
    SELECT COUNT(*) INTO v_count_a FROM contracts
     WHERE tenant_id = p_tenant_id AND status = 'active';
    RETURN jsonb_build_object('value', COALESCE(v_count_a, 0), 'subtitle', 'Currently active');

  WHEN 'expiring-contracts' THEN
    SELECT jsonb_agg(item)
      INTO v_items
      FROM (
        SELECT jsonb_build_object(
          'id',       c.id,
          'title',    COALESCE(br.company_name, 'Unknown'),
          'subtitle', 'Expires ' || to_char(c.end_date, 'FMMon DD, YYYY'),
          'priority', 'high',
          'badge',    CASE WHEN c.monthly_base IS NOT NULL
                           THEN '$' || to_char(c.monthly_base::numeric, 'FM999,999,999') || '/mo'
                      END,
          'href',     '/contracts/' || c.id
        ) AS item
        FROM contracts c
        LEFT JOIN business_records br ON br.id = c.customer_id
        WHERE c.tenant_id = p_tenant_id
          AND c.status = 'active'
          AND c.end_date >= now()
          AND c.end_date <= v_thirty_days_ahead
        ORDER BY c.end_date
        LIMIT 8
      ) s;
    RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));

  WHEN 'equipment-status' THEN
    -- Placeholder distribution until equipment lifecycle counts are wired up
    RETURN jsonb_build_object('points', jsonb_build_array(
      jsonb_build_object('label', 'Active',  'value', 85, 'displayValue', '85'),
      jsonb_build_object('label', 'Maint.',  'value', 12, 'displayValue', '12'),
      jsonb_build_object('label', 'Retired', 'value', 8,  'displayValue', '8'),
      jsonb_build_object('label', 'Pending', 'value', 5,  'displayValue', '5')
    ));

  WHEN 'low-stock-alerts' THEN
    SELECT COUNT(*) INTO v_count_a FROM inventory_items
     WHERE tenant_id = p_tenant_id AND quantity_on_hand <= reorder_point;
    RETURN jsonb_build_object('value', COALESCE(v_count_a, 0), 'subtitle', 'Items below threshold');

  -- ── TEAM ───────────────────────────────────────────────────────────────────

  WHEN 'team-performance' THEN
    -- Placeholder performance score until real metrics are wired up
    SELECT jsonb_agg(member)
      INTO v_items
      FROM (
        SELECT jsonb_build_object(
          'id',       id,
          'name',     COALESCE(first_name || ' ' || last_name, email, 'Team Member'),
          'value',    (70 + floor(random() * 30)::int) || '%',
          'subtitle', 'Performance score'
        ) AS member
        FROM users
        WHERE tenant_id = p_tenant_id AND is_active = true
        LIMIT 8
      ) s;
    RETURN jsonb_build_object('members', COALESCE(v_items, '[]'::jsonb));

  WHEN 'team-activity' THEN
    RETURN jsonb_build_object('activities', '[]'::jsonb);

  WHEN 'total-customers' THEN
    SELECT COUNT(*) INTO v_count_a FROM business_records
     WHERE tenant_id = p_tenant_id AND record_type = 'customer';
    RETURN jsonb_build_object('value', COALESCE(v_count_a, 0), 'subtitle', 'Company-wide');

  -- ── TASKS ──────────────────────────────────────────────────────────────────

  WHEN 'my-tasks' THEN
    SELECT jsonb_agg(item)
      INTO v_items
      FROM (
        SELECT jsonb_build_object(
          'id',       id,
          'title',    COALESCE(company_name, 'Task'),
          'subtitle', 'Pending',
          'priority', 'medium'
        ) AS item
        FROM business_records
        WHERE tenant_id = p_tenant_id AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 8
      ) s;
    RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));

  WHEN 'upcoming-events' THEN
    RETURN jsonb_build_object('items', '[]'::jsonb);

  WHEN 'recent-activity' THEN
    RETURN jsonb_build_object('activities', '[]'::jsonb);

  -- ── ANALYTICS ──────────────────────────────────────────────────────────────

  WHEN 'business-overview' THEN
    SELECT COUNT(*) INTO v_count_a FROM business_records
     WHERE tenant_id = p_tenant_id AND record_type = 'customer';
    SELECT COUNT(*) INTO v_count_b FROM contracts
     WHERE tenant_id = p_tenant_id AND status = 'active';
    SELECT COALESCE(SUM(total_amount::numeric), 0) INTO v_total
      FROM invoices
     WHERE tenant_id = p_tenant_id AND created_at >= v_start_of_month;
    SELECT COUNT(*) INTO v_pct_change FROM service_tickets
     WHERE tenant_id = p_tenant_id AND status IN ('open', 'in_progress');
    RETURN jsonb_build_object(
      'customers',       COALESCE(v_count_a, 0),
      'activeContracts', COALESCE(v_count_b, 0),
      'monthlyRevenue',  COALESCE(v_total, 0),
      'openTickets',     COALESCE(v_pct_change, 0)
    );

  WHEN 'customer-growth' THEN
    SELECT jsonb_agg(point ORDER BY ord)
      INTO v_month_points
      FROM (
        SELECT
          i AS ord,
          jsonb_build_object(
            'label',        to_char(date_trunc('month', now() - (interval '1 month' * (5 - i))), 'Mon'),
            'value',        COALESCE(m.cnt, 0),
            'displayValue', COALESCE(m.cnt, 0)::text
          ) AS point
        FROM generate_series(0, 5) AS i
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt
            FROM business_records
           WHERE tenant_id = p_tenant_id
             AND record_type = 'customer'
             AND created_at >= date_trunc('month', now() - (interval '1 month' * (5 - i)))
             AND created_at <  date_trunc('month', now() - (interval '1 month' * (5 - i)) + interval '1 month')
        ) m ON TRUE
      ) t;
    RETURN jsonb_build_object('points', COALESCE(v_month_points, '[]'::jsonb));

  WHEN 'mrr-tracker' THEN
    SELECT COALESCE(SUM(monthly_base::numeric), 0) INTO v_total
      FROM contracts
     WHERE tenant_id = p_tenant_id AND status = 'active';
    RETURN jsonb_build_object(
      'value',       '$' || to_char(v_total, 'FM999,999,999,999'),
      'subtitle',    'Monthly recurring',
      'change',      8,
      'changeLabel', 'vs last month'
    );

  WHEN 'csat-score' THEN
    -- Placeholder until customer satisfaction survey data is wired up
    RETURN jsonb_build_object(
      'value',        4.5,
      'max',          5,
      'displayValue', '4.5/5.0',
      'suffix',       '',
      'subtitle',     'Customer satisfaction'
    );

  ELSE
    RETURN jsonb_build_object('value', '—', 'subtitle', 'Widget data not configured');

  END CASE;
END;
$$;

COMMENT ON FUNCTION public.dashboard_widget_data(text, text, text, text, integer) IS
  'Returns JSONB data for a single dashboard widget keyed by p_widget_key. '
  'Tenant isolation is enforced via the p_tenant_id parameter — always pass the '
  'JWT tenant from the edge function, never trust client input.';

GRANT EXECUTE ON FUNCTION public.dashboard_widget_data(text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_widget_data(text, text, text, text, integer) TO service_role;
