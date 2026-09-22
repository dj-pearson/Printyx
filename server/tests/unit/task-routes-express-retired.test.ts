/**
 * The Express task router is gone (QUALITY-002).
 *
 * `server/routes/task-routes.ts` was 452 lines returning "Mock tasks data":
 * hardcoded tasks, categories, suggestions and time entries. It was registered
 * NOWHERE - the only import in the whole tree was `server/tests/api-endpoints.test.ts`,
 * so the test suite was the sole thing keeping it reachable, and every
 * assertion in it pinned the mock's shape to itself. That is worse than no
 * coverage: it makes dead code look tested.
 *
 * `/api/tasks` is proxied to `supabase/functions/tasks`, which is a strict
 * superset - categories, schedule and suggestions as here, plus bulk, stats,
 * comments, time-entries and the timer, none of which the Express copy had.
 * That superset check is the PROD-008c criterion for deleting a shadowed
 * router, and it is why this deletion is safe rather than merely tidy.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('it does not come back', () => {
  it('the file is gone', () => {
    expect(existsSync(join(repo, 'server/routes/task-routes.ts'))).toBe(false);
  });

  it('nothing imports it', () => {
    // A test importing a router is enough to make check:server-orphans call it
    // reachable, which is how this survived.
    const suite = read('server/tests/api-endpoints.test.ts');
    expect(suite).not.toContain("import('../routes/task-routes')");
  });

  it('/api/tasks is proxied to the edge function', () => {
    const proxy = read('server/middleware/edge-function-proxy.ts');
    expect(proxy).toMatch(/'\/api\/tasks':\s*'tasks'/);
  });

  it('and that function serves every path the router had', () => {
    // The superset check, kept as an assertion rather than a claim in prose.
    const fn = read('supabase/functions/tasks/index.ts');
    for (const branch of ['categories', 'suggestions', 'schedule']) {
      expect(fn, branch).toContain(`'${branch}'`);
    }
    expect(fn).toContain("parts[1] === 'time-entry'");
    expect(fn).toContain("parts[1] === 'comments'");
  });
});

describe('the fixture timing test is gone too', () => {
  const raw = read('server/tests/api-endpoints.test.ts');
  /**
   * Comments blanked. The note left where the block was quotes the assertion it
   * describes, so a raw-source absence check reports its own explanation as the
   * defect - the trap CLAUDE.md records for check:edge-coverage, and the fourth
   * time it has fired in this session alone.
   */
  const suite = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  it('nothing asserts a wall-clock budget', () => {
    // It timed a GET that returned a hardcoded array, so it measured that an
    // in-memory literal is fast - and being a wall-clock budget on a shared
    // container, it was the one assertion in the tree that could fail a full
    // run at random. It did, once in seven.
    expect(suite).not.toContain('toBeLessThan(1000)');
    expect(suite).not.toContain('responseTime');
  });

  it('and the reason is written down where the block was', () => {
    // Against the RAW source: this one is about the comment.
    expect(raw).toContain('IT WAS ALSO THE FLAKE');
  });

  it('a real timing budget lives in the benchmark instead', () => {
    // bench-crm-lists measures real queries against a seeded database and
    // states what it does not cover. That is where a budget belongs.
    expect(existsSync(join(repo, 'scripts/bench-crm-lists.mjs'))).toBe(true);
  });
});
