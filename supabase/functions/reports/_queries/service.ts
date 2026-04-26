// Service-persona queries — ported from
// server/services/service-reporting-service.ts.
//
// Schema reality vs. Express expectations:
//   - service_tickets has `resolved_at` (not `completed_at`) and lacks
//     `category`, `resolution_type`, `first_time_fix`, `customer_satisfaction_rating`,
//     `sla_deadline`. Those fields surface as nulls + a `degraded` block.
//   - `parts_usage` table does NOT exist → parts report returns empty rows
//     with `degraded.partsUsageTable: true`.
//   - `time_entries` exists in shared/task-schema.ts but it's task-scoped
//     (per-task hours), not technician hour-of-day work. Time tracking
//     report degrades the same way.
//
// We keep the SELECT shape close to what the Express version produced so
// the frontend bindings still resolve, but null out the missing fields.

import type { SupabaseClient } from '../../_shared/db.ts';

export interface TicketRow {
  id: string;
  ticket_number: string;
  customer_id: string | null;
  equipment_id: string | null;
  priority: string | null;
  status: string | null;
  assigned_technician_id: string | null;
  scheduled_date: string | null;
  estimated_duration: number | null;
  resolved_at: string | null;
  labor_hours: string | null;
  created_at: string;
}

export interface ServiceTicketsQuery {
  tenantId: string;
  technicianIds: string[];
  start: Date | null;
  end: Date | null;
  status?: string;
}

export async function fetchPersonalTickets(
  db: SupabaseClient,
  q: ServiceTicketsQuery,
): Promise<TicketRow[]> {
  if (q.technicianIds.length === 0) return [];

  let query = db
    .from('service_tickets')
    .select(
      'id, ticket_number, customer_id, equipment_id, priority, status, assigned_technician_id, scheduled_date, estimated_duration, resolved_at, labor_hours, created_at',
    )
    .eq('tenant_id', q.tenantId)
    .in('assigned_technician_id', q.technicianIds);
  if (q.status) query = query.eq('status', q.status);
  if (q.start) query = query.gte('created_at', q.start.toISOString());
  if (q.end) query = query.lte('created_at', q.end.toISOString());

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(`fetchPersonalTickets: ${error.message}`);
  return (data ?? []) as TicketRow[];
}

export interface DispatchQuery {
  tenantId: string;
  accessibleTechnicianIds: string[];
  priority?: string;
  status?: string;
  assignedTo?: string;
}

export async function fetchDispatchQueue(
  db: SupabaseClient,
  q: DispatchQuery,
): Promise<TicketRow[]> {
  if (q.accessibleTechnicianIds.length === 0) return [];

  // Express included unassigned tickets too (`OR assigned_technician_id IS NULL`).
  // PostgREST .or() with .in() composition is awkward — split into two queries
  // and merge.
  const baseFields =
    'id, ticket_number, customer_id, equipment_id, priority, status, assigned_technician_id, scheduled_date, estimated_duration, resolved_at, labor_hours, created_at';
  const openStatuses = ['open', 'assigned', 'in-progress', 'scheduled'];

  let assignedQuery = db
    .from('service_tickets')
    .select(baseFields)
    .eq('tenant_id', q.tenantId)
    .in('status', openStatuses)
    .in('assigned_technician_id', q.accessibleTechnicianIds);
  if (q.priority) assignedQuery = assignedQuery.eq('priority', q.priority);
  if (q.status) assignedQuery = assignedQuery.eq('status', q.status);
  if (q.assignedTo) assignedQuery = assignedQuery.eq('assigned_technician_id', q.assignedTo);

  let unassignedQuery = q.assignedTo
    ? null
    : db
        .from('service_tickets')
        .select(baseFields)
        .eq('tenant_id', q.tenantId)
        .in('status', openStatuses)
        .is('assigned_technician_id', null);
  if (unassignedQuery && q.priority) unassignedQuery = unassignedQuery.eq('priority', q.priority);
  if (unassignedQuery && q.status) unassignedQuery = unassignedQuery.eq('status', q.status);

  const [assigned, unassigned] = await Promise.all([
    assignedQuery,
    unassignedQuery ?? Promise.resolve({ data: [], error: null }),
  ]);

  if (assigned.error) throw new Error(`dispatch_assigned: ${assigned.error.message}`);
  if (unassigned.error) throw new Error(`dispatch_unassigned: ${unassigned.error.message}`);

  return [...(assigned.data ?? []), ...(unassigned.data ?? [])] as TicketRow[];
}

export async function fetchTeamTickets(
  db: SupabaseClient,
  tenantId: string,
  technicianIds: string[],
  start: Date,
  end: Date,
): Promise<TicketRow[]> {
  if (technicianIds.length === 0) return [];
  const { data, error } = await db
    .from('service_tickets')
    .select(
      'id, ticket_number, priority, status, assigned_technician_id, scheduled_date, estimated_duration, resolved_at, labor_hours, created_at',
    )
    .eq('tenant_id', tenantId)
    .in('assigned_technician_id', technicianIds)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());
  if (error) throw new Error(`fetchTeamTickets: ${error.message}`);
  return (data ?? []) as TicketRow[];
}

export interface CustomerLookup {
  id: string;
  company_name: string | null;
}

export async function fetchCustomerNames(
  db: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  const filtered = [...new Set(ids.filter(Boolean))];
  if (filtered.length === 0) return new Map();
  const { data, error } = await db
    .from('business_records')
    .select('id, company_name')
    .in('id', filtered);
  if (error) throw new Error(`fetchCustomerNames: ${error.message}`);
  return new Map(
    ((data ?? []) as CustomerLookup[]).map((c) => [c.id, c.company_name ?? 'Unknown']),
  );
}
