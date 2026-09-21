/**
 * "Meetings needing follow-up" - COP-B01 AC1's card, derived.
 *
 * The My Day slot with that id rendered UPCOMING activities under the heading
 * "Coming Up": a useful card, but not this one and not what the AC names. A
 * meeting needs follow-up once it has HAPPENED and nothing has been logged on
 * the account since; a meeting three days from now needs preparation, which is
 * a different card and now has its own catalogue entry.
 *
 * `business_record_activities` is the table both live on. `activity_type` is a
 * free varchar and 'meeting' is really written to it - `public-booking` stamps
 * it when a prospect self-schedules, and the activity composer CRM-008 built
 * passes whatever the rep picks - so this is a derivation over rows that exist,
 * not a read of a table nobody fills (AUDIT-028).
 *
 * THE RULES, each with a reason a rep would recognise:
 *
 *   - A LATER ACTIVITY ON THE SAME ACCOUNT closes the meeting out, whatever its
 *     type. A logged call, an email, a task, a note - any of them is the rep
 *     having done something since, and listing the meeting anyway is how a
 *     worklist trains people to ignore it.
 *   - A MEETING STILL IN THE FUTURE IS NOT OVERDUE FOR ANYTHING. Comparing on
 *     `scheduled_date` alone would put tomorrow's meeting on the list the moment
 *     nothing followed it, which is every future meeting.
 *   - A MEETING WITH NO ACCOUNT CANNOT BE CHECKED. There is nothing to look for
 *     a follow-up on, so it is neither listed nor silently dropped: it is
 *     counted and named, because "we could not check these" and "these are fine"
 *     are different answers (COP-B12's null-is-not-empty, one layer out).
 *   - THE MEETING'S OWN `completed_date` IS NOT THE TEST. A rep who never ticks
 *     a meeting off has not failed to follow it up, and one who ticks every
 *     meeting off has not followed any of them up. What matters is whether
 *     anything happened afterwards.
 */

/** The activity columns this derivation needs. Both inputs share the shape. */
export interface FollowUpActivityRow {
  id: string;
  subject?: string | null;
  activity_type?: string | null;
  scheduled_date?: string | null;
  completed_date?: string | null;
  business_record_id?: string | null;
}

export interface MeetingNeedingFollowUp {
  id: string;
  subject: string;
  businessRecordId: string;
  /** The account name when the caller could resolve one; never invented. */
  accountName: string | null;
  /** ISO timestamp of when the meeting was held. */
  metAt: string;
  /** Whole days between the meeting and `now`, for ranking and for the UI. */
  daysSince: number;
}

export interface FollowUpResult {
  meetings: MeetingNeedingFollowUp[];
  /**
   * Meetings that carried no `business_record_id`, so no follow-up could be
   * looked for. Reported rather than counted as either answer.
   */
  unlinkedMeetings: number;
}

const DAY_MS = 86400000;

/** A parsed timestamp, or null - an unparseable date is not a date. */
function at(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Meetings held before `now` with nothing logged on the account since.
 *
 * `meetings` is the candidate set (already filtered to type and window by the
 * caller, which is what the database is for); `activities` is every activity on
 * those accounts, the meetings included - a meeting is not its own follow-up, so
 * rows are matched by id and skipped.
 */
export function meetingsNeedingFollowUp(
  meetings: FollowUpActivityRow[],
  activities: FollowUpActivityRow[],
  now: Date,
  accountNames: Map<string, string> = new Map(),
): FollowUpResult {
  const nowMs = now.getTime();

  /** Latest activity timestamp per account, ignoring the meeting itself. */
  const byRecord = new Map<string, Array<{ id: string; ms: number }>>();
  for (const row of activities) {
    const recordId = row.business_record_id;
    if (!recordId) continue;
    // An activity is "logged" at whichever of its stamps exists. completed_date
    // is preferred because it is when the thing actually happened; a scheduled
    // future task also counts, since a booked next step IS a follow-up.
    const ms = at(row.completed_date) ?? at(row.scheduled_date);
    if (ms === null) continue;
    const list = byRecord.get(recordId);
    if (list) list.push({ id: row.id, ms });
    else byRecord.set(recordId, [{ id: row.id, ms }]);
  }

  const out: MeetingNeedingFollowUp[] = [];
  let unlinkedMeetings = 0;

  for (const meeting of meetings) {
    const metAtMs = at(meeting.scheduled_date);
    if (metAtMs === null) continue;
    // Has not happened yet: preparation, not follow-up.
    if (metAtMs > nowMs) continue;

    if (!meeting.business_record_id) {
      unlinkedMeetings += 1;
      continue;
    }

    const others = byRecord.get(meeting.business_record_id) ?? [];
    const followedUp = others.some((a) => a.id !== meeting.id && a.ms > metAtMs);
    if (followedUp) continue;

    out.push({
      id: meeting.id,
      subject: meeting.subject?.trim() || 'Meeting',
      businessRecordId: meeting.business_record_id,
      accountName: accountNames.get(meeting.business_record_id) ?? null,
      metAt: new Date(metAtMs).toISOString(),
      daysSince: Math.floor((nowMs - metAtMs) / DAY_MS),
    });
  }

  // Longest-waiting first: the one most likely to have gone cold.
  out.sort((a, b) => b.daysSince - a.daysSince || a.subject.localeCompare(b.subject));
  return { meetings: out, unlinkedMeetings };
}
