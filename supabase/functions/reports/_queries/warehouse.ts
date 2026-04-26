// Warehouse report queries — ported from
// server/services/warehouse-reporting-service.ts.
//
// Returns the raw row sets the handler needs to compute FPY metrics. We keep
// the aggregation logic in the handler (matches the Express service shape)
// rather than push aggregates into SQL, because the Express version walked
// the operations array four+ times for different counts and the cost is in
// the SELECT, not the JS loops.

import type { SupabaseClient } from '../../_shared/db.ts';

export interface WarehouseOperation {
  id: string;
  assigned_technician: string | null;
  operation_status: string | null;
  first_pass_yield: boolean | null;
  rework_required: boolean | null;
  quality_status: string | null;
  total_duration_minutes: number | null;
  created_at: string;
}

export interface OperationsQuery {
  tenantId: string;
  technicianIds: string[];
  start: Date;
  end: Date;
}

export async function fetchOperations(
  db: SupabaseClient,
  q: OperationsQuery,
): Promise<WarehouseOperation[]> {
  if (q.technicianIds.length === 0) return [];

  const { data, error } = await db
    .from('warehouse_kitting_operations')
    .select(
      'id, assigned_technician, operation_status, first_pass_yield, rework_required, quality_status, total_duration_minutes, created_at',
    )
    .eq('tenant_id', q.tenantId)
    .in('assigned_technician', q.technicianIds)
    .gte('created_at', q.start.toISOString())
    .lte('created_at', q.end.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error(`fetchOperations: ${error.message}`);
  return (data ?? []) as WarehouseOperation[];
}

export interface TechName {
  id: string;
  name: string | null;
}

export async function fetchTechNames(
  db: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db.from('users').select('id, name').in('id', ids);
  if (error) throw new Error(`fetchTechNames: ${error.message}`);
  return new Map((data ?? []).map((u) => [u.id as string, (u.name as string | null) ?? 'Unknown']));
}
