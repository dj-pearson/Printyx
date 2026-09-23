import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  triageProblems,
  divergentDomains,
  readTriage,
  VERDICTS,
  MIN_DOMAINS,
} from '../../../scripts/check-route-divergence-triage.mjs';

const repoRoot = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

/**
 * `check:routes` already finds the class - Express and an edge function both
 * serve a domain with no proxy between them, so dev and production run
 * different code for the same path - and recorded 44 of them as a flat list of
 * names. Two priority-1 stories sat inside it undetected: LAUNCH-013's
 * subscription gates on `leads` and `import`, and LEGAL-004's storage erasure
 * on `gdpr`.
 */
describe('every divergent domain carries a verdict (round 124)', () => {
  const domains = divergentDomains();
  const { entries, note } = readTriage();

  it('reads a real list, so a clean run is not an empty one', () => {
    expect(domains.length).toBeGreaterThan(MIN_DOMAINS);
    expect(MIN_DOMAINS).toBeGreaterThan(1);
  });

  it('passes as committed', () => {
    expect(triageProblems(domains, entries)).toEqual([]);
  });

  it('covers exactly the domains check:routes calls ambiguous', () => {
    expect(Object.keys(entries).sort()).toEqual([...domains].sort());
  });

  it('explains what the verdicts mean', () => {
    for (const verdict of VERDICTS) expect(note).toContain(verdict);
  });

  it('permits unexamined, and says why that is deliberate', () => {
    // "Nobody has looked" said out loud beats it hiding inside a flat list -
    // the rule docs/edge-rbac-triage.json already encodes.
    expect(VERDICTS.has('unexamined')).toBe(true);
    expect(note).toMatch(/unexamined.*permitted|permitted verdict/i);
    const unexamined = Object.values(entries).filter((e) => e.verdict === 'unexamined');
    // Round 177 examined the last one. The property was never "something is
    // unexamined" (round 91's floor-on-a-worklist lesson) - it is that an
    // unexamined entry, whenever there is one, says what was not looked at.
    // An unexamined entry still has to say WHAT has not been looked at.
    for (const entry of unexamined) expect(entry.reason.length).toBeGreaterThan(40);
  });

  it('records the two findings that were in the list all along', () => {
    // Round 171 ported the usage limit to the leads edge function.
    expect(entries.leads.verdict).toBe('resolved');
    expect(entries.leads.reason).toContain('enforceUsageLimits');
    // Round 170 corrected `import`: the edge function has no AI branch, so the
    // plan flag gates nothing there (import-ai-plan-gate.test.ts holds that).
    expect(entries.import.verdict).toBe('express-only-capability');
    expect(entries.import.reason).toContain('ai_csv_import');
    expect(entries.gdpr.verdict).toBe('resolved');
  });

  it('names the round for every resolved entry, so the claim is checkable', () => {
    for (const [domain, entry] of Object.entries(entries)) {
      if (entry.verdict !== 'resolved') continue;
      expect(entry.reason, `${domain} claims resolved without naming when`).toMatch(/[Rr]ound \d+/);
    }
  });
});

describe('the rules, against fixtures', () => {
  const ok = { verdict: 'parity', reason: 'x'.repeat(50) };

  it('accepts a triaged domain', () => {
    expect(triageProblems(['a'], { a: ok })).toEqual([]);
  });

  it('reports a domain with no entry', () => {
    expect(triageProblems(['a'], {})).toEqual([{ kind: 'untriaged', domain: 'a' }]);
  });

  it('reports a verdict outside the vocabulary', () => {
    const out = triageProblems(['a'], { a: { verdict: 'probably-fine', reason: 'x'.repeat(50) } });
    expect(out.map((p) => p.kind)).toEqual(['bad-verdict']);
  });

  it('reports a reason too thin to be one', () => {
    // "Not examined." is a category, not a reason: the next reader needs to
    // know which files to open.
    expect(
      triageProblems(['a'], { a: { verdict: 'unexamined', reason: 'Not examined.' } }),
    ).toEqual([{ kind: 'unreasoned', domain: 'a' }]);
  });

  it('reports an entry for a domain that is no longer divergent', () => {
    // Leaving it pre-forgives whatever returns under that name - the defect
    // check:error-shape's baseline had when four of its files were deleted.
    expect(triageProblems([], { gone: ok })).toEqual([{ kind: 'stale', domain: 'gone' }]);
  });
});

describe('it is wired, not merely runnable (CR-023)', () => {
  it('is an npm script and runs in CI', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['check:route-divergence']).toBeTruthy();
    expect(read('.github/workflows/ci.yml')).toContain('npm run check:route-divergence');
  });
});
