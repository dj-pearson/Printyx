/**
 * Who may read a meeting recording (SEC-EDGE-001).
 *
 * THE ACCESS MODEL WAS ALREADY IN THE SCHEMA AND NOTHING READ IT.
 * `meeting_recordings` declares `uploaded_by uuid NOT NULL`, `is_public boolean
 * DEFAULT false` and `access_permissions jsonb DEFAULT '[]'` - an owner, a share
 * flag and a grant list - while every handler filtered on `tenant_id` alone. So
 * a recording created with the default `is_public = false` was readable by every
 * authenticated member of the tenant anyway, and the column said the opposite.
 *
 * What that exposed is the whole content of the meeting, not a row count: the
 * tenant-wide list, any meeting's recordings, the full transcript of any
 * recording, its AI notes and highlights, and `POST /content/search`, which runs
 * `ilike` across every transcript in the tenant and hands back snippets. Type a
 * word into that box and read what was said in someone else's call.
 *
 * The page is `alwaysVisible`, so a role gate is the wrong instrument - it would
 * take the feature away from the reps it exists for. This narrows ROWS instead,
 * which is COP-I06's shape: a rep has recordings and should see them; what
 * changes is whose.
 *
 * VISIBLE TO A CALLER = uploaded by someone inside their resolved scope tier,
 * OR flagged `is_public`. A company-tier caller keeps the whole tenant, because
 * `resolveScope` returns `userIds === null` for them and there is nothing to
 * narrow.
 *
 * `access_permissions` IS NOT HONOURED AND THAT IS DELIBERATE: nothing in the
 * tree writes it, so every row holds the `'[]'` default and a filter over it
 * could only ever match zero rows. Implementing the read without the write would
 * add a per-recording sharing control that no UI can grant, which is worse than
 * the gap. The gap is named in `unbacked` on the responses that would use it.
 */

import { isUnscoped, type ResolvedScope } from '../_shared/scope.ts';
import type { AuthContext } from '../_shared/auth.ts';
import type { SupabaseClient } from '../_shared/db.ts';

/**
 * The largest accessible-recording set expressible as one PostgREST `in()`
 * filter, matching `CUSTOMER_SCOPE_CAP`'s reasoning: ~500 uuids is already 19KB
 * of URL. This caps the FILTER, not a page size, and a caller who exceeds it is
 * TOLD (`scopeTruncated`) rather than quietly shown a subset - a search that
 * silently stops covering half a manager's team is worse than one that says so.
 */
export const RECORDING_SCOPE_CAP = 500;

export const RECORDING_UNBACKED = [
  'meeting_recordings.access_permissions is not honoured: no code path writes it, so every row holds the empty default and filtering on it would match nothing. Per-recording sharing needs a write path before a read means anything.',
];

/**
 * Filter a query ON `meeting_recordings` to what this caller may see.
 *
 * `applyUserScope` emits ONE `.or(...)`, and two `.or()` calls on a PostgREST
 * query are ANDed - so the public-recording clause cannot be a second call, it
 * has to be inside the same disjunction. That is why this builds the clause list
 * rather than composing two helpers.
 */
export function applyRecordingScope<Q>(query: Q, scope: ResolvedScope): Q {
  if (isUnscoped(scope)) return query;
  const ids = scope.userIds ?? [];
  // `uploaded_by` is NOT NULL, so the unowned-row question applyUserScope
  // answers does not arise here; includeUnowned would only widen wrongly.
  const list = ids.map((id) => `"${id.replace(/["\\]/g, (c) => '\\' + c)}"`).join(',');
  const clauses = ids.length > 0 ? [`uploaded_by.in.(${list})`] : [];
  clauses.push('is_public.is.true');
  return (query as any).or(clauses.join(','));
}

