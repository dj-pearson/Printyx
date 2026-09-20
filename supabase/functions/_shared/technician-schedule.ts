/**
 * A technician's day, merged from the three tables that actually schedule one
 * (WF-V-07).
 *
 * `/technician-management/:id/schedule` read `work_orders`: a relation named by
 * no Drizzle schema, no migration and no database export in this repo - the
 * export's 21 apparent hits are `field_work_orders`, `mobile_work_orders` and
 * `work_orders_completed`, which is what an unanchored grep for a table name
 * costs you. The handler then did `schedule || []` on a discarded error, so a
 * technician's schedule was a permanent empty list at 200 rather than a failure.
 * An empty week and a broken query rendered identically.
 *
 * THE ID SPACES DIFFER, AND THAT IS THE TRAP. The route receives a
 * `technicians.id`, while all three real tables key the person on `users.id`:
 * `installation_schedules.technician_id` and `delivery_schedules.driver_id` are
 * both compared to `user.id` by the live crew-day reader in
 * equipment-lifecycle, and `service_tickets.assigned_technician_id` is what
 * service-tickets hands to `rowInScope` against the caller's user id. Querying
 * the three with a `technicians.id` returns nothing, every time, for everyone -
 * the same silent empty in a new costume. The caller resolves
 * `technicians.id -> user_id` first, and a technician row with NO user_id (a
 * contractor, which the roster's own scope comment calls out) cannot be matched
 * by any of them: that is reported, never rendered as a free day.
 *
 * DELIVERIES ARE INCLUDED WITH A CAVEAT RATHER THAN SILENTLY. The story asks
 * for delivery_schedules and that table has no technician column at all - it
 * has `driver_id`. The id space matches, so a technician who drove a delivery
 * does appear; what cannot be answered is a delivery assigned to a driver who
 * is not this technician but covers for them, and the response says so instead
 * of implying the list is complete.
 */

export type ScheduleKind = 'installation' | 'delivery' | 'service';

export interface ScheduleItem {
  id: string;
  kind: ScheduleKind;
  scheduledDate: string | null;
  status: string | null;
  customerId: string | null;
  equipmentId: string | null;
  title: string | null;
  estimatedDurationMinutes: number | null;
  notes: string | null;
}

export interface ScheduleSource {
  kind: ScheduleKind;
  /** null when the read FAILED, which is not the same as no rows. */
  rows: Record<string, unknown>[] | null;
}

export interface TechnicianSchedule {
  items: ScheduleItem[];
  /** Families whose read failed. A count over these would be a measurement. */
  degraded: ScheduleKind[];
  unbacked: string[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

function toItem(kind: ScheduleKind, row: Record<string, unknown>): ScheduleItem {
  return {
    id: String(row.id ?? ''),
    kind,
    scheduledDate: str(row.scheduled_date),
    status: str(row.status),
    customerId: str(row.customer_id),
    equipmentId: str(row.equipment_id),
    // Only service_tickets carries a title; naming the kind for the other two
    // beats inventing one, and beats a blank cell that reads as missing data.
    title: kind === 'service' ? str(row.title) : null,
    estimatedDurationMinutes: num(row.estimated_duration),
    notes:
      kind === 'installation'
        ? str(row.installation_notes)
        : kind === 'delivery'
          ? str(row.special_instructions)
          : str(row.description),
  };
}

export const DELIVERY_CAVEAT =
  'delivery_schedules has no technician column; deliveries are matched on driver_id, ' +
  'so a delivery driven by somebody else for this technician is not listed.';

export function buildTechnicianSchedule(sources: ScheduleSource[]): TechnicianSchedule {
  const items: ScheduleItem[] = [];
  const degraded: ScheduleKind[] = [];

  for (const source of sources) {
    if (source.rows === null) {
      degraded.push(source.kind);
      continue;
    }
    for (const row of source.rows) items.push(toItem(source.kind, row));
  }

  // Undated rows sort LAST rather than first: a row with no scheduled_date is
  // not the earliest thing in the day, it is one nobody has placed yet.
  items.sort((a, b) => {
    if (a.scheduledDate === b.scheduledDate) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    if (a.scheduledDate === null) return 1;
    if (b.scheduledDate === null) return -1;
    return a.scheduledDate < b.scheduledDate ? -1 : 1;
  });

  const unbacked = sources.some((s) => s.kind === 'delivery') ? [DELIVERY_CAVEAT] : [];
  return { items, degraded, unbacked };
}
