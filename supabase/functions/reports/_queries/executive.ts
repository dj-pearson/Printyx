// Executive + platform-admin queries — ported from
// server/services/executive-reporting-service.ts.
//
// The Express service mixed real DB queries with hardcoded placeholder
// values (revenueGrowth: 15.3, marketShare: 12.5, etc.). We preserve those
// placeholders in the handler so the frontend keeps rendering, but mark them
// in a `degraded` block so they're traceable.
//
// Schema deltas vs. Express expectations:
//   - opportunities.deal_type column does not exist → ARR/MRR cannot be
//     computed from existing rows; reported as null
//   - tenants.subscription_plan does not exist → real column is `plan`
//   - tenants.status does not exist → real column is `is_active` + `subscription`
//   - users.last_login does not exist → real column is `last_login_at`

import type { SupabaseClient } from '../../_shared/db.ts';

export interface ExecutiveOpportunity {
  amount: string | null;
  is_won: boolean | null;
  stage_name: string | null;
}

export interface ExecutiveSnapshot {
  totalRevenue: number;
  customerCount: number;
  totalEmployees: number;
  csat: number | null;
}

export async function fetchExecutiveSnapshot(
  db: SupabaseClient,
  tenantId: string,
  start: Date | null,
  end: Date | null,
): Promise<ExecutiveSnapshot> {
  let oppQuery = db
    .from('opportunities')
    .select('amount, is_won, stage_name')
    .eq('tenant_id', tenantId);
  if (start) oppQuery = oppQuery.gte('close_date', start.toISOString());
  if (end) oppQuery = oppQuery.lte('close_date', end.toISOString());

  let callsQuery = db
    .from('service_calls')
    .select('customer_satisfaction_rating')
    .eq('tenant_id', tenantId);
  if (start) callsQuery = callsQuery.gte('call_date', start.toISOString());
  if (end) callsQuery = callsQuery.lte('call_date', end.toISOString());

  const [oppRes, employeesRes, customersRes, callsRes] = await Promise.all([
    oppQuery,
    db.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    db
      .from('business_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('record_type', 'customer'),
    callsQuery,
  ]);

  if (oppRes.error) throw new Error(`opportunities: ${oppRes.error.message}`);
  if (callsRes.error) throw new Error(`service_calls: ${callsRes.error.message}`);

  let totalRevenue = 0;
  for (const opp of (oppRes.data ?? []) as ExecutiveOpportunity[]) {
    const isWon = opp.is_won === true || opp.stage_name === 'Closed Won';
    if (isWon) totalRevenue += parseFloatSafe(opp.amount);
  }

  const ratings: number[] = [];
  for (const r of (callsRes.data ?? []) as Array<{ customer_satisfaction_rating: number | null }>) {
    if (typeof r.customer_satisfaction_rating === 'number') {
      ratings.push(r.customer_satisfaction_rating);
    }
  }
  const csat = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  return {
    totalRevenue,
    customerCount: customersRes.count ?? 0,
    totalEmployees: employeesRes.count ?? 0,
    csat,
  };
}

export interface PlatformSnapshot {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  paidTenants: number;
  // No `churned` flag exists; we count where subscription === 'canceled'.
  churnedTenants: number;
  totalUsers: number;
  dau: number;
  mau: number;
}

export async function fetchPlatformSnapshot(db: SupabaseClient): Promise<PlatformSnapshot> {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [tenantsRes, totalUsersRes, dauRes, mauRes] = await Promise.all([
    db.from('tenants').select('id, is_active, plan, subscription'),
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('users').select('id', { count: 'exact', head: true }).gte('last_login_at', dayAgo),
    db.from('users').select('id', { count: 'exact', head: true }).gte('last_login_at', monthAgo),
  ]);

  if (tenantsRes.error) throw new Error(`tenants: ${tenantsRes.error.message}`);

  type T = {
    id: string;
    is_active: boolean | null;
    plan: string | null;
    subscription: string | null;
  };
  const tenants = (tenantsRes.data ?? []) as T[];
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.is_active === true).length;
  const trialTenants = tenants.filter((t) => t.subscription === 'trialing').length;
  const paidTenants = tenants.filter((t) => t.subscription === 'active').length;
  const churnedTenants = tenants.filter((t) => t.subscription === 'canceled').length;

  return {
    totalTenants,
    activeTenants,
    trialTenants,
    paidTenants,
    churnedTenants,
    totalUsers: totalUsersRes.count ?? 0,
    dau: dauRes.count ?? 0,
    mau: mauRes.count ?? 0,
  };
}

function parseFloatSafe(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}
