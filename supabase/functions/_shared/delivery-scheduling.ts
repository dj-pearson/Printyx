// Delivery and installation scheduling, the pure half (WF-L-06).
//
// WF-L-02 built the list and create paths for delivery_schedules and
// installation_schedules. What it did not build is the half a dispatcher spends
// the day in: assigning a driver and a vehicle, moving a window, and seeing what
// a crew is due to do today. delivery_schedules had one Express writer with no
// caller; installation_schedules had no reader or writer anywhere.
//
// The update builders live here for the same reason the kitting ones do: a
// scheduling write is a small mapping with a lot of NOT NULL columns behind it,
// and mapping it explicitly is what keeps one unknown key from failing the whole
// statement.

/** Fields a PATCH may move on a delivery. */
const DELIVERY_FIELDS: Record<string, string> = {
  scheduledDate: 'scheduled_date',
  timeWindow: 'time_window',
  deliveryType: 'delivery_type',
  driverId: 'driver_id',
  vehicleId: 'vehicle_id',
  contactPerson: 'contact_person',
  contactPhone: 'contact_phone',
  specialInstructions: 'special_instructions',
  deliveryNotes: 'delivery_notes',
  status: 'status',
  actualDeliveryTime: 'actual_delivery_time',
  signatureUrl: 'signature_url',
};

/** Fields a PATCH may move on an installation. */
const INSTALLATION_FIELDS: Record<string, string> = {
  scheduledDate: 'scheduled_date',
  technicianId: 'technician_id',
  installationType: 'installation_type',
  estimatedDuration: 'estimated_duration',
  siteRequirements: 'site_requirements',
  preInstallationChecklist: 'pre_installation_checklist',
  status: 'status',
  actualStartTime: 'actual_start_time',
  actualEndTime: 'actual_end_time',
  installationNotes: 'installation_notes',
  trainingProvided: 'training_provided',
  followUpRequired: 'follow_up_required',
};

/** Statuses a schedule row can hold. Anything else is refused rather than stored. */
export const SCHEDULE_STATUSES = [
  'scheduled',
  'in_transit',
  'in_progress',
  'completed',
  'cancelled',
] as const;

function buildUpdate(
  body: Record<string, unknown>,
  fields: Record<string, string>,
): Record<string, unknown> | { error: string } {
  const update: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fields)) {
    if (body[camel] !== undefined) update[snake] = body[camel];
    else if (body[snake] !== undefined) update[snake] = body[snake];
  }
  if (Object.keys(update).length === 0) return { error: 'No known field to update' };

  const status = update.status;
  if (status !== undefined && !SCHEDULE_STATUSES.includes(String(status) as never)) {
    return { error: `status must be one of ${SCHEDULE_STATUSES.join(', ')}` };
  }
  // delivery_address, equipment_id, customer_id and tenant_id are deliberately
  // NOT movable: re-pointing a scheduled delivery at a different unit or a
  // different customer is a new schedule, not an edit.
  update.updated_at = new Date().toISOString();
  return update;
}

export function buildDeliveryUpdate(body: Record<string, unknown>) {
  return buildUpdate(body, DELIVERY_FIELDS);
}

export function buildInstallationUpdate(body: Record<string, unknown>) {
  return buildUpdate(body, INSTALLATION_FIELDS);
}

/** UTC day bounds. scheduled_date is a calendar date stored at midnight (DATE-LOCAL-002). */
export function dayBounds(day: Date): { from: string; to: string } {
  const from = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const to = new Date(from.getTime() + 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export interface CrewItem {
  kind: 'delivery' | 'installation';
  id: string;
  equipmentId: string | null;
  customerId: string | null;
  scheduledDate: string | null;
  window: string | null;
  status: string | null;
  assignedTo: string | null;
  notes: string | null;
}

/**
 * One list, ordered by window, of what a crew member is due to do.
 *
 * Deliveries and installs are separate tables with different column names for
 * the same three ideas - who it is for, when, and who is doing it - so the
 * merge happens here rather than in the handler, where it would have to be
 * written twice and would drift.
 */
export function mergeCrewDay(
  deliveries: Array<Record<string, unknown>>,
  installations: Array<Record<string, unknown>>,
): CrewItem[] {
  const items: CrewItem[] = [
    ...deliveries.map((row) => ({
      kind: 'delivery' as const,
      id: String(row.id),
      equipmentId: (row.equipment_id as string) ?? null,
      customerId: (row.customer_id as string) ?? null,
      scheduledDate: (row.scheduled_date as string) ?? null,
      window: (row.time_window as string) ?? null,
      status: (row.status as string) ?? null,
      assignedTo: (row.driver_id as string) ?? null,
      notes: (row.special_instructions as string) ?? null,
    })),
    ...installations.map((row) => ({
      kind: 'installation' as const,
      id: String(row.id),
      equipmentId: (row.equipment_id as string) ?? null,
      customerId: (row.customer_id as string) ?? null,
      scheduledDate: (row.scheduled_date as string) ?? null,
      // An install has a duration rather than a window; showing the duration in
      // the same slot beats showing nothing.
      window: row.estimated_duration ? `${row.estimated_duration} min` : null,
      status: (row.status as string) ?? null,
      assignedTo: (row.technician_id as string) ?? null,
      notes: (row.installation_notes as string) ?? null,
    })),
  ];

  // Unwindowed work sorts last: a job with no time is not a job at midnight.
  return items.sort((a, b) => {
    if (a.window === b.window) return a.kind.localeCompare(b.kind);
    if (!a.window) return 1;
    if (!b.window) return -1;
    return a.window.localeCompare(b.window);
  });
}

/**
 * Which staged -> in_transit requirements a delivery row satisfies.
 *
 * The same evidence-not-enforcement boundary WF-L-05 drew: WF-L-13 is the story
 * that makes the transition endpoint CHECK its requirements, and it accepts
 * whatever the caller claims until then. What this story owes is a durable
 * record the check can read.
 *
 * `driver_assigned` means a driver id is ON THE ROW, not that a driver exists
 * somewhere in the tenant.
 */
export function deliveryRequirements(row: Record<string, unknown> | null | undefined): string[] {
  if (!row) return [];
  const satisfied: string[] = [];
  if (row.scheduled_date && row.status !== 'cancelled') satisfied.push('delivery_scheduled');
  if (row.driver_id) satisfied.push('driver_assigned');
  return satisfied;
}
