// Sales-persona queries — ported from
// server/services/sales-reporting-service.ts.
//
// Schema reality vs. Express expectations:
//   - opportunities table exists (shared/schema.ts::1485). We use real fields:
//     stage_name, amount, probability, expected_revenue, owner_id, is_won,
//     is_closed, close_date, created_at.
//   - business_record_activities exists with activity_type
//     ('email'|'call'|'meeting'|'demo'|'proposal'|...) — usable for activity
//     report.
//   - sales_quotas table does NOT exist → personal quota report is degraded.
//   - commissions table does NOT exist → personal commissions report is
//     degraded.

import type { SupabaseClient } from '../../_shared/db.ts';

export interface OppRow {
  id: string;
  stage_name: string | null;
  amount: string | null;
  probability: number | null;
  expected_revenue: string | null;
  owner_id: string | null;
  owner_name: string | null;
  is_won: boolean | null;
  is_closed: boolean | null;
  close_date: string | null;
  created_at: string;
}

export interface OppsQuery {
  tenantId: string;
  ownerIds: string[];
  start: Date | null;
  end: Date | null;
}

export async function fetchOpps(db: SupabaseClient, q: OppsQuery): Promise<OppRow[]> {
  if (q.ownerIds.length === 0) return [];
  let query = db
    .from('opportunities')
    .select(
      'id, stage_name, amount, probability, expected_revenue, owner_id, owner_name, is_won, is_closed, close_date, created_at',
    )
    .eq('tenant_id', q.tenantId)
    .in('owner_id', q.ownerIds);
  if (q.start) query = query.gte('created_at', q.start.toISOString());
  if (q.end) query = query.lte('created_at', q.end.toISOString());
  const { data, error } = await query;
  if (error) throw new Error(`fetchOpps: ${error.message}`);
  return (data ?? []) as OppRow[];
}

export interface ActivityRow {
  activity_type: string;
  completed_date: string | null;
  created_at: string;
  created_by: string;
}

export async function fetchActivities(
  db: SupabaseClient,
  tenantId: string,
  userId: string,
  start: Date,
  end: Date,
): Promise<ActivityRow[]> {
  const { data, error } = await db
    .from('business_record_activities')
    .select('activity_type, completed_date, created_at, created_by')
    .eq('tenant_id', tenantId)
    .eq('created_by', userId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());
  if (error) throw new Error(`fetchActivities: ${error.message}`);
  return (data ?? []) as ActivityRow[];
}

export interface UserNameRow {
  id: string;
  name: string | null;
}

export async function fetchUserNames(
  db: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const filtered = [...new Set(ids)];
  const { data, error } = await db.from('users').select('id, name').in('id', filtered);
  if (error) throw new Error(`fetchUserNames: ${error.message}`);
  return new Map(((data ?? []) as UserNameRow[]).map((u) => [u.id, u.name ?? 'Unknown']));
}
