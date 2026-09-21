/**
 * One vocabulary for writing and reading a lead's activities (PROD-008).
 *
 * `POST /api/leads/:id/activities` is the iOS app's quick-log FAB and its
 * offline write queue - the primary way a rep records a call from the field -
 * and it was broken on BOTH hosts, for two different reasons, which is why
 * neither environment contradicted the other:
 *
 *   PROD: supabase/functions/leads/ had no `activities` branch at all, so the
 *         request fell past every branch to the trailing 404.
 *   DEV:  Express spread the request body into Drizzle's `.values()`. iOS sends
 *         `type`, the column is `activity_type`, and Drizzle DROPS a key that is
 *         not a column - so `activity_type` (NOT NULL, no default) arrived null.
 *         Reproduced on Postgres 16: 23502, not inferred.
 *
 * The read side had drifted the same way. iOS decodes `leadId`, `type` and
 * `activityDate`; the columns are `business_record_id`, `activity_type` and
 * `completed_date`, and every one of those properties is optional in Swift, so
 * the timeline decoded without error and rendered a generic icon, no date and
 * no link. CRM-008 round 65's shape, one endpoint over.
 *
 * Both hosts import this module rather than keeping two copies held together by
 * a parity test: Node through `@shared/lead-activity-write`, Deno through a
 * relative `../../../shared/lead-activity-write.ts`.
 *
 * WHAT IT DROPS, IT NAMES. `latitude`, `longitude` and
 * `horizontalAccuracyMeters` are real fields the iOS quick-log sends and
 * `business_record_activities` has no column for any of them, so they are
 * reported in `ignoredFields` instead of being silently discarded (COP-B06). A
 * rep who believes a call was geotagged and finds nothing is the failure this
 * avoids; adding three columns for a feature nobody has asked to read is not
 * this story's call to make.
 */

/** Columns a caller may set. Everything else is server-supplied or absent. */
const WRITABLE = {
  activityType: 'activity_type',
  subject: 'subject',
  description: 'description',
  direction: 'direction',
  callDuration: 'call_duration',
  callOutcome: 'call_outcome',
  outcome: 'outcome',
  nextAction: 'next_action',
  scheduledDate: 'scheduled_date',
  completedDate: 'completed_date',
  dueDate: 'due_date',
  followUpDate: 'follow_up_date',
  isShared: 'is_shared',
} as const;

/**
 * Spellings a client already uses for a writable field.
 *
 * `type` and `activityDate` are the iOS app's names and cannot be changed from
 * here - that app ships on its own release cycle - so the server speaks both.
 * `activityDate` maps to `completed_date`: the quick-log records something that
 * has happened, and a logged call with a scheduled date and no completed one
 * reads as an appointment.
 */
const ALIASES: Record<string, keyof typeof WRITABLE> = {
  type: 'activityType',
  activity_type: 'activityType',
  activityDate: 'completedDate',
  activity_date: 'completedDate',
  completed_date: 'completedDate',
  scheduled_date: 'scheduledDate',
  due_date: 'dueDate',
  follow_up_date: 'followUpDate',
  next_action: 'nextAction',
  call_duration: 'callDuration',
  call_outcome: 'callOutcome',
  is_shared: 'isShared',
};

/**
 * Columns the server owns. A caller naming one is REFUSED rather than ignored,
 * because `tenant_id` decides which tenant the row belongs to and `created_by`
 * decides who is recorded as having made the call.
 */
const REFUSED = new Set([
  'id',
  'tenantId',
  'tenant_id',
  'businessRecordId',
  'business_record_id',
  'companyId',
  'company_id',
  'createdBy',
  'created_by',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'leadId',
  'lead_id',
]);

const DATE_FIELDS = new Set(['scheduledDate', 'completedDate', 'dueDate', 'followUpDate']);

export interface ActivityWriteContext {
  tenantId: string;
  businessRecordId: string;
  createdBy: string;
}