export interface RecordingAccess {
  scope: ResolvedScope;
  /** null means every recording in the tenant - nothing to narrow. */
  recordingIds: string[] | null;
  /** null for the same reason. Meetings reachable through those recordings. */
  meetingIds: string[] | null;
  /** True when the caller has more accessible recordings than the filter cap. */
  truncated: boolean;
}

/**
 * The ids a scoped caller may reach, for the tables that key on a recording or a
 * meeting rather than carrying an owner of their own -
 * `meeting_transcriptions`, `meeting_notes`, `meeting_highlights`,
 * `meeting_speakers` and the consent records.
 */
export async function resolveRecordingAccess(
  db: SupabaseClient,
  auth: AuthContext,
  scope: ResolvedScope,
): Promise<RecordingAccess> {
  if (isUnscoped(scope)) {
    return { scope, recordingIds: null, meetingIds: null, truncated: false };
  }

  const query = applyRecordingScope(
    db
      .from('meeting_recordings')
      .select('id, meeting_id')
      .eq('tenant_id', auth.tenantId)
      .order('uploaded_at', { ascending: false })
      .limit(RECORDING_SCOPE_CAP + 1),
    scope,
  );

  const { data, error } = await query;
  if (error) {
    // Fail CLOSED. An access resolver that returns "everything" when the
    // database is unreachable turns an outage into the exposure it exists to
    // close.
    return { scope, recordingIds: [], meetingIds: [], truncated: false };
  }

  const rows = (data ?? []) as { id: string; meeting_id: string | null }[];
  const truncated = rows.length > RECORDING_SCOPE_CAP;
  const kept = truncated ? rows.slice(0, RECORDING_SCOPE_CAP) : rows;

  return {
    scope,
    recordingIds: kept.map((r) => r.id),
    meetingIds: [...new Set(kept.map((r) => r.meeting_id).filter((m): m is string => Boolean(m)))],
    truncated,
  };
}

/**
 * Can this caller reach one recording?
 *
 * Asked as its own query rather than by membership of the capped id list above:
 * a manager past the cap would otherwise be refused a recording they own, and a
 * single-row check has no cap to exceed.
 */
export async function canAccessRecording(
  db: SupabaseClient,
  auth: AuthContext,
  scope: ResolvedScope,
  recordingId: string,
): Promise<boolean> {
  if (isUnscoped(scope)) return true;
  const { data, error } = await applyRecordingScope(
    db
      .from('meeting_recordings')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .eq('id', recordingId)
      .limit(1),
    scope,
  );
  if (error) return false;
  return ((data ?? []) as unknown[]).length > 0;
}

/** Can this caller reach any recording of one meeting? */
export async function canAccessMeeting(
  db: SupabaseClient,
  auth: AuthContext,
  scope: ResolvedScope,
  meetingId: string,
): Promise<boolean> {
  if (isUnscoped(scope)) return true;
  const { data, error } = await applyRecordingScope(
    db
      .from('meeting_recordings')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .eq('meeting_id', meetingId)
      .limit(1),
    scope,
  );
  if (error) return false;
  return ((data ?? []) as unknown[]).length > 0;
}

/**
 * What the response says about the narrowing.
 *
 * A narrowed list that does not say it was narrowed is a wrong answer, not a
 * safe one (COP-I06) - here it would read as "this company records very few
 * meetings".
 */
export function describeScope(scope: ResolvedScope) {
  return {
    scopeTier: scope.tier,
    coversWholeTenant: isUnscoped(scope),
    degradedFrom: scope.degradedFrom,
    /**
     * False here by construction. A query ON `meeting_recordings` carries the
     * predicate itself, so there is no id list to exceed - only the callers
     * that have to go through `resolveRecordingAccess` can be truncated, and
     * they use the overload below. Reporting it either way keeps one response
     * shape for the page to read.
     */
    scopeTruncated: false,
  };
}

export function describeRecordingScope(access: RecordingAccess) {
  return { ...describeScope(access.scope), scopeTruncated: access.truncated };
}
