/**
 * `check:stale-gates` — a gate naming a blocker that has already landed.
 *
 * Stories record what they wait on in prose, nothing revisits the line, and the
 * next reader is turned away from work that became startable weeks ago. This
 * session alone found eight such staleness incidents; six open priority-1
 * stories were still carrying "[GATED: blocked on COP-M00]" after COP-M00
 * passed.
 *
 * The two narrowings are the whole guard, and both were forced by the first
 * run's 62 findings. A PASSING story saying "depends on QUOTE-001" is recorded
 * history, and reporting it buries the live ones. And "depends on" describes an
 * ordering while "blocked on" describes a story nobody can start - only the
 * second kind costs anything.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
// @ts-expect-error - .mjs guard, no type declarations
import { staleGates } from '../../../scripts/check-stale-gates.mjs';

const ROOT = join(__dirname, '../../..');

type Story = { id: string; passes?: boolean; priority?: number; notes?: string };
const find = (stories: Story[]) => staleGates(stories) as Array<{ id: string; blocker: string }>;

describe('a gate on a blocker that has landed is reported', () => {
  it('reports the open story whose blocker passes', () => {
    // Ids are realistic on purpose: the pattern requires 2+ leading letters, so
    // a fixture id like 'A-1' tests nothing this file will ever see.
    const findings = find([
      { id: 'MIG-1', passes: true },
      { id: 'FEA-2', passes: false, notes: 'blocked on MIG-1 until the migration lands' },
    ]);
    expect(findings).toEqual([{ id: 'FEA-2', blocker: 'MIG-1', priority: undefined }]);
  });

  it('says nothing when the blocker is genuinely still open', () => {
    expect(
      find([
        { id: 'MIG-1', passes: false },
        { id: 'FEA-2', passes: false, notes: 'blocked on MIG-1' },
      ]),
    ).toEqual([]);
  });

  it('says nothing about a PASSING story that records what it depended on', () => {
    // History, and the dependency was satisfied. Reporting it is how a real
    // finding gets buried.
    expect(
      find([
        { id: 'MIG-1', passes: true },
        { id: 'FEA-2', passes: true, notes: 'blocked on MIG-1' },
      ]),
    ).toEqual([]);
  });

  it('ignores blockers that are not stories', () => {
    // "needs the deployed database", "needs a telephony provider account" and
    // "needs a human decision" are real gates this cannot settle, and it must
    // not pretend to.
    expect(
      find([
        { id: 'MIG-1', passes: true },
        {
          id: 'FEA-2',
          passes: false,
          notes: 'blocked on the deployed database; also blocked on ACME-99 which is not a story',
        },
      ]),
    ).toEqual([]);
  });

  it('ignores an ordering statement, which is not a gate', () => {
    expect(
      find([
        { id: 'MIG-1', passes: true },
        { id: 'FEA-2', passes: false, notes: 'depends on MIG-1; prerequisite: MIG-1' },
      ]),
    ).toEqual([]);
  });

  it('ignores a story citing itself', () => {
    expect(find([{ id: 'MIG-1', passes: false, notes: 'blocked on MIG-1' }])).toEqual([]);
  });

  it('matches the other gate verbs', () => {
    for (const verb of ['blocked on', 'gated on', 'waiting on']) {
      expect(
        find([
          { id: 'MIG-1', passes: true },
          { id: 'FEA-2', passes: false, notes: `still ${verb} MIG-1` },
        ]),
      ).toHaveLength(1);
    }
  });
});

describe('the guard is wired and the tree is clean', () => {
  it('runs in CI and from package.json', () => {
    const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
    expect(pkg).toContain('"check:stale-gates"');
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toContain('npm run check:stale-gates');
  });

  it('finds nothing in prd.json today', () => {
    const prd = JSON.parse(readFileSync(join(ROOT, 'prd.json'), 'utf8'));
    // A walk that parses nothing must fail rather than pass in silence.
    expect(prd.userStories.length).toBeGreaterThan(100);
    expect(find(prd.userStories)).toEqual([]);
  });
});
