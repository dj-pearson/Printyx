/**
 * The roster row shape the Technician Management page reads, and the two
 * ticket counts beside it.
 *
 * `technicians` stores first_name/last_name, skills, is_active and
 * is_available; the page reads name, specialties, status and availability. The
 * Express handler has always mapped between them with an explicit projection
 * (technicianNameSql / technicianStatusSql / technicianAvailabilitySql), and
 * the edge function answered the raw row - so on the host that serves
 * production every cell was blank. This is that projection, in one place both
 * hosts can import.
 */

export interface TechnicianRow {
  id?: string | null;
  user_id?: string | null;
  employee_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  skills?: unknown;
  certifications?: unknown;
  current_location?: string | null;
  is_active?: boolean | null;
  is_available?: boolean | null;
  working_hours?: unknown;
  hourly_rate?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TicketRow {
  assigned_technician_id?: string | null;
  status?: string | null;
  updated_at?: string | null;
}

export interface TechnicianCounts {
  activeTickets: number;
  completedThisMonth: number;
}

/** A ticket still in play. Byte-for-byte the Express predicate. */
export const TERMINAL_TICKET_STATUSES = ['completed', 'cancelled'];

/**
 * Bucket tickets per technician in one pass.
 *
 * PostgREST has no GROUP BY and no `count(*) FILTER`, so the bucketing that
 * Express does in SQL happens here - over ONE fetch of the rows that can
 * possibly count, rather than two head-counts per technician, which is the
 * N+1 AUDIT-007 removed from the Express side and which must not come back
 * through the other host.
 *
 * A technician with no tickets appears AT ZERO rather than being absent: the
 * rows were looked for, so zero is a measurement (COP-B01's team roll-up rule).
 */
export function bucketTicketCounts(
  technicianIds: string[],
  tickets: TicketRow[],
  monthStart: Date,
): Map<string, TechnicianCounts> {
  const out = new Map<string, TechnicianCounts>();
  for (const id of technicianIds) out.set(id, { activeTickets: 0, completedThisMonth: 0 });

  for (const t of tickets) {
    const id = t.assigned_technician_id;
    if (!id) continue;
    const bucket = out.get(id);
    if (!bucket) continue;
    const status = (t.status ?? '').toLowerCase();
    if (!TERMINAL_TICKET_STATUSES.includes(status)) {
      bucket.activeTickets += 1;
      continue;
    }
    if (status !== 'completed') continue;
    // A completion with no timestamp cannot be placed in a month, so it is not
    // counted rather than being counted as this month's.
    if (!t.updated_at) continue;
    const at = new Date(t.updated_at);
    if (Number.isNaN(at.getTime())) continue;
    if (at >= monthStart) bucket.completedThisMonth += 1;
  }
  return out;
}

/** trim(coalesce(first,'') || ' ' || coalesce(last,'')) */
export function technicianName(row: TechnicianRow): string {
  return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const asNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * One roster row in the shape the page reads.
 *
 * status and availability are BOOLEAN columns presented as words, exactly as
 * the Express CASE expressions do. 'on_leave' and 'offline' are in the page's
 * union type and NOTHING can produce them - there is no column that records
 * either - so they are simply never returned rather than being guessed at from
 * some combination of the two booleans.
 */
export function toRosterRow(row: TechnicianRow, counts?: TechnicianCounts) {
  return {
    id: row.id ?? '',
    userId: row.user_id ?? '',
    name: technicianName(row),
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    specialties: asArray(row.skills),
    certifications: asArray(row.certifications),
    status: row.is_active ? 'active' : 'inactive',
    location: row.current_location ?? '',
    availability: row.is_available ? 'available' : 'busy',
    hourlyRate: asNumber(row.hourly_rate),
    employeeId: row.employee_id ?? '',
    workingHours: row.working_hours ?? null,
    activeTickets: counts?.activeTickets ?? 0,
    completedThisMonth: counts?.completedThisMonth ?? 0,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}
