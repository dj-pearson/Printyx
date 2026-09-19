/**
 * Every reported N+1 candidate is classified (PERF-NPLUS1-002 AC1).
 *
 * The report is a reading list, and a reading list nobody has read is a number.
 * docs/nplus1-triage.json is the reading: one entry per loop the report still
 * calls a TENANT candidate, with a verdict and the reason. This test is what
 * stops it going stale in either direction - a new loop cannot arrive without
 * an entry, and an entry cannot outlive the loop it describes.
 *
 * A loop leaves the triage by being CONVERTED, not by being dropped from the
 * file: if it disappears from the report the entry must go too, and the diff
 * shows which one and why.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const triage = JSON.parse(readFileSync(join(repo, 'docs/nplus1-triage.json'), 'utf8')) as {
  note: string;
  loops: Array<{ loop: string; table: string; verdict: string; why: string }>;
};

const reported = (() => {
  const text = execFileSync('node', ['scripts/report-nplus1-loops.mjs'], {
    cwd: repo,
    encoding: 'utf8',
  });
  return [...text.matchAll(/^supabase\/functions\/([^:]+):(\d+)\s+-> (\S+)/gm)].map((m) => ({
    loop: `${m[1]}:${m[2]}`,
    table: m[3],
  }));
})();

const VERDICTS = new Set(['deliberate', 'bounded', 'scales-dominated', 'scales-open']);

describe('the triage covers exactly what the report reports', () => {
  it('no candidate is unclassified', () => {
    const classified = new Set(triage.loops.map((l) => l.loop));
    const unclassified = reported.filter((r) => !classified.has(r.loop)).map((r) => r.loop);
    expect(unclassified).toEqual([]);
  });

  it('no entry outlives its loop', () => {
    // An entry for a loop that has been converted is a claim about code that
    // no longer exists, which is how an inventory stops being true.
    const live = new Set(reported.map((r) => r.loop));
    const stale = triage.loops.filter((l) => !live.has(l.loop)).map((l) => l.loop);
    expect(stale).toEqual([]);
  });

  it('every file named still exists', () => {
    for (const entry of triage.loops) {
      const file = entry.loop.slice(0, entry.loop.lastIndexOf(':'));
      expect(existsSync(join(repo, 'supabase/functions', file)), file).toBe(true);
    }
  });
});

describe('each entry says something', () => {
  it('uses one of the four verdicts', () => {
    for (const entry of triage.loops) {
      expect(VERDICTS, entry.loop).toContain(entry.verdict);
    }
  });

  it('gives a reason, not a label', () => {
    // "N/A" and "fine" are how a triage becomes a list again.
    for (const entry of triage.loops) {
      expect(entry.why.length, entry.loop).toBeGreaterThan(60);
    }
  });

  it('names what the conversion needs wherever one is still owed', () => {
    // scales-open means it is worth converting and has not been. Each of those
    // says what is in the way, so the next person does not re-derive it.
    for (const entry of triage.loops.filter((l) => l.verdict === 'scales-open')) {
      expect(entry.why.length, entry.loop).toBeGreaterThan(120);
    }
  });
});

describe('the report knows an unreachable function when it sees one', () => {
  it('reads the unreferenced baseline as a rule, not a second baseline', () => {
    // A loop in a function nothing can call does not scale with tenant data
    // because it does not run. The day something calls it, the loop reappears
    // here - which is exactly when it starts to matter.
    const script = readFileSync(join(repo, 'scripts/report-nplus1-loops.mjs'), 'utf8');
    expect(script).toContain('unreferenced-edge-fns-baseline.json');
    expect(script).toContain("'unreachable'");
  });

  it('classifies by shape first, so a paging loop is still a paging loop', () => {
    const text = execFileSync('node', ['scripts/report-nplus1-loops.mjs'], {
      cwd: repo,
      encoding: 'utf8',
    });
    // Collapsing the two would hide how many deliberate shapes the rule
    // recognises, which is the only evidence that the rule works at all.
    expect(text).toMatch(/\d+ paging/);
    expect(text).toMatch(/\d+ unreachable/);
  });
});
