/**
 * Installed-base derivations (COP-M05).
 *
 * The pure arithmetic behind "attaching a machine fills in the deal fields
 * instead of making the rep retype them". Kept out of the handler so it can be
 * tested without a database: server/tests/unit/installed-base.test.ts imports
 * this file directly.
 */

/** Average days in a month. Meter periods are rarely whole months. */
const DAYS_PER_MONTH = 30.44;

export interface MeterReading {
  reading_date?: string | null;
  bw_meter_reading?: number | string | null;
  color_meter_reading?: number | string | null;
}

export interface MonthlyVolume {
  bw: number | null;
  color: number | null;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Monthly print volume from a machine's meter history.
 *
 * Takes the two most recent readings and annualises the delta. Returns null for
 * a counter rather than a zero when the answer is unknowable, because a zero
 * would be read as "this machine prints nothing", which is a very different
 * claim and would price a deal wrongly.
 *
 * Null when: fewer than two readings; the readings share a date (no elapsed
 * time to divide by); or the counter went DOWN, which means the meter was reset
 * or the logic board replaced, and the delta is meaningless.
 *
 * `readings` may arrive in any order; this sorts by reading_date descending.
 */
export function monthlyVolumeFromReadings(readings: MeterReading[]): MonthlyVolume {
  const dated = readings
    .filter((r) => r.reading_date)
    .map((r) => ({ ...r, time: new Date(r.reading_date as string).getTime() }))
    .filter((r) => Number.isFinite(r.time))
    .sort((a, b) => b.time - a.time);

  if (dated.length < 2) return { bw: null, color: null };

  const [latest, previous] = dated;
  const days = (latest.time - previous.time) / 86_400_000;
  if (days <= 0) return { bw: null, color: null };

  const perMonth = (
    a: number | string | null | undefined,
    b: number | string | null | undefined,
  ): number | null => {
    const end = toNumber(a);
    const start = toNumber(b);
    if (end === null || start === null) return null;
    const delta = end - start;
    if (delta < 0) return null;
    return Math.round((delta / days) * DAYS_PER_MONTH);
  };

  return {
    bw: perMonth(latest.bw_meter_reading, previous.bw_meter_reading),
    color: perMonth(latest.color_meter_reading, previous.color_meter_reading),
  };
}

/**
 * Total buyout exposure across a set of leases.
 *
 * Returns null when no lease carries an amount, so the caller can leave the
 * deal field empty rather than writing a confident 0.00 that says "no exposure"
 * when the truth is "we do not know".
 */
export function totalBuyoutExposure(
  leases: Array<{ buyout_amount?: number | string | null }>,
): number | null {
  const amounts = leases
    .map((l) => toNumber(l.buyout_amount))
    .filter((n): n is number => n !== null);
  if (amounts.length === 0) return null;
  return amounts.reduce((sum, n) => sum + n, 0);
}

/**
 * Sums a per-machine volume across machines, treating unknown as unknown.
 * Returns null only when EVERY machine was unknown; one known machine still
 * gives a floor, which is more useful to a rep than nothing.
 */
export function sumVolumes(volumes: MonthlyVolume[]): MonthlyVolume {
  const total = (pick: (v: MonthlyVolume) => number | null): number | null => {
    const known = volumes.map(pick).filter((n): n is number => n !== null);
    return known.length === 0 ? null : known.reduce((sum, n) => sum + n, 0);
  };
  return { bw: total((v) => v.bw), color: total((v) => v.color) };
}
