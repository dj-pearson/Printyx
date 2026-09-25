/**
 * Round 254: performanceMiddleware declared its perf utilities through a type
 * that referred to itself (tsc TS7022). They are built as one object now and
 * attached to the request; this checks the request still carries working
 * mark/measure/getTimings, and that a measure against an unknown mark is
 * skipped rather than recorded as a timing.
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import { performanceMiddleware } from '../../middleware/logging-middleware';

describe('performanceMiddleware', () => {
  it('attaches working perf utilities to the request', () => {
    const req = { method: 'GET', path: '/x', headers: {} } as unknown as {
      perf: {
        mark(name: string): void;
        measure(name: string, startMark: string): void;
        getTimings(): Record<string, number>;
      };
    };
    const res = Object.assign(new EventEmitter(), { statusCode: 200 });
    let nexted = false;
    performanceMiddleware()(req as never, res as never, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
    req.perf.mark('start');
    req.perf.measure('db', 'start');
    req.perf.measure('never', 'no-such-mark');
    const t = req.perf.getTimings();
    expect(typeof t.db).toBe('number');
    expect(t).not.toHaveProperty('never');
  });
});
