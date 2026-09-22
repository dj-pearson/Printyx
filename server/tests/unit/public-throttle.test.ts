// COP-B14 AC4: abuse controls on an endpoint with no JWT in front of it.
//
// A public booking page writes rows, sends email and puts events on a rep's
// calendar. Left open it is a way to fill a sales team's week from a script.
// These tests hold the line between the control that actually stops that (the
// server-side rate limit) and the two that only stop commodity bots.
import { describe, it, expect } from 'vitest';

import {
  DEFAULT_BOOKING_LIMITS,
  botSignals,
  pageBucket,
  sourceBucket,
  throttleDecision,
  windowStart,
} from '@shared/public-throttle';

const NOW = new Date('2026-09-20T12:00:00.000Z');
/**
 * A stand-in for SHA-256 that genuinely does not contain its input - an
 * echoing stub would make "never stores the address" pass while proving
 * nothing about the code.
 */
const digest = async (input: string) => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('throttleDecision', () => {
  it('allows a prospect who books once, and one who corrects a mistake', () => {
    expect(throttleDecision(0, 0).allowed).toBe(true);
    expect(throttleDecision(2, 3).allowed).toBe(true);
  });

  it('stops one source at the limit and says which limit it was', () => {
    const d = throttleDecision(DEFAULT_BOOKING_LIMITS.perSource, 0);
    expect(d).toMatchObject({ allowed: false, reason: 'source' });
    expect(d.retryAfterSeconds).toBe(DEFAULT_BOOKING_LIMITS.windowSeconds);
  });

  it('ALSO stops a page flooded from many sources', () => {
    // The per-source limit is defeated by a handful of addresses, and a page
    // that can be flooded from a botnet is a calendar nobody can use.
    expect(throttleDecision(0, DEFAULT_BOOKING_LIMITS.perPage)).toMatchObject({
      allowed: false,
      reason: 'page',
    });
  });

  it('reports the SOURCE limit first when both are hit', () => {
    // It is the more specific fact and the more actionable one.
    expect(throttleDecision(99, 99).reason).toBe('source');
  });

  it('honours custom limits', () => {
    const limits = { perSource: 1, perPage: 10, windowSeconds: 60 };
    expect(throttleDecision(0, 0, limits).allowed).toBe(true);
    expect(throttleDecision(1, 0, limits).allowed).toBe(false);
  });

  it('is generous enough for a human and hopeless for a script', () => {
    expect(DEFAULT_BOOKING_LIMITS.perSource).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_BOOKING_LIMITS.perSource).toBeLessThanOrEqual(10);
  });
});

describe('botSignals — commodity bots only, and the tests say so', () => {
  it('flags a filled honeypot', () => {
    expect(botSignals({ honeypot: 'http://spam', now: NOW })).toEqual({
      suspicious: true,
      reason: 'honeypot',
    });
  });

  it('ignores an empty or whitespace honeypot', () => {
    expect(botSignals({ honeypot: '', now: NOW }).suspicious).toBe(false);
    expect(botSignals({ honeypot: '   ', now: NOW }).suspicious).toBe(false);
  });

  it('flags a form submitted faster than a person can type', () => {
    const opened = new Date(NOW.getTime() - 400).toISOString();
    expect(botSignals({ formOpenedAt: opened, now: NOW })).toEqual({
      suspicious: true,
      reason: 'too_fast',
    });
  });

  it('accepts a form a person spent time on', () => {
    const opened = new Date(NOW.getTime() - 30_000).toISOString();
    expect(botSignals({ formOpenedAt: opened, now: NOW }).suspicious).toBe(false);
  });

  it('treats a MISSING open time as fine, not as suspicious', () => {
    // An older client, a page restored from bfcache or a flaky connection can
    // all omit it. Refusing a real booking is worse than accepting a fake one.
    expect(botSignals({ now: NOW }).suspicious).toBe(false);
    expect(botSignals({ formOpenedAt: null, now: NOW }).suspicious).toBe(false);
    expect(botSignals({ formOpenedAt: 'yesterday', now: NOW }).suspicious).toBe(false);
  });

  it('treats a FUTURE open time as absent — a client clock proves nothing', () => {
    const ahead = new Date(NOW.getTime() + 60_000).toISOString();
    expect(botSignals({ formOpenedAt: ahead, now: NOW }).suspicious).toBe(false);
  });

  it('honours a custom minimum fill time', () => {
    const opened = new Date(NOW.getTime() - 4_000).toISOString();
    expect(botSignals({ formOpenedAt: opened, now: NOW }).suspicious).toBe(false);
    expect(botSignals({ formOpenedAt: opened, now: NOW, minFillMs: 10_000 }).suspicious).toBe(true);
  });
});

describe('bucket keys — throttling needs "the same source again", not who', () => {
  it('hashes the address, never stores it', async () => {
    const bucket = await sourceBucket('demo', '203.0.113.7', digest);
    expect(bucket).not.toContain('203.0.113.7');
    expect(bucket).toContain('demo');
  });

  it('takes the CLIENT from an x-forwarded-for list', async () => {
    const direct = await sourceBucket('demo', '203.0.113.7', digest);
    const proxied = await sourceBucket('demo', '203.0.113.7, 70.41.3.18, 150.172.238.178', digest);
    expect(proxied).toBe(direct);
  });

  it('separates two slugs for the same address', async () => {
    expect(await sourceBucket('a', '203.0.113.7', digest)).not.toBe(
      await sourceBucket('b', '203.0.113.7', digest),
    );
  });

  it('throttles an UNKNOWN source together with every other unknown one', async () => {
    // The safe way round: no address must not mean exempt.
    const bucket = await sourceBucket('demo', null, digest);
    expect(bucket).toBe('booking:demo:unknown');
    expect(await sourceBucket('demo', '  ', digest)).toBe(bucket);
  });

  it('gives a page its own bucket, distinct from any source bucket', () => {
    expect(pageBucket('demo')).toBe('booking-page:demo');
  });
});

describe('windowStart', () => {
  it('measures the last N seconds, not all of history', () => {
    expect(windowStart(NOW, 600).toISOString()).toBe('2026-09-20T11:50:00.000Z');
  });
});
