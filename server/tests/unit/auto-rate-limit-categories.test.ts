/**
 * Round 242: autoRateLimit classified every POST/PUT/PATCH/DELETE as 'write',
 * a category RATE_LIMIT_CONFIGS does not have. The config came out empty, so
 * windowMs was undefined, the window arithmetic produced NaN and a write was
 * never limited. Nothing mounts autoRateLimit today; the first thing that did
 * would have left writes - the requests a limiter exists for - unthrottled.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { autoRateLimit, RATE_LIMIT_CONFIGS } from '../../middleware/user-rate-limit';

function run(method: string, path: string) {
  const headers: Record<string, string> = {};
  const req = { method, path, headers: {}, ip: '10.0.0.1', socket: {} } as never;
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = String(v);
    },
    status: () => ({ json: () => undefined }),
  } as never;
  let passed = false;
  autoRateLimit()(req, res, () => {
    passed = true;
  });
  return { headers, passed };
}

describe('autoRateLimit', () => {
  it('limits a write under the mutation tier', () => {
    const { headers, passed } = run('POST', '/tickets');
    expect(passed).toBe(true);
    expect(headers['x-ratelimit-limit']).toBe(String(RATE_LIMIT_CONFIGS.mutation.limit));
  });

  it('only ever assigns a category that has a config', () => {
    const src = readFileSync('server/middleware/user-rate-limit.ts', 'utf8');
    const body = src.slice(
      src.indexOf('export function autoRateLimit'),
      src.indexOf('export function getRateLimitStats'),
    );
    const assigned = [...body.matchAll(/category = '([a-z]+)'/g)].map((m) => m[1]);
    expect(assigned.length).toBeGreaterThan(5);
    for (const c of assigned) expect(Object.keys(RATE_LIMIT_CONFIGS)).toContain(c);
  });
});
