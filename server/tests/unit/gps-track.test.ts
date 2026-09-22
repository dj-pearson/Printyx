/**
 * A day's mileage from a GPS track (AUDIT-037 follow-up).
 *
 * `calculateMileageFromGPS` summed `record.distanceFromPrevious` and counted
 * distinct `record.ticketId`. `location_history` has neither column and never
 * has - both came from a second, wrong declaration in gps-tracking-schema.ts -
 * so `db.select()` over that shape named eight columns the table does not have
 * and threw 42703 on every call. The catch answered zero miles, so the nightly
 * job recorded that every technician drove nowhere. Proven against a real
 * PostgreSQL: `column "altitude" does not exist`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { haversineMeters, summariseTrack, type TrackPoint } from '../../../shared/gps-track';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const at = (minutes: number, lat: number, lon: number, session?: string): TrackPoint => ({
  latitude: String(lat),
  longitude: String(lon),
  timestamp: new Date(Date.UTC(2026, 0, 2, 8, minutes)),
  sessionId: session ?? null,
});

describe('the distance is real arithmetic over real columns', () => {
  it('measures a known distance', () => {
    // One degree of latitude is ~111.2 km anywhere on the globe.
    const d = haversineMeters(30, -97, 31, -97);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('is symmetric and zero for a point against itself', () => {
    expect(haversineMeters(30.2872, -97.7531, 30.2872, -97.7531)).toBe(0);
    expect(haversineMeters(30, -97, 31, -96)).toBeCloseTo(haversineMeters(31, -96, 30, -97), 6);
  });

  it('sums consecutive fixes', () => {
    const track = [at(0, 30.0, -97.0), at(10, 30.01, -97.0), at(20, 30.02, -97.0)];
    const s = summariseTrack(track);
    // Two hops of ~0.01 degrees of latitude, about 1.11 km each.
    expect(s.totalMeters).toBeGreaterThan(2_100);
    expect(s.totalMeters).toBeLessThan(2_300);
    expect(s.totalMiles).toBeCloseTo((s.totalMeters as number) / 1609.344, 1);
  });

  it('sorts before summing, because the query returns newest first', () => {
    // Not cosmetic: the drift filter divides by elapsed time, which is negative
    // on a descending list, so every segment would pass or fail by accident.
    const ascending = [at(0, 30.0, -97.0), at(30, 30.05, -97.0)];
    const descending = [...ascending].reverse();
    expect(summariseTrack(descending).totalMeters).toBeCloseTo(
      summariseTrack(ascending).totalMeters as number,
      6,
    );
  });
});

describe('it refuses to turn absence into zero', () => {
  it('an empty track is null miles, not zero', () => {
    // Zero is a claim: the technician was out and did not move. Null is what is
    // actually known when no fix was recorded.
    const s = summariseTrack([]);
    expect(s.totalMeters).toBeNull();
    expect(s.totalMiles).toBeNull();
    expect(s.unbacked.join(' ')).toContain('unknown rather than zero');
  });

  it('a single fix is a real zero - the technician was somewhere and stayed', () => {
    const s = summariseTrack([at(0, 30, -97)]);
    expect(s.totalMeters).toBe(0);
    expect(s.pointsUsed).toBe(1);
  });

  it('drops a fix with no coordinate rather than reading it as (0,0)', () => {
    // Null island is 600km off the coast of Ghana; a track through it would add
    // thousands of miles to somebody's reimbursement.
    const s = summariseTrack([
      at(0, 30, -97),
      { ...at(10, 0, 0), latitude: null },
      at(20, 30, -97),
    ]);
    expect(s.pointsUsed).toBe(2);
    expect(s.totalMeters).toBe(0);
  });
});

describe('it discards what cannot have happened', () => {
  it('drops a segment implying an impossible speed', () => {
    // Two fixes a minute apart and 100km distant is a signal gap or drift, not
    // a drive. Counting it bills miles nobody travelled.
    const s = summariseTrack([at(0, 30.0, -97.0), at(1, 31.0, -97.0)]);
    expect(s.totalMeters).toBe(0);
    expect(s.segmentsDiscarded).toBe(1);
  });

  it('keeps the same jump when the time allows it', () => {
    const s = summariseTrack([at(0, 30.0, -97.0), at(120, 31.0, -97.0)]);
    expect(s.totalMeters).toBeGreaterThan(110_000);
    expect(s.segmentsDiscarded).toBe(0);
  });

  it('a zero-elapsed pair that also moved is drift, not travel', () => {
    const track = [at(0, 30.0, -97.0), at(0, 30.5, -97.0)];
    const s = summariseTrack(track);
    expect(s.totalMeters).toBe(0);
    expect(s.segmentsDiscarded).toBe(1);
  });
});

describe('what it cannot derive it names', () => {
  it('stops is always null, with the reason', () => {
    // The old code counted distinct ticket ids, a column that does not exist,
    // so it was always 0 - and 0 stops reads as "visited nobody".
    const s = summariseTrack([at(0, 30, -97, 's1')]);
    expect(s.stops).toBeNull();
    expect(s.unbacked.join(' ')).toContain('radius and a duration');
  });

  it('counts trips as distinct sessions when the rows carry them', () => {
    const s = summariseTrack([
      at(0, 30, -97, 's1'),
      at(10, 30.01, -97, 's1'),
      at(20, 30.02, -97, 's2'),
    ]);
    expect(s.trips).toBe(2);
  });

  it('answers null trips rather than inventing one', () => {
    // The old code did `trips > 0 ? trips : 1`, which asserts a journey for a
    // technician who may never have left the yard.
    const s = summariseTrack([at(0, 30, -97), at(10, 30.01, -97)]);
    expect(s.trips).toBeNull();
    expect(s.unbacked.join(' ')).toContain('inventing a journey');
  });
});

describe('the callers no longer read columns the table lacks', () => {
  const service = read('server/services/mileage-service.ts');
  const storage = read('server/storage.ts');
  const code = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  it('the mileage service sums the track instead of a missing column', () => {
    expect(code(service)).toContain('summariseTrack(history)');
    expect(code(service)).not.toContain('distanceFromPrevious');
  });

  it('a day with no usable fix writes no record rather than a record of zero', () => {
    expect(code(service)).toContain('(gpsData.totalMiles ?? 0) > 0');
  });

  it('storage does not filter on activity_type or ticket_id', () => {
    expect(code(storage)).not.toContain('gpsLocationHistory.activityType');
    expect(code(storage)).not.toContain('gpsLocationHistory.ticketId');
  });

  it('the per-ticket timeline says it cannot be built, rather than returning []', () => {
    // [] would say the technician never attended, which is a different and
    // worse answer than "not recorded".
    expect(storage).toContain('carries no ticket reference');
  });
});
