/**
 * Dispatch arithmetic for service tickets (WF-V-03), kept out of index.ts so it is
 * testable: index.ts pulls supabase-js from esm.sh, which vitest cannot import.
 *
 * The interesting one is applyTicketFields. It used to read
 * `body[camelKey] || body[snakeKey]`, which turns every falsy value the caller
 * actually sent into the other key's value and then into `undefined` - and
 * supabase-js JSON.stringifies the update payload, so an undefined key is dropped
 * before it reaches PostgREST. UNASSIGNING WAS THEREFORE A NO-OP: the board sent
 * assignedTechnicianId: null, the handler answered 200 with the ticket still
 * assigned, and the row never changed. Same shape for laborHours: 0 and any
 * cleared text field. `??` on the key that was PRESENT is the fix.
 */

export type TicketChange = { field: string; oldValue: unknown; newValue: unknown };

export const TICKET_FIELD_MAP: Record<string, string> = {
  customerId: 'customer_id',
  equipmentId: 'equipment_id',
  ticketNumber: 'ticket_number',
  title: 'title',
  description: 'description',
  priority: 'priority',
  status: 'status',
  assignedTechnicianId: 'assigned_technician_id',
  scheduledDate: 'scheduled_date',
  estimatedDuration: 'estimated_duration',
  customerAddress: 'customer_address',
  customerPhone: 'customer_phone',
  requiredSkills: 'required_skills',
  requiredParts: 'required_parts',
  workOrderNotes: 'work_order_notes',
  resolutionNotes: 'resolution_notes',
  customerSignature: 'customer_signature',
  partsUsed: 'parts_used',
  laborHours: 'labor_hours',
};

/** Statuses that mean the work is still outstanding. */
export const OPEN_TICKET_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'on_site',
  'pending',
  'scheduled',
];

export function applyTicketFields(
  body: Record<string, unknown>,
  currentTicket: Record<string, unknown> | null,
  fieldMap: Record<string, string> = TICKET_FIELD_MAP,
): { updateData: Record<string, unknown>; changes: TicketChange[] } {
  const updateData: Record<string, unknown> = {};
  const changes: TicketChange[] = [];

  for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
    const hasCamel = Object.prototype.hasOwnProperty.call(body, camelKey);
    const hasSnake = Object.prototype.hasOwnProperty.call(body, snakeKey);
    if (!hasCamel && !hasSnake) continue;
    // Whichever key the caller actually sent wins, value and all - including null.
    const newValue = hasCamel && body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
    if (newValue === undefined) continue;

    updateData[snakeKey] = newValue;
    if (currentTicket && currentTicket[snakeKey] !== newValue) {
      changes.push({ field: snakeKey, oldValue: currentTicket[snakeKey] ?? null, newValue });
    }
  }

  return { updateData, changes };
}

export type DispatchLoadRow = { technicianId: string; openCount: number; todayCount: number };

/**
 * Open-ticket counts per technician. Counted over the WHOLE tenant on purpose:
 * the board's own ticket list is scoped to the caller, so counting from it would
 * under-report anyone whose other work the dispatcher cannot see - a number that
 * looks precise and is quietly wrong.
 */
export function dispatchLoad(
  rows: Array<{ assigned_technician_id?: string | null; scheduled_date?: unknown }>,
  today: string,
): { unassigned: number; load: DispatchLoadRow[] } {
  const byTechnician = new Map<string, { openCount: number; todayCount: number }>();
  let unassigned = 0;

  for (const row of rows) {
    const tech = row.assigned_technician_id ?? null;
    if (!tech) {
      unassigned++;
      continue;
    }
    const entry = byTechnician.get(tech) ?? { openCount: 0, todayCount: 0 };
    entry.openCount++;
    if (typeof row.scheduled_date === 'string' && row.scheduled_date.startsWith(today)) {
      entry.todayCount++;
    }
    byTechnician.set(tech, entry);
  }

  return {
    unassigned,
    load: [...byTechnician.entries()].map(([technicianId, counts]) => ({
      technicianId,
      ...counts,
    })),
  };
}

/**
 * The row to write into user_notifications when a dispatch lands on somebody.
 * Null when nothing was assigned, when the assignment was cleared, or when the
 * dispatcher assigned the ticket to themselves - nobody needs telling about their
 * own click.
 */
export function assignmentNotification(
  changes: TicketChange[],
  ticket: Record<string, unknown>,
  actorId: string,
  tenantId: string,
  ticketId: string,
  now: string,
): Record<string, unknown> | null {
  const assignment = changes.find(
    (c) => c.field === 'assigned_technician_id' && c.newValue && c.newValue !== actorId,
  );
  if (!assignment) return null;

  return {
    tenant_id: tenantId,
    user_id: String(assignment.newValue),
    type: 'info',
    priority: ticket.priority === 'urgent' ? 'high' : 'medium',
    category: 'service',
    title: 'A service call was assigned to you',
    message: `${ticket.ticket_number ?? 'Ticket'}: ${ticket.title ?? 'Service call'}`,
    action_url: `/mobile-field-service/${ticketId}`,
    action_label: 'Open',
    read: false,
    created_at: now,
  };
}
