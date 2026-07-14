// CRMX-016 — timezone-aware open-slot computation for public booking pages.
//
// The meetings fn's find-meeting-time hardcodes UTC business hours (13..22) and
// is not correct for a Calendly-style page where the host's availability is
// expressed in the host's own timezone. This module does proper wall-clock ->
// UTC conversion using Intl so a rule like "Mon 09:00-17:00 America/New_York"
// resolves to the right UTC instants (DST included, within Intl's accuracy).

export interface AvailabilityRule {
  dayOfWeek: number; // 0=Sun … 6=Sat
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export interface BusyWindow {
  start: number; // epoch ms
  end: number; // epoch ms
}

export interface SlotConfig {
  timezone: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  availabilityRules: AvailabilityRule[];
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Milliseconds to add to a UTC instant to get the wall-clock time in `timeZone`.
 * (i.e. localWallTimeAsIfUtc - actualUtc). Standard Intl offset trick.
 */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - instant.getTime();
}

/**
 * Convert a wall-clock time in `timeZone` to the UTC instant it represents.
 * Two-pass to settle DST offset near transitions.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = tzOffsetMs(new Date(guessUtc), timeZone);
  const candidate = guessUtc - offset1;
  const offset2 = tzOffsetMs(new Date(candidate), timeZone);
  return new Date(guessUtc - offset2);
}

/** Local calendar parts (in `timeZone`) for a UTC instant. */
export function localParts(
  instant: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  dateStr: string;
} {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  return {
    year,
    month,
    day,
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
    dateStr: `${map.year}-${map.month}-${map.day}`,
  };
}

function parseHHMM(s: string): { h: number; m: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!match) return null;
  return { h: Number(match[1]), m: Number(match[2]) };
}

/**
 * Compute open slot start-times (UTC ISO) for a single local date.
 * `localDate` is "YYYY-MM-DD" interpreted in cfg.timezone.
 */
export function computeSlotsForDate(
  localDate: string,
  cfg: SlotConfig,
  busy: BusyWindow[],
  now: Date,
): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!m) return [];
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  // Weekday of this local date (anchor at local noon to avoid tz edge slips).
  const noonUtc = zonedWallTimeToUtc(year, month, day, 12, 0, cfg.timezone);
  const weekday = localParts(noonUtc, cfg.timezone).weekday;

  const rules = cfg.availabilityRules.filter((r) => r.dayOfWeek === weekday);
  if (rules.length === 0) return [];

  const durationMs = cfg.durationMinutes * 60_000;
  const stepMs = Math.max(cfg.slotIntervalMinutes, 5) * 60_000;
  const bufBefore = cfg.bufferBeforeMinutes * 60_000;
  const bufAfter = cfg.bufferAfterMinutes * 60_000;
  const earliest = now.getTime() + cfg.minNoticeMinutes * 60_000;

  const out: string[] = [];
  const seen = new Set<number>();

  for (const rule of rules) {
    const s = parseHHMM(rule.startTime);
    const e = parseHHMM(rule.endTime);
    if (!s || !e) continue;

    const windowStart = zonedWallTimeToUtc(year, month, day, s.h, s.m, cfg.timezone).getTime();
    const windowEnd = zonedWallTimeToUtc(year, month, day, e.h, e.m, cfg.timezone).getTime();

    for (let t = windowStart; t + durationMs <= windowEnd; t += stepMs) {
      const slotStart = t;
      const slotEnd = t + durationMs;
      if (slotStart < earliest) continue;

      // Buffer-expanded window must not overlap any busy interval.
      const guardStart = slotStart - bufBefore;
      const guardEnd = slotEnd + bufAfter;
      const conflict = busy.some((b) => b.start < guardEnd && b.end > guardStart);
      if (conflict) continue;

      if (!seen.has(slotStart)) {
        seen.add(slotStart);
        out.push(new Date(slotStart).toISOString());
      }
    }
  }

  out.sort();
  return out;
}
