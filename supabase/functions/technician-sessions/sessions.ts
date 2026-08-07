/**
 * Pure logic for the technician-sessions edge function (PROD-011).
 *
 * Split out of index.ts so it can be unit-tested under Node: index.ts imports
 * ../_shared/supabase.ts, which pulls @supabase/supabase-js from esm.sh at
 * runtime and cannot be loaded by vitest.
 */

/**
 * Guided-workflow step -> service-ticket status, lifted verbatim from
 * server/routes-enhanced-service.ts (the `statusMapping` in the update-step
 * handler). `check_in` is absent on purpose: check-in is its own endpoint and
 * sets 'on_site'.
 */
export const STEP_TICKET_STATUS: Record<string, string> = {
  initial_assessment: 'in-progress',
  diagnosis: 'in-progress',
  customer_approval: 'customer_approval',
  work_execution: 'in-progress',
  testing: 'testing',
  completion: 'completed',
};

/**
 * Express default for an unrecognised step name.
 *
 * hasOwnProperty, not a bare lookup: a step named 'toString' or 'constructor'
 * would otherwise resolve to an inherited Object member and be written into
 * service_tickets.status as a function.
 */
export function ticketStatusForStep(stepName: string | null | undefined): string {
  if (!stepName || !isKnownStepName(stepName)) return 'in-progress';
  return STEP_TICKET_STATUS[stepName];
}

/**
 * The steps the technician workflow walks, in order, matching the `workflowSteps`
 * array in client/src/components/service/TechnicianTicketWorkflow.tsx minus
 * `check_in`. Used only to reject a step name that no client can produce, so a
 * typo cannot park a service ticket in a status nothing maps back out of.
 */
export const WORKFLOW_STEP_NAMES = Object.keys(STEP_TICKET_STATUS);

export function isKnownStepName(stepName: unknown): stepName is string {
  return (
    typeof stepName === 'string' &&
    Object.prototype.hasOwnProperty.call(STEP_TICKET_STATUS, stepName)
  );
}

