/**
 * A passing story may not name a deliverable that is an orphan file (WF-G-03).
 *
 * `passes: true` is the only record of what this project believes it has built,
 * and three guards already know which files nothing reaches. Nothing crossed
 * the two, so a story could close on a file that exists, compiles, is tested,
 * and is called by nobody. AUDIT-025 is the proof rather than the hypothesis:
 * all 86 US-BLOG stories are marked passing and 19 of the 37 blog edge
 * functions they shipped are reachable by nothing.
 *
 * The risk in a guard like this is the opposite of the usual one. A story that
 * WRITES DOWN its own orphan - "kept and baselined so the gap stays on the
 * roadmap" - is doing exactly what the guard exists to force, and reporting it
 * back would teach people to stop writing it down. So the exclusions matter as
 * much as the findings, and both directions are mutation-tested here rather
 * than asserted.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const script = join(repo, 'scripts/check-passing-story-orphans.mjs');
const prdPath = join(repo, 'prd.json');

function runGuard(): { code: number; out: string } {
  try {
    return { code: 0, out: execFileSync('node', [script], { cwd: repo, encoding: 'utf8' }) };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

/** Append a story to prd.json, run the guard, then put prd.json back verbatim. */
function withStory<T>(story: Record<string, unknown>, fn: () => T): T {
  const original = readFileSync(prdPath, 'utf8');
  try {
    const prd = JSON.parse(original);
    prd.userStories.push(story);
    writeFileSync(prdPath, JSON.stringify(prd, null, 2));
    return fn();
  } finally {
    writeFileSync(prdPath, original);
  }
}

const base = {
  id: 'ZZZ-GUARD-TEST',
  title: 'test',
  acceptanceCriteria: ['done'],
  priority: 99,
  passes: true,
  notes: '',
};

describe('the guard catches an unacknowledged orphan deliverable', () => {
  it('fails on a passing story that says to create a file nothing imports', () => {
    const { code, out } = withStory(
      { ...base, description: 'Create server/middleware/scope-middleware.ts and wire it up.' },
      runGuard,
    );
    expect(code).toBe(1);
    expect(out).toContain('server/middleware/scope-middleware.ts');
  });

  it('catches an edge function no client tree, alias or cron names', () => {
    const { code, out } = withStory(
      { ...base, description: 'Implemented in supabase/functions/blog-outreach/index.ts.' },
      runGuard,
    );
    expect(code).toBe(1);
    expect(out).toContain('unreferenced-edge-fns');
  });
});

describe('the guard does not punish a story that wrote the orphan down', () => {
  it('passes when the acknowledgement is in the NEXT sentence', () => {
    // Found by mutation-testing, not by reading the code: the first version
    // checked only the sentence CONTAINING the path, so this exact shape was
    // reported as a defect.
    const { code } = withStory(
      {
        ...base,
        description:
          'Create server/middleware/scope-middleware.ts. Nothing imports it yet; wiring it is WF-R-04.',
      },
      runGuard,
    );
    expect(code).toBe(0);
  });

  it('passes when the story says the file was deleted', () => {
    const { code } = withStory(
      { ...base, description: 'server/middleware/scope-middleware.ts was deleted.' },
      runGuard,
    );
    expect(code).toBe(0);
  });

  it('passes when the path is cited as evidence rather than claimed as built', () => {
    // A path after "Evidence:" names where a defect lives. Reporting it as an
    // unreachable deliverable inverts what the sentence says.
    const { code } = withStory(
      { ...base, description: 'Evidence: server/middleware/scope-middleware.ts:12.' },
      runGuard,
    );
    expect(code).toBe(0);
  });

  it('ignores a story that is not passing', () => {
    const { code } = withStory(
      {
        ...base,
        passes: false,
        description: 'Create server/middleware/scope-middleware.ts and wire it up.',
      },
      runGuard,
    );
    expect(code).toBe(0);
  });
});

describe('the report is not hidden behind a count', () => {
  it('prints every finding on a clean run', () => {
    // A page of open questions reading as one green tick is the failure mode
    // this whole story is about. The expected count comes from the baseline
    // rather than a literal, so tightening it does not break the assertion.
    const { code, out } = runGuard();
    expect(code).toBe(0);
    const baseline = JSON.parse(
      readFileSync(join(repo, 'docs/passing-story-orphans-baseline.json'), 'utf8'),
    );
    expect(out).toContain(`${baseline.count} finding(s)`);
    for (const key of baseline.entries.slice(0, 5)) {
      expect(out).toContain(key.split('::')[0]);
    }
  });

  it('keeps the baseline keyed by story id and path', () => {
    const baseline = JSON.parse(
      readFileSync(join(repo, 'docs/passing-story-orphans-baseline.json'), 'utf8'),
    );
    expect(baseline.entries).toHaveLength(baseline.count);
    for (const key of baseline.entries) expect(key.split('::')).toHaveLength(2);
    expect(baseline.note).toMatch(/TODO list, not settled debt/);
  });
});

describe('the exclusions are stated in the header', () => {
  const header = readFileSync(script, 'utf8').slice(0, 4000);

  it('says why an acknowledged orphan is excluded by rule', () => {
    expect(header).toContain('THE STORY SAYS IT IS DEAD');
    expect(header).toMatch(/punish the honest case/);
  });

  it('says why it is a report rather than a gate at zero', () => {
    expect(header).toContain('WHY A REPORT WITH A SHRINK-ONLY BASELINE, NOT A GATE AT ZERO');
  });
});
