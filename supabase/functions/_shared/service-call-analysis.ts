/**
 * Service call analysis: the write plan and the ticket side effect (round 163).
 *
 * ServiceTicketAnalysis.tsx records how a visit went - what kind of visit, how
 * it ended, time on site, root cause, labour - against `service_call_analysis`.
 * Nothing served it in production: the page posts to
 * /api/service-tickets/:id/analysis, the service-tickets function had no such
 * branch, and the service-analysis function read and wrote `service_analyses`,
 * a table in no schema and no migration. Dev was no better, because
 * /api/service-tickets is proxied, so the Express handlers for that path never
 * ran either.
 *
 * Plain TypeScript with no imports, so a unit test can drive it.
 */

/** The `analysis_type` enum, migration 0000. */
export const ANALYSIS_TYPES = [
  'diagnostic',
  'repair',
  'maintenance',
  'installation',
  'inspection',
  'training',
] as const;

/** The `service_outcome` enum, migration 0000. */
export const SERVICE_OUTCOMES = [
  'resolved',
  'partial_fix',
  'requires_parts',
  'requires_escalation',
  'customer_declined',
  'follow_up_needed',
  'warranty_claim',
  'preventive_maintenance',
] as const;

/** camelCase body field -> column, for every column a caller may set. */
const FIELDS: Record<string, string> = {
  analysisType: 'analysis_type',
  outcome: 'outcome',
  callStartTime: 'call_start_time',
  callEndTime: 'call_end_time',
  actualArrivalTime: 'actual_arrival_time',
  onSiteTime: 'on_site_time_minutes',
  travelTime: 'travel_time_minutes',
  problemDescription: 'problem_description',
  rootCause: 'root_cause',
  actionsTaken: 'actions_taken',
  equipmentCondition: 'equipment_condition',
  meterReading: 'meter_reading',
  diagnosticCodes: 'diagnostic_codes',
  customerPresent: 'customer_present',
  customerSignature: 'customer_signature',
  customerFeedback: 'customer_feedback',
  customerSatisfactionScore: 'customer_satisfaction_score',
  followUpRequired: 'follow_up_required',
  followUpDate: 'follow_up_date',
  followUpReason: 'follow_up_reason',
  laborHours: 'labor_hours',
  laborRate: 'labor_rate',
  totalLaborCost: 'total_labor_cost',
  beforePhotos: 'before_photos',
  afterPhotos: 'after_photos',
};

/** Set by the server from the request, never from the body. */
const SERVER_OWNED = new Set([
  'id',
  'tenantId',
  'tenant_id',
  'serviceTicketId',
  'service_ticket_id',
  'technicianId',
  'technician_id',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
]);

export interface AnalysisPlan {
  row: Record<string, unknown>;
  /** Required fields the body did not carry, or carried with a bad value. */
  invalid: string[];
  /** Keys the body sent that are not columns. */
  ignoredFields: string[];
}

export function buildAnalysisRow(
  body: Record<string, unknown>,
  ctx: { tenantId: string; ticketId: string; userId: string },
  mode: 'create' | 'update',
): AnalysisPlan {
  const row: Record<string, unknown> = {};
  const ignoredFields: string[] = [];
  const snakeToCamel = new Map(Object.entries(FIELDS).map(([c, s]) => [s, c]));

  for (const [key, value] of Object.entries(body ?? {})) {
    if (value === undefined || SERVER_OWNED.has(key)) continue;
    const column = FIELDS[key] ?? (snakeToCamel.has(key) ? key : undefined);
    if (!column) {
      ignoredFields.push(key);
      continue;
    }
    row[column] = value === '' ? null : value;
  }

  const invalid: string[] = [];
  if (row.analysis_type !== undefined && !ANALYSIS_TYPES.includes(row.analysis_type as never)) {
    invalid.push('analysisType');
  }
  if (row.outcome !== undefined && !SERVICE_OUTCOMES.includes(row.outcome as never)) {
    invalid.push('outcome');
  }

  if (mode === 'create') {
    // The NOT NULLs, named rather than left to a 23502.
    for (const [column, field] of [
      ['analysis_type', 'analysisType'],
      ['outcome', 'outcome'],
      ['call_start_time', 'callStartTime'],
      ['problem_description', 'problemDescription'],
    ] as const) {
      if (row[column] === undefined || row[column] === null || row[column] === '') {
        if (!invalid.includes(field)) invalid.push(field);
      }
    }
    row.tenant_id = ctx.tenantId;
    row.service_ticket_id = ctx.ticketId;
    // The person recording the visit is the technician of record; the column
    // is NOT NULL and there is no picker for anyone else on the form.
    row.technician_id = ctx.userId;
  }

  return { row, invalid, ignoredFields };
}

/**
 * What an analysis outcome does to its ticket, in the ticket vocabulary.
 *
 * The Express version wrote 'awaiting_parts', which is not in the ticket
 * status CHECK constraint (migration 0078), so every requires_parts analysis
 * would have failed at the update. `on_hold` is the vocabulary's word for work
 * that cannot proceed yet. Every other outcome leaves the ticket alone,
 * because partial fixes and escalations are decisions for a person.
 */
export function ticketStatusForOutcome(outcome: unknown): 'completed' | 'on_hold' | null {
  if (outcome === 'resolved') return 'completed';
  if (outcome === 'requires_parts') return 'on_hold';
  return null;
}