export interface ActivityWritePlan {
  /** Column-keyed row ready for PostgREST, or null when `error` is set. */
  columns: Record<string, unknown> | null;
  /**
   * The same row keyed by Drizzle property name, for the Express host.
   *
   * Dates are Date objects here and ISO strings in `columns`: drizzle's
   * timestamp column calls `.toISOString()` on whatever it is handed, and
   * PostgREST wants text. One plan, two serialisations, so neither host has to
   * re-derive the mapping and get a column name wrong on its own.
   */
  fields: Record<string, unknown> | null;
  /** Fields the caller sent that no column can hold. */
  ignoredFields: string[];
  /** Fields the caller sent that the server owns. */
  refusedFields: string[];
  /** Set when the row cannot be built at all. */
  error?: { message: string; code: string };
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Build the insert for one activity.
 *
 * `activity_type` and `subject` are both NOT NULL with no default, so a body
 * missing either is a 400 naming the field rather than a 500 out of Postgres.
 */
export function buildActivityInsert(
  body: Record<string, unknown>,
  ctx: ActivityWriteContext,
): ActivityWritePlan {
  const ignoredFields: string[] = [];
  const refusedFields: string[] = [];
  const staged: Partial<Record<keyof typeof WRITABLE, unknown>> = {};

  for (const [key, value] of Object.entries(body ?? {})) {
    if (REFUSED.has(key)) {
      refusedFields.push(key);
      continue;
    }
    const field = (key in WRITABLE ? (key as keyof typeof WRITABLE) : ALIASES[key]) ?? null;
    if (!field) {
      ignoredFields.push(key);
      continue;
    }
    // An alias and its canonical name in one body: the canonical name wins, and
    // whichever arrives second does not silently overwrite a value already set.
    if (field in staged && staged[field] !== undefined && !(key in WRITABLE)) continue;
    staged[field] = value;
  }

  const activityType = staged.activityType;
  const subject = staged.subject;
  if (typeof activityType !== 'string' || !activityType.trim()) {
    return {
      columns: null,
      fields: null,
      ignoredFields,
      refusedFields,
      error: { message: 'activityType (or type) is required', code: 'ACTIVITY_TYPE_REQUIRED' },
    };
  }
  if (typeof subject !== 'string' || !subject.trim()) {
    return {
      columns: null,
      fields: null,
      ignoredFields,
      refusedFields,
      error: { message: 'subject is required', code: 'ACTIVITY_SUBJECT_REQUIRED' },
    };
  }

  const columns: Record<string, unknown> = {
    tenant_id: ctx.tenantId,
    business_record_id: ctx.businessRecordId,
    created_by: ctx.createdBy,
  };
  const fields: Record<string, unknown> = {
    tenantId: ctx.tenantId,
    businessRecordId: ctx.businessRecordId,
    createdBy: ctx.createdBy,
  };
  for (const [field, column] of Object.entries(WRITABLE) as [keyof typeof WRITABLE, string][]) {
    if (!(field in staged)) continue;
    const raw = staged[field];
    if (DATE_FIELDS.has(field)) {
      const iso = toIso(raw);
      columns[column] = iso;
      fields[field] = iso === null ? null : new Date(iso);
    } else {
      columns[column] = raw;
      fields[field] = raw;
    }
  }

  return { columns, fields, ignoredFields, refusedFields };
}

export interface PresentedActivity extends Record<string, unknown> {
  id: string | null;
  activityType: string | null;
  /** Alias: the iOS timeline reads `type`. */
  type: string | null;
  /** Alias: the iOS timeline reads `leadId`. */
  leadId: string | null;
  /** Alias: the iOS timeline reads `activityDate`. */
  activityDate: string | null;
}

/**
 * Turn a stored row into the shape every reader expects.
 *
 * The web timeline reads camelCase column names; iOS reads three older aliases.
 * Emitting both is what lets the endpoint converge without a native release,
 * and it is the same move `toCamelAliases` makes on companies.
 */
export function presentActivity(row: Record<string, unknown>): PresentedActivity {
  // A Date has to be serialised as ISO, not by String(). Express returns
  // drizzle rows, whose timestamps are Date objects, and `String(date)` gives
  // "Mon Sep 21 2026 15:04:00 GMT+0000" - which the iOS decoder reads as no
  // date at all, while PostgREST on the other host hands back ISO text. Two
  // hosts, one presenter, and this is the line that keeps them the same.
  const str = (v: unknown) =>
    v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : String(v);
  const activityType = str(row.activity_type ?? row.activityType);
  const recordId = str(row.business_record_id ?? row.businessRecordId);
  const completedDate = str(row.completed_date ?? row.completedDate);
  const scheduledDate = str(row.scheduled_date ?? row.scheduledDate);

  return {
    id: str(row.id),
    tenantId: str(row.tenant_id ?? row.tenantId),
    businessRecordId: recordId,
    companyId: str(row.company_id ?? row.companyId),
    activityType,
    subject: str(row.subject),
    description: str(row.description),
    direction: str(row.direction),
    callDuration: (row.call_duration ?? row.callDuration ?? null) as number | null,
    callOutcome: str(row.call_outcome ?? row.callOutcome),
    outcome: str(row.outcome),
    nextAction: str(row.next_action ?? row.nextAction),
    scheduledDate,
    completedDate,
    dueDate: str(row.due_date ?? row.dueDate),
    followUpDate: str(row.follow_up_date ?? row.followUpDate),
    emailFrom: str(row.email_from ?? row.emailFrom),
    emailTo: str(row.email_to ?? row.emailTo),
    emailCc: str(row.email_cc ?? row.emailCc),
    emailSubject: str(row.email_subject ?? row.emailSubject),
    isShared: (row.is_shared ?? row.isShared ?? null) as boolean | null,
    createdBy: str(row.created_by ?? row.createdBy),
    createdAt: str(row.created_at ?? row.createdAt),
    updatedAt: str(row.updated_at ?? row.updatedAt),
    // Aliases. An activity that was logged rather than scheduled carries a
    // completed date; fall back to the scheduled one so an appointment still
    // shows a time rather than "Unknown".
    type: activityType,
    leadId: recordId,
    activityDate: completedDate ?? scheduledDate,
  };
}

/** Fields this endpoint cannot store, named on the response rather than dropped. */
export const ACTIVITY_FIELDS_WITHOUT_COLUMNS = [
  'latitude',
  'longitude',
  'horizontalAccuracyMeters',
] as const;
