/**
 * Activity timeline type buckets (CRM-008 AC5).
 *
 * DealDetail got this filter when CRM-008 shipped; the lead and customer
 * timelines - both rendered through `ActivityTimeline` - did not, which is the
 * same half-done-across-two-surfaces shape AC8's stage picker had. This module
 * is the shared vocabulary so the third caller cannot diverge again.
 *
 * TWO RULES, and the first is the one that matters:
 *
 * NOTHING IS EVER DROPPED. `business_record_activities.activity_type` is a free
 * varchar and its writers between them store at least eleven values - email,
 * call, meeting, note, task, demo, proposal, external, service_call, billing,
 * churn_prevention - plus the three change types below. A filter that only knew
 * five of those would hide the rest with nothing on screen saying so, and an
 * activity that silently vanishes from a timeline is worse than one wearing an
 * unfamiliar label.
 *
 * A BUCKET CAN HOLD SEVERAL TYPES. "Changes" is the reason: AC5 asks for stage
 * changes and record modifications, and those are three separate values written
 * by two different edge functions (`stage_change` from sales-pipeline,
 * `record_created`/`record_updated` from customers), so a one-value-per-tab
 * filter cannot express it.
 */

export interface TimelineBucket {
  id: string;
  label: string;
  /** Empty for `all`, which matches everything. */
  types: readonly string[];
}

export const ACTIVITY_BUCKETS: readonly TimelineBucket[] = [
  { id: 'all', label: 'All', types: [] },
  { id: 'email', label: 'Emails', types: ['email'] },
  { id: 'call', label: 'Calls', types: ['call'] },
  { id: 'meeting', label: 'Meetings', types: ['meeting'] },
  { id: 'note', label: 'Notes', types: ['note'] },
  { id: 'task', label: 'Tasks', types: ['task'] },
  { id: 'change', label: 'Changes', types: ['stage_change', 'record_created', 'record_updated'] },
  { id: 'other', label: 'Other', types: [] },
] as const;

const KNOWN_TYPES = new Set(
  ACTIVITY_BUCKETS.flatMap((b) => (b.id === 'all' || b.id === 'other' ? [] : b.types)),
);

/** Which tab an activity belongs under. An unrecognised or missing type is `other`. */
export function bucketOf(activityType: string | null | undefined): string {
  const type = (activityType ?? '').trim();
  if (!type) return 'other';
  const bucket = ACTIVITY_BUCKETS.find((b) => b.types.includes(type));
  return bucket ? bucket.id : 'other';
}

export function isKnownActivityType(activityType: string | null | undefined): boolean {
  return KNOWN_TYPES.has((activityType ?? '').trim());
}

/** Rows in the selected bucket. `all` returns everything, unknown types included. */
export function filterByBucket<T extends { activityType?: string | null }>(
  rows: readonly T[],
  bucketId: string,
): T[] {
  if (bucketId === 'all') return [...rows];
  return rows.filter((row) => bucketOf(row.activityType) === bucketId);
}

/**
 * The tabs to render, each with its count.
 *
 * `other` is shown only when something is in it: a permanently empty tab
 * labelled "Other" teaches a rep nothing, while the named buckets stay visible
 * at zero because an empty Calls tab is a real answer about this record.
 */
export function bucketTabs<T extends { activityType?: string | null }>(
  rows: readonly T[],
): Array<{ id: string; label: string; count: number }> {
  return ACTIVITY_BUCKETS.filter(
    (b) => b.id !== 'other' || rows.some((r) => bucketOf(r.activityType) === 'other'),
  ).map((b) => ({
    id: b.id,
    label: b.label,
    count:
      b.id === 'all' ? rows.length : rows.filter((r) => bucketOf(r.activityType) === b.id).length,
  }));
}
