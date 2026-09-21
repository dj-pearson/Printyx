/**
 * Bulk assignment of platform CRM records, and the trail it leaves.
 *
 * THE BUTTON EXISTED ON NEITHER HOST (round 130). PlatformBusinessRecords.tsx
 * posts `/api/platform-crm/business-records/bulk/assign` and nothing served
 * it: no Express route registers that path, and the edge function's branches
 * stop at `business-records/:id`, so the request fell past them. It was a bare
 * fetch too, so in production it resolved against the static origin and
 * `response.json()` parsed the SPA shell into a syntax error the mutation
 * reported as "Failed to assign records".
 *
 * AND THE SINGLE-RECORD PATCH BESIDE IT COULD NOT ASSIGN EITHER.
 * `BUSINESS_RECORD_COLUMNS` - the write whitelist `toRecordColumns` filters
 * against - contained `assigned_rep`, and the column is `assigned_sales_rep`
 * (checked against migration 0000, not just the declaration; the index is
 * named `platform_business_records_assigned_rep_idx` and sits ON
 * `assignedSalesRep`, which is where the wrong name came from). An unknown
 * column fails the WHOLE statement, so a PATCH carrying `assignedRep` was a
 * PGRST204 and nothing in it landed. `check:phantom-cols` could not see it:
 * the payload is built by a helper from a named Set, its documented blind
 * spot, the same shape as round 125's settings upsert.
 *
 * `platform_lead_assignment_history` IS A REAL TABLE WITH NO WRITER. It
 * carries assigned_from, assigned_to, assigned_by, a reason and a timestamp -
 * everything a "who moved this prospect, and when" question needs - and
 * AUDIT-028's answer to it was nobody. An assignment that leaves no trail is
 * indistinguishable from one that never happened, which on a reassignment
 * dispute is the whole argument, so the plan below writes one row per record
 * that actually moved.
 *
 * FOUR RULES.
 *
 * A RECORD ALREADY ASSIGNED TO THAT REP IS NOT A CHANGE. It is skipped and
 * counted separately rather than rewritten, so the history does not fill with
 * rows saying nothing moved, and the count the UI reports is what happened
 * (round 78: count successes, never attempts).
 *
 * `assigned_from` IS WHOEVER HELD IT, INCLUDING NOBODY. An unassigned record
 * records null rather than a sentinel, because "was unassigned" and "we did
 * not look" must not read the same.
 *
 * AN EMPTY OR OVERSIZED REQUEST IS REFUSED, not silently truncated: a bulk
 * action that quietly drops half its selection is COP-I01's shape on a write.
 *
 * AND THE PLAN NAMES WHAT IT COULD NOT FIND. Ids that match no record are
 * reported rather than absorbed into the skipped count, since a stale
 * selection and an already-assigned record are different answers.
 */

/** One selection is one screen of records; more than this is a script's job. */
export const MAX_BULK_ASSIGN = 200;

export type AssignableRecord = {
  id: string;
  assigned_sales_rep?: string | null;
};

export type AssignmentHistoryRow = {
  business_record_id: string;
  assigned_from: string | null;
  assigned_to: string;
  assignment_reason: string;
  assigned_by: string | null;
  assigned_at: string;
};

export type BulkAssignPlan = {
  /** Records whose rep actually changes. */
  changedIds: string[];
  /** Already held by that rep - untouched, and not an error. */
  unchangedIds: string[];
  /** Requested but not found. */
  missingIds: string[];
  history: AssignmentHistoryRow[];
  error?: string;
};

export function buildBulkAssignPlan(options: {
  recordIds: unknown;
  assignedRep: unknown;
  found: AssignableRecord[];
  actorId?: string | null;
  reason?: string;
  now?: Date;
}): BulkAssignPlan {
  const empty: BulkAssignPlan = {
    changedIds: [],
    unchangedIds: [],
    missingIds: [],
    history: [],
  };

  const assignedRep = typeof options.assignedRep === 'string' ? options.assignedRep.trim() : '';
  if (!assignedRep) {
    return { ...empty, error: 'assignedRep is required' };
  }

  if (!Array.isArray(options.recordIds)) {
    return { ...empty, error: 'recordIds must be an array' };
  }

  const requested = [
    ...new Set(
      options.recordIds.filter((id): id is string => typeof id === 'string' && id.trim() !== ''),
    ),
  ];

  if (requested.length === 0) {
    return { ...empty, error: 'recordIds must contain at least one id' };
  }
  if (requested.length > MAX_BULK_ASSIGN) {
    return {
      ...empty,
      error: `recordIds may not exceed ${MAX_BULK_ASSIGN} records in one request`,
    };
  }

  const byId = new Map(options.found.map((r) => [r.id, r]));
  const at = (options.now ?? new Date()).toISOString();
  const reason = options.reason ?? 'manual';

  const changedIds: string[] = [];
  const unchangedIds: string[] = [];
  const missingIds: string[] = [];
  const history: AssignmentHistoryRow[] = [];

  for (const id of requested) {
    const record = byId.get(id);
    if (!record) {
      missingIds.push(id);
      continue;
    }
    const current = record.assigned_sales_rep ?? null;
    if (current === assignedRep) {
      unchangedIds.push(id);
      continue;
    }
    changedIds.push(id);
    history.push({
      business_record_id: id,
      assigned_from: current,
      assigned_to: assignedRep,
      assignment_reason: reason,
      assigned_by: options.actorId ?? null,
      assigned_at: at,
    });
  }

  return { changedIds, unchangedIds, missingIds, history };
}