export interface TechnicianSession {
  id: string;
  tenantId: string | null;
  serviceTicketId: string | null;
  technicianId: string | null;
  expectedLatitude: string | null;
  expectedLongitude: string | null;
  actualLatitude: string | null;
  actualLongitude: string | null;
  locationVerified: boolean | null;
  distanceFromExpected: string | null;
  checkInTimestamp: string | null;
  checkInAddress: string | null;
  checkInNotes: string | null;
  workflowStep: string | null;
  initialAssessment: string | null;
  diagnosisNotes: string | null;
  customerApprovalNeeded: boolean | null;
  customerApprovalReceived: boolean | null;
  workPerformed: string | null;
  partsUsedIds: unknown;
  partsRequestedIds: unknown;
  issueResolved: boolean | null;
  followUpRequired: boolean | null;
  followUpReason: string | null;
  checkOutTimestamp: string | null;
  totalDuration: number | null;
  billableHours: string | null;
  customerPresent: boolean | null;
  customerSignature: string | null;
  customerSatisfactionRating: number | null;
  customerFeedback: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Explicit column -> camelCase mapping. The page reads camelCase keys straight
 * off the response (`session.id`, `session.totalDuration`), so returning raw
 * snake_case rows renders blank — the same defect EDGE-005a hit on AP/AR.
 *
 * `parts_used_ids` / `parts_requested_ids` are jsonb and are passed through
 * untouched: never key-convert a jsonb column.
 *
 * NOTE the column is `total_duration_minutes`, not `total_duration`.
 */
export function toCamelSession(row: Record<string, unknown>): TechnicianSession {
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) ?? null,
    serviceTicketId: (row.service_ticket_id as string) ?? null,
    technicianId: (row.technician_id as string) ?? null,
    expectedLatitude: (row.expected_latitude as string) ?? null,
    expectedLongitude: (row.expected_longitude as string) ?? null,
    actualLatitude: (row.actual_latitude as string) ?? null,
    actualLongitude: (row.actual_longitude as string) ?? null,
    locationVerified: (row.location_verified as boolean) ?? null,
    distanceFromExpected: (row.distance_from_expected as string) ?? null,
    checkInTimestamp: (row.check_in_timestamp as string) ?? null,
    checkInAddress: (row.check_in_address as string) ?? null,
    checkInNotes: (row.check_in_notes as string) ?? null,
    workflowStep: (row.workflow_step as string) ?? null,
    initialAssessment: (row.initial_assessment as string) ?? null,
    diagnosisNotes: (row.diagnosis_notes as string) ?? null,
    customerApprovalNeeded: (row.customer_approval_needed as boolean) ?? null,
    customerApprovalReceived: (row.customer_approval_received as boolean) ?? null,
    workPerformed: (row.work_performed as string) ?? null,
    partsUsedIds: row.parts_used_ids ?? null,
    partsRequestedIds: row.parts_requested_ids ?? null,
    issueResolved: (row.issue_resolved as boolean) ?? null,
    followUpRequired: (row.follow_up_required as boolean) ?? null,
    followUpReason: (row.follow_up_reason as string) ?? null,
    checkOutTimestamp: (row.check_out_timestamp as string) ?? null,
    totalDuration: (row.total_duration_minutes as number) ?? null,
    billableHours: (row.billable_hours as string) ?? null,
    customerPresent: (row.customer_present as boolean) ?? null,
    customerSignature: (row.customer_signature as string) ?? null,
    customerSatisfactionRating: (row.customer_satisfaction_rating as number) ?? null,
    customerFeedback: (row.customer_feedback as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

export interface WorkflowStepRow {
  id: string;
  tenantId: string | null;
  sessionId: string | null;
  stepName: string | null;
  stepStarted: string | null;
  /** Timestamp, NOT a boolean — the page treats it as truthy-means-done. */
  stepCompleted: string | null;
  stepData: unknown;
  notes: string | null;
  createdAt: string | null;
}

/** `step_data` is jsonb — passed through untouched. */
export function toCamelWorkflowStep(row: Record<string, unknown>): WorkflowStepRow {
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) ?? null,
    sessionId: (row.session_id as string) ?? null,
    stepName: (row.step_name as string) ?? null,
    stepStarted: (row.step_started as string) ?? null,
    stepCompleted: (row.step_completed as string) ?? null,
    stepData: row.step_data ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
  };
}

/**
 * The steps a client should treat as done: exactly those with a completion
 * timestamp. The page filters on truthiness of `stepCompleted`, so this is the
 * same predicate, expressed once and testable.
 */
export function completedStepNames(steps: WorkflowStepRow[]): string[] {
  return steps
    .filter((step) => Boolean(step.stepCompleted) && Boolean(step.stepName))
    .map((step) => step.stepName as string);
}

export interface ParsedGps {
  latitude: string | null;
  longitude: string | null;
  /** The raw input, kept when it is not a coordinate pair so nothing typed is lost. */
  address: string | null;
}

/**
 * The check-in form's "GPS Location (Optional)" field is free text placeheld
 * "Current location coordinates". A "lat, lng" pair goes into the decimal
 * columns; anything else is kept verbatim in check_in_address rather than
 * dropped, because a technician who typed a street address should not have it
 * silently discarded.
 *
 * Out-of-range values are treated as not-coordinates: a latitude of 200 is a
 * typo or some other kind of string, not a place.
 */
export function parseGpsLocation(raw: unknown): ParsedGps {
  if (typeof raw !== 'string') return { latitude: null, longitude: null, address: null };
  const trimmed = raw.trim();
  if (!trimmed) return { latitude: null, longitude: null, address: null };

  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (match) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: match[1], longitude: match[2], address: null };
    }
  }
  return { latitude: null, longitude: null, address: trimmed };
}

/**
 * The arrival time the technician entered, as an ISO string. The input is a
 * `datetime-local` control, so it arrives without a zone; anything unparseable
 * falls back to null and lets the column default to now().
 */
export function parseArrivalTime(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
