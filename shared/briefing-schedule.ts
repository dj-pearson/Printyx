/**
 * Daily-briefing scheduling — pure timezone/due-time helpers (US-SUPER-015).
 *
 * The morning-briefing cron (server/services/cron-service.ts) runs hourly and
 * uses these helpers to decide which users are due for a briefing at 6am in
 * THEIR local timezone (user_settings.timezone). Extracted as a pure,
 * dependency-free module so the schedule logic is unit-testable without a DB,
 * clock, or running server.
 *
 * No imports — relies only on the platform Intl API (available in Node).
 */

/** Briefings fire at 6am local time. */
export const BRIEFING_HOUR = 6;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Local hour (0-23) for `now` in `timeZone`, or NaN if the zone is invalid. */
export function localHourInTimeZone(now: Date, timeZone: string): number {
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    }).format(now);
    const h = parseInt(s, 10);
    if (!Number.isFinite(h)) return NaN;
    // Intl can emit "24" for midnight under hour12:false; normalize to 0.
    return h === 24 ? 0 : h;
  } catch {
    return NaN;
  }
}

/** Local calendar date (YYYY-MM-DD) for `now` in `timeZone`. */
export function localDateInTimeZone(now: Date, timeZone: string): string {
  try {
    // en-CA renders as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Local weekday (0=Sun..6=Sat) for `now` in `timeZone`, or NaN if invalid. */
export function localWeekdayInTimeZone(now: Date, timeZone: string): number {
  try {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
    return wd in WEEKDAY_INDEX ? WEEKDAY_INDEX[wd] : NaN;
  } catch {
    return NaN;
  }
}

export interface BriefingScheduleUser {
  /** user_settings.timezone (IANA). Falls back to America/New_York when absent. */
  timezone: string | null | undefined;
  /** daily_briefing_preferences.frequency: 'daily' | 'weekly' | 'off'. */
  frequency: string | null | undefined;
  /** Local YYYY-MM-DD a briefing was last sent (for same-day dedupe). */
  lastSentDate: string | null | undefined;
}

const DEFAULT_TZ = 'America/New_York';

/**
 * Whether a user should receive a briefing at this instant:
 *  - frequency 'off' → never;
 *  - only at the local 6am hour;
 *  - 'weekly' fires Mondays only;
 *  - never twice on the same local day (lastSentDate dedupe).
 */
export function isDueForBriefing(user: BriefingScheduleUser, now: Date): boolean {
  if (user.frequency === 'off') return false;
  const tz = user.timezone || DEFAULT_TZ;
  if (localHourInTimeZone(now, tz) !== BRIEFING_HOUR) return false;

  const today = localDateInTimeZone(now, tz);
  if (user.lastSentDate && user.lastSentDate === today) return false;

  const freq = user.frequency ?? 'daily';
  if (freq === 'weekly' && localWeekdayInTimeZone(now, tz) !== 1) return false;

  return true;
}

/** Filter a set of users down to those due for a briefing now. */
export function dueBriefingUsers<T extends BriefingScheduleUser>(users: T[], now: Date): T[] {
  return users.filter((u) => isDueForBriefing(u, now));
}
