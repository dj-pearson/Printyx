-- =============================================================================
-- Billing / AP / AR aggregates (AUDIT-006)
-- =============================================================================
-- Three functions that replace "SELECT * then reduce in JS" in the edge functions:
--
--   public.ap_aging_summary(tenant)      -> supabase/functions/account-payable/    (/summary)
--   public.ar_aging_summary(tenant)      -> supabase/functions/account-receivable/ (/summary)
--   public.billing_analytics(tenant)     -> supabase/functions/billing/            (/analytics)
--
-- WHY THIS EXISTS: the callers loaded EVERY row for the tenant and summed in JS.
-- That is not just slow — PostgREST silently caps a response at db-max-rows (1000
-- by default) and does NOT error, so past 1000 rows those totals were simply WRONG
-- (money numbers, quietly under-reported). Summing in SQL removes both problems.
--
-- All SECURITY INVOKER (the default) and tenant-scoped via an explicit parameter,
-- matching drizzle/functions/lead-scoring.sql. Idempotent (CREATE OR REPLACE), so
-- re-running any of these after an edit is safe.
--
-- The bucket boundaries below intentionally reproduce the JS they replace, so the
-- numbers do not move when this is applied. See the AUDIT-006 notes in prd.json.
--
-- Apply:  \i drizzle/functions/billing-aggregates.sql
-- =============================================================================

-- AP aging: balance falls in exactly one of overdue / dueThisWeek / current.
-- JS equivalent: due < now -> overdue ; due <= now+7d -> dueThisWeek ; else current.
CREATE OR REPLACE FUNCTION public.ap_aging_summary(p_tenant_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH rows AS (
    SELECT
      COALESCE(balance_amount, COALESCE(total_amount, 0) - COALESCE(paid_amount, 0)) AS balance,
      due_date
    FROM accounts_payable
    WHERE tenant_id = p_tenant_id
      AND status IS DISTINCT FROM 'paid'
  ), bucketed AS (
    SELECT
      COALESCE(SUM(balance) FILTER (WHERE due_date < now()), 0) AS overdue,
      COALESCE(SUM(balance) FILTER (WHERE due_date >= now() AND due_date <= now() + interval '7 days'), 0) AS due_this_week,
      COALESCE(SUM(balance) FILTER (WHERE due_date > now() + interval '7 days'), 0) AS current_amt,
      COUNT(*) AS bill_count
    FROM rows
  )
  SELECT jsonb_build_object(
    'totalPayables', (current_amt + overdue + due_this_week)::float8,
    'current',       current_amt::float8,
    'dueThisWeek',   due_this_week::float8,
    'overdue',       overdue::float8,
    'billCount',     bill_count
  )
  FROM bucketed;
$$;

-- AR aging: days past due -> current / 30 / 60 / 90 / 90+.
-- JS equivalent used floor((now - due) / 1 day): <=0 current, <=30, <=60, <=90, else 90+.
CREATE OR REPLACE FUNCTION public.ar_aging_summary(p_tenant_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH rows AS (
    SELECT
      COALESCE(balance_amount, COALESCE(total_amount, 0) - COALESCE(paid_amount, 0)) AS balance,
      floor(EXTRACT(EPOCH FROM (now() - due_date)) / 86400) AS days_past
    FROM accounts_receivable
    WHERE tenant_id = p_tenant_id
      AND status IS DISTINCT FROM 'paid'
  ), bucketed AS (
    SELECT
      COALESCE(SUM(balance) FILTER (WHERE days_past <= 0), 0) AS current_amt,
      COALESCE(SUM(balance) FILTER (WHERE days_past > 0  AND days_past <= 30), 0) AS overdue30,
      COALESCE(SUM(balance) FILTER (WHERE days_past > 30 AND days_past <= 60), 0) AS overdue60,
      COALESCE(SUM(balance) FILTER (WHERE days_past > 60 AND days_past <= 90), 0) AS overdue90,
      COALESCE(SUM(balance) FILTER (WHERE days_past > 90), 0) AS overdue90_plus,
      COUNT(*) AS invoice_count
    FROM rows
  )
  SELECT jsonb_build_object(
    'totalReceivables', (current_amt + overdue30 + overdue60 + overdue90 + overdue90_plus)::float8,
    'current',          current_amt::float8,
    'overdue30',        overdue30::float8,
    'overdue60',        overdue60::float8,
    'overdue90',        overdue90::float8,
    'overdue90Plus',    overdue90_plus::float8,
    'invoiceCount',     invoice_count
  )
  FROM bucketed;
$$;

-- Billing analytics. JS equivalent (billing/index.ts):
--   totalRevenue      = SUM(total_amount) WHERE invoice_status = 'paid'
--   outstandingAmount = SUM(balance_due)  WHERE invoice_status <> 'paid'
--   overdueCount      = COUNT(*)          WHERE invoice_status = 'overdue'
--   monthlyRecurring  = SUM(total_amount) WHERE billing_period_start >= start of current month
--   totalInvoices     = COUNT(*)
-- NOTE: averageInvoiceAmount was totalRevenue / totalInvoices — i.e. PAID revenue
-- divided by ALL invoices. That is preserved exactly (see the prd.json note); it is
-- computed by the caller, not here.
CREATE OR REPLACE FUNCTION public.billing_analytics(p_tenant_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'totalRevenue',      COALESCE(SUM(total_amount) FILTER (WHERE invoice_status = 'paid'), 0)::float8,
    'outstandingAmount', COALESCE(SUM(balance_due)  FILTER (WHERE invoice_status IS DISTINCT FROM 'paid'), 0)::float8,
    'overdueCount',      COUNT(*) FILTER (WHERE invoice_status = 'overdue'),
    'monthlyRecurring',  COALESCE(SUM(total_amount) FILTER (WHERE billing_period_start >= date_trunc('month', now())), 0)::float8,
    'totalInvoices',     COUNT(*),
    'paidCount',         COUNT(*) FILTER (WHERE invoice_status = 'paid')
  )
  FROM invoices
  WHERE tenant_id = p_tenant_id;
$$;
