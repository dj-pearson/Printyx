/**
 * A path you compare against is not a path you go to (AUDIT-014).
 *
 * check:check-nav-targets collects EVERY "/" string literal in client/src on
 * purpose - its header records a post-login 404 that survived a whole audit
 * pass because an earlier script matched only navigation expressions and could
 * not see a route path held as an object value. That design stays.
 *
 * But collecting everything swept up two positions where navigation is
 * syntactically impossible, and all six of the last baseline entries were one
 * or the other: a literal being COMPARED against the current location, and a
 * member of a deny-list the code exists to refuse. A ratchet holding six
 * non-defects is where a real one hides, so both are excluded by rule and the
 * baseline is at zero.
 *
 * These tests pin the distinction: the exclusions must not blind the guard to a
 * genuinely broken target, which is the only way this change could go wrong.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const script = join(repo, 'scripts/check-nav-targets.mjs');
const baselinePath = join(repo, 'docs/nav-targets-baseline.json');

function runGuard(): { code: number; out: string } {
  try {
    const out = execFileSync('node', [script], { cwd: repo, encoding: 'utf8' });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('the nav-target gate', () => {
  it('is at zero and is a gate, not a ratchet', () => {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    expect(baseline.allowed).toEqual([]);
    expect(baseline.note).toMatch(/AT ZERO/);
    expect(runGuard().code).toBe(0);
  });

  it('still catches a target that resolves to no route', () => {
    // The whole risk of the predicate and deny-list rules is that they blind
    // the guard. A broken navigate() has to keep failing.
    const victim = join(repo, 'client/src/components/layout/smart-breadcrumb.tsx');
    const original = readFileSync(victim, 'utf8');
    try {
      writeFileSync(
        victim,
        original.replace(
          "  if (location === '/') {",
          "  navigate('/definitely-not-a-route');\n  if (location === '/') {",
        ),
      );
      const { code, out } = runGuard();
      expect(code).toBe(1);
      expect(out).toContain('/definitely-not-a-route');
    } finally {
      writeFileSync(victim, original);
    }
  });
});

describe('the two exclusions are stated in the script header', () => {
  const header = readFileSync(script, 'utf8').slice(0, 6000);

  it('names the predicate rule and why it is not the narrowing the header warns against', () => {
    expect(header).toContain('A PATH YOU COMPARE AGAINST IS NOT A PATH YOU GO TO');
    expect(header).toMatch(/exclude positions, not\s+\*? ?expression kinds/);
  });

  it('keeps the collect-every-literal rationale it was nearly narrowed away from', () => {
    expect(header).toContain('Why it collects EVERY');
  });
});

describe('SmartBreadcrumb no longer compares against a route that does not exist', () => {
  it('drops the dead /dashboard arm', () => {
    const src = readFileSync(
      join(repo, 'client/src/components/layout/smart-breadcrumb.tsx'),
      'utf8',
    );
    const code = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // App.tsx routes the authed dashboard at '/'; the only /dashboard path is
    // /dashboard/today, a different string, so this arm never matched.
    expect(code).not.toContain("location === '/dashboard'");
    expect(code).toContain("location === '/'");
  });

  it('keeps the .includes() branches, which are correct', () => {
    const src = readFileSync(
      join(repo, 'client/src/components/layout/smart-breadcrumb.tsx'),
      'utf8',
    );
    // These match the registered /equipment-lifecycle and /warehouse-operations
    // by prefix. The guard reported them only because no EXACT route of that
    // name exists, which is what .includes is for.
    expect(src).toContain("location.includes('/equipment')");
    expect(src).toContain("location.includes('/warehouse')");
  });
});
