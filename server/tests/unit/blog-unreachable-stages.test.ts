/**
 * The blog subsystem's unreachable stages are recorded, not silently closed
 * (AUDIT-025).
 *
 * Eighteen of the thirty-six blog edge functions cannot be invoked from
 * anywhere - no client tree names the path, no crmProxies alias targets them,
 * server.ts maps no segment onto them, and no cron posts to them - while every
 * US-BLOG story that built them was marked passing. Roughly 21,000 lines behind
 * doors with no handle.
 *
 * This test holds the bookkeeping in place: the record exists, the forty stories
 * whose deliverable is unreachable are open, and each says why.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const prd = JSON.parse(read('prd.json'));

function collect(node: unknown, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((n) => collect(n, out));
    return out;
  }
  const rec = node as Record<string, unknown>;
  if (typeof rec.id === 'string') out.push(rec);
  Object.values(rec).forEach((v) => collect(v, out));
  return out;
}
const stories = collect(prd);
const reopened = stories.filter((s) => s.reopened_by === 'AUDIT-025');

describe('the record exists and says which way in is missing', () => {
  const doc = read('docs/blog-unreachable-stages.md');

  it('lists every unreferenced blog function', () => {
    const baseline = JSON.parse(read('docs/unreferenced-edge-fns-baseline.json'));
    const blogFns = (baseline.unreferenced as string[]).filter((f) => f.startsWith('blog-'));
    expect(blogFns.length).toBeGreaterThan(0);
    for (const fn of blogFns) expect(doc, fn).toContain(`\`${fn}\``);
  });

  it('corrects the blog_jobs hypothesis rather than repeating it', () => {
    // AC2 guessed these were meant to be job handlers. A handler takes
    // (admin, job, req) and does no routing; these are multi-method REST
    // surfaces, and JOB_TYPES names only noop and retention_cleanup.
    expect(doc).toMatch(/AC2 was wrong/);
    const jobs = read('supabase/functions/blog-jobs/index.ts');
    expect(jobs).toMatch(/const JOB_TYPES = \['noop', 'retention_cleanup'\] as const;/);
  });

  it('separates the half of blog-platform-api that is headless by design', () => {
    // Its /public branch sits before the auth gate and answers GET only, so it
    // is supposed to have no caller in a client tree.
    expect(doc).toMatch(/headless by design/);
    const api = read('supabase/functions/blog-platform-api/index.ts');
    const publicAt = api.indexOf("parts[0] === 'public'");
    const authAt = api.indexOf('auth.getUser(jwt)');
    expect(publicAt).toBeGreaterThan(-1);
    expect(publicAt).toBeLessThan(authAt);
  });
});

describe('the stories are reopened with a reason', () => {
  it('reopens every story whose deliverable is unreachable', () => {
    expect(reopened.length).toBe(40);
    for (const story of reopened) {
      expect(story.passes, story.id as string).toBe(false);
      expect(story.id as string).toMatch(/^US-BLOG-\d+$/);
    }
  });

  it('names the function and the missing way in, per story', () => {
    // A reopened story with no reason is how this accumulated in the first
    // place: closure needed only a shipped function and a passing deno check.
    for (const story of reopened) {
      const reason = String(story.reopen_reason ?? '');
      expect(reason, story.id as string).toMatch(/cannot be invoked/);
      expect(reason, story.id as string).toMatch(/blog-[a-z-]+/);
      expect(reason, story.id as string).toMatch(/an admin surface|a JOB_TYPES entry in blog-jobs/);
      expect(reason, story.id as string).toContain('docs/blog-unreachable-stages.md');
    }
  });

  it('tells the two unattended stages they also need scheduling', () => {
    // blog-pipeline and blog-serp-monitor call assertAgentsActive, the agent
    // entry-point convention. A screen alone would leave them never running.
    const scheduled = reopened.filter((s) =>
      String(s.reopen_reason).includes('JOB_TYPES entry in blog-jobs'),
    );
    expect(scheduled.length).toBeGreaterThan(0);
    for (const story of scheduled) {
      expect(String(story.reopen_reason)).toMatch(/blog-(pipeline|serp-monitor)/);
    }
  });
});
