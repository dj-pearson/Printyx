// Director-level report queries — ported from
// server/services/director-reporting-service.ts.
//
// Schema reality vs. Express expectations:
//   - The Express service references `opportunities.stage`, `closed_at`, and
//     `weighted_amount`. The real schema (shared/schema.ts::1485) uses
//     `stage_name`, `close_date`, and exposes `is_won` + `is_closed` flags
//     plus `expected_revenue` (probability-weighted). We adapt accordingly.
//   - It also references `service_calls.first_time_fix`, `sla_status`, and
//     `satisfaction_rating`. Real columns: `customer_satisfaction_rating`
//     and `assigned_technician_id`. The first-time-fix and SLA columns do
//     not exist; the handler reports null + a `degraded` flag for those
//     metrics rather than fabricating them.
//   - `sales_quotas` table does not exist in the schema — quota_attainment
//     is reported as null until quotas are modeled.
//   - `time_entries` exists in `shared/task-schema.ts` but is task-scoped
//     (per-task hours), not technician utilization. Utilization is null
//     until a real source exists.
//
// We pull the rows through supabase-js (no raw SQL escape hatch in the
// edge runtime) and aggregate in JS. For director-scope tenants this is
// fine in size — opportunities + service_calls per tenant per period
// don't typically exceed a few thousand rows.

import type { SupabaseClient } from '../../_shared/db.ts';

export interface OpportunityRow {
  id: string;
  amount: string | null;
  expected_revenue: string | null;
  probability: number | null;
  stage_name: string | null;
  is_won: boolean | null;
  is_closed: boolean | null;
  owner_id: string | null;
  owner_name: string | null;
  close_date: string | null;
}

export interface ServiceCallRow {
  id: string;
  call_date: string;
  call_status: string | null;
  customer_satisfaction_rating: number | null;
  assigned_technician_id: string | null;
}

export interface UserLocationRow {
  id: string;
  name: string | null;
  primary_location_id: string | null;
}

export interface LocationRow {
  id: string;
  region_id: string | null;
}

export interface RegionRow {
  id: string;
  name: string;
}

export interface DirectorWindow {
  tenantId: string;
  start: Date | null;
  end: Date | null;
}

function applyDateFilter<T>(q: T, column: string, start: Date | null, end: Date | null): T {
  // supabase-js builder is fluent; cast preserves chain typing.
  let chain = q as unknown as {
    gte: (col: string, value: string) => unknown;
    lte: (col: string, value: string) => unknown;
  };
  if (start) chain = chain.gte(column, start.toISOString()) as typeof chain;
  if (end) chain = chain.lte(column, end.toISOString()) as typeof chain;
  return chain as unknown as T;
}

export async function fetchOpportunities(
  db: SupabaseClient,
  w: DirectorWindow,
): Promise<OpportunityRow[]> {
  let q = db
    .from('opportunities')
    .select(
      'id, amount, expected_revenue, probability, stage_name, is_won, is_closed, owner_id, owner_name, close_date',
    )
    .eq('tenant_id', w.tenantId);
  q = applyDateFilter(q, 'close_date', w.start, w.end);
  const { data, error } = await q;
  if (error) throw new Error(`fetchOpportunities: ${error.message}`);
  return (data ?? []) as OpportunityRow[];
}

export async function fetchServiceCalls(
  db: SupabaseClient,
  w: DirectorWindow,
): Promise<ServiceCallRow[]> {
  let q = db
    .from('service_calls')
    .select('id, call_date, call_status, customer_satisfaction_rating, assigned_technician_id')
    .eq('tenant_id', w.tenantId);
  q = applyDateFilter(q, 'call_date', w.start, w.end);
  const { data, error } = await q;
  if (error) throw new Error(`fetchServiceCalls: ${error.message}`);
  return (data ?? []) as ServiceCallRow[];
}

export async function fetchUsersWithLocations(
  db: SupabaseClient,
  tenantId: string,
): Promise<UserLocationRow[]> {
  const { data, error } = await db
    .from('users')
    .select('id, name, primary_location_id')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(`fetchUsersWithLocations: ${error.message}`);
  return (data ?? []) as UserLocationRow[];
}

export async function fetchLocations(db: SupabaseClient, tenantId: string): Promise<LocationRow[]> {
  const { data, error } = await db
    .from('locations')
    .select('id, region_id')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(`fetchLocations: ${error.message}`);
  return (data ?? []) as LocationRow[];
}

export async function fetchRegions(db: SupabaseClient, tenantId: string): Promise<RegionRow[]> {
  const { data, error } = await db
    .from('regions')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  if (error) throw new Error(`fetchRegions: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; name: string }>).map((r) => ({
    id: r.id,
    name: r.name,
  }));
}

/**
 * Build a userId → regionId lookup by chaining users → locations → regions.
 * Users with no primary_location_id, or whose location has no region, are
 * left out of the map (so revenue from those reps falls into "unattributed"
 * in the handler).
 */
export function buildUserRegionMap(
  users: UserLocationRow[],
  locations: LocationRow[],
): Map<string, string> {
  const locationToRegion = new Map<string, string>();
  for (const loc of locations) {
    if (loc.region_id) locationToRegion.set(loc.id, loc.region_id);
  }
  const userToRegion = new Map<string, string>();
  for (const u of users) {
    if (!u.primary_location_id) continue;
    const region = locationToRegion.get(u.primary_location_id);
    if (region) userToRegion.set(u.id, region);
  }
  return userToRegion;
}
