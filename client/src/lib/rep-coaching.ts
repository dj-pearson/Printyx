/**
 * Manager coaching signals on the sales pipeline workflow (round 226).
 *
 * The Team tab ranked reps against `goal_achievement`, which
 * sales_pipeline_rep_metrics computed as closed revenue over a HARDCODED
 * $50,000 goal - no table in this product holds a per-rep revenue target - so
 * every "Below goal" flag, the performance distribution and the "Team Goal
 * Achievement" figure measured reps against a number nobody set. The SQL now
 * answers null for all three. Coaching keys off what IS recorded: how
 * recently the rep touched an account (activity_score) and how many of their
 * leads closed.
 */

import { percentOf } from '@/lib/utils';

export interface CoachingInput {
  activity_score: number;
  total_leads: number;
  deals_closed: number;
}

export const LOW_ACTIVITY = 70;
export const LOW_CONVERSION_PCT = 5;

export type CoachingReason =
  | { kind: 'activity'; score: number }
  | { kind: 'conversion'; pct: number };

/**
 * Why a manager should look at this rep, or [] when nothing says so. A rep
 * with no leads has no conversion rate at all - 0 of 0 is not 0% - so it
 * cannot be flagged for converting badly.
 */
export function coachingReasons(rep: CoachingInput): CoachingReason[] {
  const out: CoachingReason[] = [];
  if (rep.activity_score < LOW_ACTIVITY) out.push({ kind: 'activity', score: rep.activity_score });
  const pct = percentOf(rep.deals_closed, rep.total_leads);
  if (pct !== null && pct < LOW_CONVERSION_PCT) out.push({ kind: 'conversion', pct });
  return out;
}

/** "+12.5%", "-4%", or null when there was no previous month to compare. */
export function formatGrowth(rate: number | null | undefined): string | null {
  if (rate == null || !Number.isFinite(rate)) return null;
  return `${rate > 0 ? '+' : ''}${rate}%`;
}

export interface OneOnOneBody {
  title: string;
  startTime: string;
  endTime: string;
  eventType: 'meeting';
  relatedEntityType: 'user';
  relatedEntityId: string;
}

/**
 * The calendar_events body for a 1:1, or null when the date or time is
 * missing or the length is not a positive number of minutes. The event lands
 * on the MANAGER's calendar (the POST writes user_id from the caller) and
 * names the rep it is about through related_entity_*.
 */
export function oneOnOneBody(
  rep: { rep_id: string; rep_name: string },
  date: string,
  time: string,
  minutes: number,
): OneOnOneBody | null {
  if (!date || !time || !Number.isFinite(minutes) || minutes <= 0) return null;
  const start = new Date(`${date}T${time}`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + minutes * 60_000);
  return {
    title: `1:1 with ${rep.rep_name}`,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    eventType: 'meeting',
    relatedEntityType: 'user',
    relatedEntityId: rep.rep_id,
  };
}
