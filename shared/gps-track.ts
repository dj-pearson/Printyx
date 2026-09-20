/**
 * Turning a GPS track into a day's mileage (AUDIT-037 follow-up).
 *
 * `location_history` has latitude, longitude, accuracy, heading, speed,
 * address, session_id and a timestamp. It has NO distance column, no ticket id
 * and no activity type - `shared/gps-tracking-schema.ts` declared all three and
 * the table has never had them, so `calculateMileageFromGPS` summed
 * `record.distanceFromPrevious` over rows that could not carry it. The query
 * itself was a 42703 on every call and the catch answered zero miles, so the
 * nightly job reported that every technician drove nowhere.
 *
 * Distance IS derivable from what the table has, which is why this exists
 * rather than a 501: consecutive fixes plus the great-circle distance between
 * them is how a GPS track becomes a trip length.
 *
 * WHAT IS NOT DERIVABLE IS SAID, not defaulted. Stops needs a dwell radius and
 * a dwell time that nobody has specified, and the old code counted distinct
 * ticket ids - a column that does not exist - so it was always zero. Trips are
 * sessions when the rows carry one and null when they do not; the old code did
 * `trips > 0 ? trips : 1`, which invents a journey for a technician who never
 * moved.
 */

export interface TrackPoint {
  latitude: string | number | null;
  longitude: string | number | null;
  timestamp: Date | string | null;
  sessionId?: string | null;
}

export interface TrackSummary {
  /** Null when there is nothing to measure - NOT zero, which is a claim. */
  totalMeters: number | null;
  totalMiles: number | null;
  /** Distinct sessions, or null when the rows carry none. */
  trips: number | null;
  /** Always null: see the header. Kept so the caller writes null rather than 0. */
  stops: null;
  /** Fixes used after ordering and filtering. */
  pointsUsed: number;
  /** Segments discarded as GPS drift. */
  segmentsDiscarded: number;
  unbacked: string[];
}

const METRES_PER_MILE = 1609.344;
const EARTH_RADIUS_M = 6_371_008.8;

/**
 * A service van does not travel at 150 mph. A segment implying it is two fixes
 * either side of a signal gap, or drift, and counting it adds miles nobody
 * drove - which on a mileage REIMBURSEMENT is somebody's money.
 */
const MAX_PLAUSIBLE_MPS = 67; // ~150 mph

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function time(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Sum the track.
 *
 * Points are sorted here rather than trusted: `getGpsLocationHistory` returns
 * them newest-first, and summing a reversed track gives the same distance only
 * by luck of symmetry - the drift filter needs real elapsed time between
 * consecutive fixes, and that is negative on a descending list.
 */
export function summariseTrack(points: TrackPoint[]): TrackSummary {
  const unbacked = [
    'stops is not derivable: location_history has no ticket or visit reference, and a dwell-based stop needs a radius and a duration nobody has specified.',
  ];

  const usable = points
    .map((p) => ({
      lat: num(p.latitude),
      lon: num(p.longitude),
      at: time(p.timestamp),
      session: p.sessionId ?? null,
    }))
    .filter(
      (p): p is { lat: number; lon: number; at: number; session: string | null } =>
        p.lat !== null && p.lon !== null && p.at !== null,
    )
    .sort((a, b) => a.at - b.at);

  const sessions = new Set(usable.map((p) => p.session).filter((s): s is string => !!s));
  const trips = sessions.size > 0 ? sessions.size : null;
  if (trips === null) {
    unbacked.push(
      'trips is null: no fix on this day carries a session_id, and counting one trip for a technician who may not have moved would be inventing a journey.',
    );
  }

  if (usable.length === 0) {
    return {
      totalMeters: null,
      totalMiles: null,
      trips,
      stops: null,
      pointsUsed: 0,
      segmentsDiscarded: 0,
      unbacked: [
        'No usable fix for this day, so the distance is unknown rather than zero.',
        ...unbacked,
      ],
    };
  }

  let meters = 0;
  let discarded = 0;
  for (let i = 1; i < usable.length; i++) {
    const a = usable[i - 1];
    const b = usable[i];
    const d = haversineMeters(a.lat, a.lon, b.lat, b.lon);
    const seconds = (b.at - a.at) / 1000;
    // A zero-elapsed segment is two fixes with the same stamp; there is no
    // speed to test, so it is kept only if it did not also move.
    if (seconds <= 0) {
      if (d > 0) discarded++;
      continue;
    }
    if (d / seconds > MAX_PLAUSIBLE_MPS) {
      discarded++;
      continue;
    }
    meters += d;
  }

  return {
    totalMeters: meters,
    totalMiles: Math.round((meters / METRES_PER_MILE) * 100) / 100,
    trips,
    stops: null,
    pointsUsed: usable.length,
    segmentsDiscarded: discarded,
    unbacked,
  };
}
