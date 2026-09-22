/**
 * docs/edge-rbac-triage.json holds its shape, once (SEC-EDGE-001 round 91).
 *
 * Ten test files had each grown their own copy of "the counts block matches the
 * entries" plus a floor asserting `unexamined > 0`. That floor was right for
 * nineteen rounds: it stopped anyone clearing the worklist by GUESSING verdicts
 * from function names, which is a mistake this story made four times and had to
 * overturn. Round 91 read the last entry and settled it, so every copy of the
 * floor failed at once on the success state - the phantom-cols-reachable-zero
 * shape, and the repair is the instruction the floor was standing in for rather
 * than a relaxation.
 *
 * THE PROPERTY WAS NEVER "SOMETHING IS UNEXAMINED". It is that no verdict is
 * unreasoned: an entry that left the unexamined state must say what was read to
 * get it there. That holds whether the list is empty or not, so it lives here
 * and the ten files keep a one-line assertion pointing at it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Entry = { fn: string; verdict: string; reason?: string; pathsRead?: string };
const triage = JSON.parse(
  readFileSync(join(__dirname, '../../../docs/edge-rbac-triage.json'), 'utf8'),
) as { note: string; counts: Record<string, number>; triage: Entry[] };

const VERDICTS = [
  'public',
  'internal',
  'headless',
  'open-by-design',
  'row-scoped',
  'gated-branch',
  'needs-gate',
  'unexamined',
];

describe('the summary is derived from the list, not maintained beside it', () => {
  it('has enough entries to be the inventory it claims to be', () => {
    // A walk that stops matching must fail rather than pass over nothing.
    expect(triage.triage.length).toBeGreaterThan(100);
  });

  it('counts match the entries', () => {
    const counts: Record<string, number> = {};
    for (const e of triage.triage) counts[e.verdict] = (counts[e.verdict] ?? 0) + 1;
    expect(triage.counts).toEqual(counts);
  });

  it('uses only the verdicts the note defines', () => {
    for (const e of triage.triage) expect(VERDICTS).toContain(e.verdict);
    for (const k of Object.keys(triage.counts)) expect(VERDICTS).toContain(k);
  });

  it('names every function exactly once', () => {
    const seen = triage.triage.map((e) => e.fn);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('no verdict is unreasoned', () => {
  it('every entry carries a reason', () => {
    const silent = triage.triage.filter((e) => (e.reason ?? '').trim().length < 40);
    expect(silent.map((e) => e.fn)).toEqual([]);
  });

  it('the worklist is empty, and emptying it is what the reasons have to justify', () => {
    expect(triage.counts.unexamined ?? 0).toBe(0);
    expect(triage.triage.filter((e) => e.verdict === 'unexamined')).toEqual([]);
  });

  /**
   * The distinction this story kept paying for: a verdict from reading SOME
   * paths is indistinguishable in the file from one that read all of them, so
   * an entry records which it read. The discipline started partway through -
   * these fifteen were examined before it did, and naming them beats a count,
   * because a count says how much is missing and a list says what.
   *
   * SHRINK-ONLY, and asserted in both directions: a new examined entry with no
   * paths record fails, and a name that gains one must leave this list, so it
   * cannot rot into a pre-forgiveness for whatever is added to it later.
   */
  const EXAMINED_WITHOUT_PATHS_RECORD = [
    'ai-employee',
    'churn-risk',
    'contract-tiered-rates',
    'crm',
    'customer-portal',
    'manufacturer-orders',
    'onboarding',
    'outreach',
    'pipeline-config',
    'quote-line-items',
    'sales-forecasts',
    'sales-rep-assignments',
    'signatures',
    'users',
    'webhooks',
  ];

  it('an entry that was examined says so and says what it read', () => {
    const examined = triage.triage.filter((e) => /EXAMINED|Paths read:/.test(e.reason ?? ''));
    // A filter that stops matching must fail rather than pass over nothing.
    expect(examined.length).toBeGreaterThan(30);
    const silent = examined
      .filter((e) => !/Paths read:/.test(e.reason ?? '') && !(e.pathsRead ?? '').trim())
      .map((e) => e.fn)
      .sort();
    expect(silent).toEqual(EXAMINED_WITHOUT_PATHS_RECORD);
  });

  it('a needs-gate entry says why a level check is not the answer', () => {
    // Emptying this list by reclassification must still fail.
    const worklist = triage.triage.filter((e) => e.verdict === 'needs-gate');
    expect(worklist.length).toBeGreaterThan(0);
    for (const e of worklist) {
      expect(e.reason, e.fn).toMatch(/NOT GATED|not gated|constrains nobody|precedent/);
    }
  });
});
