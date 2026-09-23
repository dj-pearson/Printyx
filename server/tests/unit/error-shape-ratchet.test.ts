/**
 * The error-shape ratchet, the regression it missed, and why it missed it
 * (CR-023 / round 86).
 *
 * `check:error-shape` existed, was in package.json, had a 1,392-entry baseline
 * - and was in NO CI workflow. So when WF-S-11 correctly added authentication
 * to `routes-renewal-management.ts` and answered the new refusals with
 * `res.status(401).json({ error })`, the count went 36 -> 46 and nothing said
 * so. It sat red for a day, and the only reason it surfaced is that a later
 * round ran every guard in package.json rather than the ones it had touched.
 *
 * A guard nobody runs does not hold a line; it accumulates a baseline that
 * drifts. This file locks the three things that fixes: the guard runs in CI,
 * the file that regressed is converted, and the writer no longer launders a
 * per-file growth through a falling total.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('the guard actually runs', () => {
  it('is wired into CI, not only into package.json', () => {
    /**
     * This is the whole finding. Being in package.json makes a guard
     * RUNNABLE; being in the workflow makes it RUN. Four of this session's
     * live defects were found by someone running the full set on a whim.
     */
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('npm run check:error-shape');
    expect(JSON.parse(read('package.json')).scripts['check:error-shape']).toBe(
      'node scripts/check-error-shape.mjs',
    );
  });
});

describe('routes-renewal-management answers in contract', () => {
  const RAW = read('server/routes-renewal-management.ts');
  /**
   * Comments blanked. The file's header QUOTES the broken tenant read that
   * WF-S-11 removed, in prose explaining the fix, so an absence assertion over
   * the raw source reports its own explanation as the defect. Sixth time this
   * session, and the first in a test I wrote knowing the rule.
   */
  const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  it('has no `res.json({ error })` left', () => {
    // The guard's own pattern, so this cannot drift from what it counts.
    const ERROR_SHAPE = /\.json\(\s*\{\s*(?:\/\/[^\n]*\n\s*)*error\s*:/g;
    expect(SRC.match(ERROR_SHAPE) ?? []).toEqual([]);
  });

  it('uses the shared helpers rather than hand-built bodies', () => {
    expect(SRC).toMatch(
      /import \{ badRequest, notFound, serverError \} from '\.\/lib\/error-response'/,
    );
    // A floor: a file that stopped answering errors at all would pass the
    // absence check above while having lost its refusals.
    expect((SRC.match(/\bbadRequest\(res,/g) ?? []).length).toBeGreaterThanOrEqual(18);
    expect((SRC.match(/\bnotFound\(res,/g) ?? []).length).toBeGreaterThanOrEqual(9);
    expect((SRC.match(/\bserverError\(res,/g) ?? []).length).toBeGreaterThanOrEqual(18);
  });

  it('kept the authentication WF-S-11 added, which is what grew the count', () => {
    // The regression came from a correct security fix. Converting its
    // responses must not quietly undo it.
    const handlers = SRC.match(/app\.(get|post|put|patch|delete)\(/g) ?? [];
    const guarded = SRC.match(/requireAuth/g) ?? [];
    expect(handlers.length).toBeGreaterThanOrEqual(18);
    // One import plus one per handler.
    expect(guarded.length).toBeGreaterThanOrEqual(handlers.length);
    expect(SRC).toContain('getTenantId(req)');
    expect(SRC).not.toMatch(/req\.headers\['x-tenant-id'\]/);
  });

  it('is still annotated as held rather than deleted', () => {
    // AUDIT-026 owns whether this feature lives. Converting its error bodies
    // is not a vote on that, and the header must keep saying so - asserted
    // against RAW, because the header is exactly what this one is about.
    expect(RAW).toContain('DO NOT "FIX" THIS FILE WITHOUT READING AUDIT-026');
  });
});

describe('the baseline writer only shrinks, per file', () => {
  const GUARD = read('scripts/check-error-shape.mjs');

  it('refuses a per-FILE growth, not merely a rising total', () => {
    /**
     * It compared totals, so converting forty responses in one file while ten
     * appeared in another would have absorbed the ten in silence - the exact
     * growth the normal run exists to catch, laundered through an unrelated
     * improvement. Fifth time this session that a total stood in for a
     * property.
     */
    const at = GUARD.indexOf("if (args.includes('--update-baseline'))");
    expect(at).toBeGreaterThan(-1);
    const body = GUARD.slice(at, GUARD.indexOf('writeFileSync(', at));
    expect(body).toMatch(
      /Object\.entries\(counts\)\.filter\(\(\[file, n\]\) => n > \(previous\[file\]/,
    );
    expect(body).toMatch(/grownNow\.length > 0/);
    expect(body).toMatch(/process\.exit\(1\)/);
  });

  it('preserves a hand-written note instead of regenerating its default', () => {
    expect(GUARD).toMatch(/function existingNote\(\)/);
    expect(GUARD).toMatch(/note: existingNote\(\) \?\? DEFAULT_NOTE/);
  });

  it('is no longer on the shrink-only list of writers that regenerate', () => {
    const list = read('server/tests/unit/baseline-notes-preserved.test.ts');
    expect(list).not.toContain("'check-error-shape.mjs'");
  });
});

describe('the baseline names only files that exist', () => {
  const baseline = JSON.parse(read('docs/error-shape-baseline.json'));

  it('holds no entry for a deleted file', () => {
    /**
     * Four did: routes-lead-assignment (41), routes-cross-module (14),
     * routes/task-routes (12) and routes-auto-lead-routing (4), deleted by
     * earlier rounds of this same session. Two costs, and the second is the
     * one that matters - such an entry claims credit for debt that was
     * deleted rather than converted, AND a file coming back under that name
     * would arrive pre-forgiven for every response it carries.
     */
    const missing = Object.keys(baseline.counts).filter((f) => !existsSync(join(repo, f)));
    expect(missing).toEqual([]);
  });

  it('is a real baseline, not an empty one passing vacuously', () => {
    // A floor on the DEBT fails every time the debt shrinks, which is the
    // outcome this ratchet exists to produce (round 162: deleting one router
    // took it 50 -> 49 files). The vacuous case it guards against is an empty
    // or truncated file, so the floor sits far below today's count.
    const files = Object.keys(baseline.counts);
    expect(files.length).toBeGreaterThanOrEqual(10);
    const total = Object.values(baseline.counts).reduce((a: number, b) => a + (b as number), 0);
    expect(total).toBeGreaterThan(100);
  });

  it('keeps the note that says what the entries mean', () => {
    expect(baseline.note).toMatch(/message, code, details, requestId/);
    expect(baseline.note).toMatch(/Shrink these counts, never grow them/);
  });
});
