/**
 * Round 152: /api/social-media.
 *
 * SEC-EDGE-001 put the manager gate on POST /posts/:id/publish, which only
 * moves a status column, and left /broadcast - the branch that actually sends
 * the post to an external webhook in the tenant's name - open to every member,
 * along with the scheduled jobs that publish with nobody reviewing each post.
 * The list and item responses were raw snake_case rows while the page reads
 * camelCase, so production rendered blank cells. The ungated Express twin is
 * deleted and the prefix proxied.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const fn = stripComments(readFileSync('supabase/functions/social-media/index.ts', 'utf8'));

const BRANCHES = [
  "endpoint === 'posts' && postId && parts[2] === 'publish'",
  "endpoint === 'posts' && postId && parts[2] === 'broadcast'",
  "req.method === 'POST' && endpoint === 'cron-jobs' && !postId",
  "req.method === 'PUT' && endpoint === 'cron-jobs' && postId",
  "req.method === 'DELETE' && endpoint === 'cron-jobs' && postId",
  "endpoint === 'cron-jobs' && postId && parts[2] === 'execute'",
];

/** The branch body up to the next top-level `if (req.method` - never a window. */
function branchBody(head: string): string {
  const at = fn.indexOf(head);
  expect(at, head).toBeGreaterThan(-1);
  const next = fn.indexOf('if (req.method', at + head.length);
  return fn.slice(at, next === -1 ? undefined : next);
}

describe('every branch that publishes or schedules publishing is manager-gated', () => {
  for (const head of BRANCHES) {
    it(head, () => {
      const body = branchBody(head);
      const gate = body.indexOf('requireManager();');
      expect(gate).toBeGreaterThan(-1);
      // The gate runs before the branch reads a body or touches a table.
      const firstWork = Math.min(
        ...['req.json(', 'admin\n', 'admin.from(', '.from('].map((k) =>
          body.indexOf(k) === -1 ? Infinity : body.indexOf(k),
        ),
      );
      expect(gate).toBeLessThan(firstWork);
    });
  }

  it('generation and reading stay open, because the page is alwaysVisible', () => {
    expect(branchBody("req.method === 'GET' && endpoint === 'posts' && !postId")).not.toMatch(
      /requireManager\(\)/,
    );
  });
});

describe('responses are camelCase, which is what the page reads', () => {
  it('list, item and create responses go through toCamelShallow', () => {
    expect(fn).toMatch(/\(posts \|\| \[\]\)\.map\(toCamelShallow\)/);
    expect(fn).toMatch(/\(jobs \|\| \[\]\)\.map\(toCamelShallow\)/);
    expect(fn).not.toMatch(/return createCorsResponse\((post|newPost|job), 20[01], req\)/);
  });
});

describe('one host', () => {
  it('proxies the prefix and has no Express router left', () => {
    const proxy = stripComments(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
    expect(proxy).toMatch(/'\/api\/social-media': 'social-media'/);
    expect(existsSync('server/routes-social-media.ts')).toBe(false);
  });
});
