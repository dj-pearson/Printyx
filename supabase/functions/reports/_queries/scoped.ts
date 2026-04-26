// Helpers for scope-aggregated reports (manager = region, supervisor = location).
//
// The manager + supervisor personas all aggregate the same opportunity /
// service-ticket / activity data the base sales + service reports already
// pull — they just slice it by region or location. We reuse the existing
// fetchers (_queries/sales.ts, _queries/service.ts) and add lookup tables
// + grouping helpers here.

import type { SupabaseClient } from '../../_shared/db.ts';

export type Unit = 'region' | 'location';

export interface UnitRow {
  id: string;
  name: string;
}

export interface UserUnitRow {
  id: string;
  name: string | null;
  primary_location_id: string | null;
}

export interface LocationLookupRow {
  id: string;
  name: string;
  region_id: string | null;
}

export async function fetchUnits(
  db: SupabaseClient,
  tenantId: string,
  unit: Unit,
): Promise<UnitRow[]> {
  if (unit === 'region') {
    const { data, error } = await db
      .from('regions')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (error) throw new Error(`fetchUnits regions: ${error.message}`);
    return ((data ?? []) as UnitRow[]).map((r) => ({ id: r.id, name: r.name }));
  }
  const { data, error } = await db
    .from('locations')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  if (error) throw new Error(`fetchUnits locations: ${error.message}`);
  return ((data ?? []) as UnitRow[]).map((l) => ({ id: l.id, name: l.name }));
}

export async function fetchUsersWithUnits(
  db: SupabaseClient,
  tenantId: string,
): Promise<UserUnitRow[]> {
  const { data, error } = await db
    .from('users')
    .select('id, name, primary_location_id')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(`fetchUsersWithUnits: ${error.message}`);
  return (data ?? []) as UserUnitRow[];
}

export async function fetchLocationLookup(
  db: SupabaseClient,
  tenantId: string,
): Promise<LocationLookupRow[]> {
  const { data, error } = await db
    .from('locations')
    .select('id, name, region_id')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(`fetchLocationLookup: ${error.message}`);
  return (data ?? []) as LocationLookupRow[];
}

/**
 * Build a userId → unitId map for the given scope (region or location).
 * Users with no primary location, or whose location has no region (when
 * scope === 'region'), don't get a unit assignment and their data lands in
 * `unattributed` in callers.
 */
export function buildUserUnitMap(
  users: UserUnitRow[],
  locations: LocationLookupRow[],
  unit: Unit,
): Map<string, string> {
  if (unit === 'location') {
    const map = new Map<string, string>();
    for (const u of users) if (u.primary_location_id) map.set(u.id, u.primary_location_id);
    return map;
  }
  // unit === 'region'
  const locToRegion = new Map<string, string>();
  for (const l of locations) if (l.region_id) locToRegion.set(l.id, l.region_id);
  const map = new Map<string, string>();
  for (const u of users) {
    if (!u.primary_location_id) continue;
    const r = locToRegion.get(u.primary_location_id);
    if (r) map.set(u.id, r);
  }
  return map;
}
