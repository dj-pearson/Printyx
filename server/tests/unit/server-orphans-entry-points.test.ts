/**
 * A reachability walk is only as good as its list of front doors (round 90).
 *
 * `check:server-orphans` rooted its walk at `server/index.ts` alone, so every
 * CLI this repo ships read as dead code: `npm run db:migrate` runs
 * server/lib/migrate.ts, `npm run seed:demo` runs
 * server/seeds/seed-all-demo-data.ts, and seed:rbac, seed:kpis, seed:reports
 * and nine more are the same shape. All 14 sat in a baseline whose own note
 * calls it a TODO list - so a tenth of the todos were "delete this working
 * tool". Baseline 135 -> 121.
 *
 * IT SURFACED SIDEWAYS, and that is the part worth keeping. Round 89's note on
 * PA-032 named `server/lib/migrate.ts` as a verified deliverable;
 * `check:story-orphans` asks this guard whether anything reaches a named path,
 * got "no", and reported a passing story as naming something unreachable. One
 * guard's blind spot arrived as another guard's finding. Same shape
 * `check:unreferenced-edge-fns` had to learn when pg_cron turned out to be a
 * caller.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error - .mjs guard with no type declarations
import { serverFilesInScripts } from '../../../scripts/check-server-orphans.mjs';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const GUARD = read('scripts/check-server-orphans.mjs');
const scripts: Record<string, string> = JSON.parse(read('package.json')).scripts ?? {};

/** Every server file a package.json script executes. Derived, not listed. */
const npmEntries = [
  ...new Set(
    Object.values(scripts).flatMap((cmd) =>
      [...String(cmd).matchAll(/server\/[A-Za-z0-9_./-]+\.tsx?/g)].map((m) => m[0]),
    ),
  ),
].filter((p) => existsSync(join(repo, p)));

describe('every way to start the server is a root', () => {
  it('there really are CLI entry points, so the walk is not vacuous', () => {
    expect(npmEntries.length).toBeGreaterThanOrEqual(10);
    // The ones this round resolved, named so a regression is legible.
    expect(npmEntries).toContain('server/lib/migrate.ts');
    expect(npmEntries).toContain('server/seeds/seed-all-demo-data.ts');
  });

  it('the guard derives them from package.json rather than listing them', () => {
    /**
     * CALLED, not read. A source assertion here SURVIVED a mutant that
     * hardcoded the return to a single path, because the function and its
     * readFileSync line were both still in the file. A hand-kept list goes
     * stale the first time somebody adds a seeder, so derivation is the
     * property and only invoking it proves the property holds.
     */
    expect(
      serverFilesInScripts({
        'seed:whatever': 'tsx server/seeds/brand-new-seeder.ts --force',
        'db:migrate': 'tsx server/lib/migrate.ts',
        // A .ts path OUTSIDE server/ is not a server root. Without this case
        // the fixture cannot tell a correct extractor from one that matches
        // every TypeScript path it sees - a mutant dropping the `server/`
        // prefix survived until this line existed.
        'check:phantom-cols': 'tsx scripts/check-phantom-columns.ts',
        build: 'vite build',
      }).sort(),
    ).toEqual(['server/lib/migrate.ts', 'server/seeds/brand-new-seeder.ts']);

    // A script naming nothing under server/ contributes no root.
    expect(serverFilesInScripts({ lint: 'eslint .', test: 'vitest run' })).toEqual([]);

    // And the roots really are fed into the walk.
    expect(GUARD).toMatch(/walk\(\[ENTRY, \.\.\.scriptEntries\]\)/);
  });

  it('no npm entry point is listed as an orphan', () => {
    // The property, stated over the real baseline: a file the repo executes on
    // purpose is not dead code.
    const baseline = JSON.parse(read('docs/server-orphans-baseline.json'));
    const listed: string[] = baseline.orphans.map((o: string) => o.replace(/ \(test-only\)$/, ''));
    expect(listed.filter((f) => npmEntries.includes(f))).toEqual([]);
  });

  it('the baseline is still a real list, not emptied by the widening', () => {
    // A floor: widening roots until everything is reachable would also pass
    // the assertion above.
    const baseline = JSON.parse(read('docs/server-orphans-baseline.json'));
    expect(baseline.orphans.length).toBeGreaterThan(100);
    expect(baseline.total).toBe(baseline.orphans.length);
  });

  it('the note says the roots changed, so 135 -> 121 does not read as deletions', () => {
    const baseline = JSON.parse(read('docs/server-orphans-baseline.json'));
    expect(baseline.note).toMatch(/package\.json script/);
    expect(baseline.note).toMatch(/round 90/);
  });

  it('the writer preserves a hand-written note', () => {
    expect(GUARD).toMatch(/function existingNote\(\)/);
    expect(GUARD).toMatch(/note: existingNote\(\) \?\? DEFAULT_NOTE/);
    expect(read('server/tests/unit/baseline-notes-preserved.test.ts')).not.toContain(
      "'check-server-orphans.mjs'",
    );
  });
});

describe('the story-orphans report agrees with it', () => {
  it('no longer reports migrate.ts, and its baseline was tightened', () => {
    /**
     * `check:story-orphans` reads the three orphan baselines, so correcting
     * this one resolved four of its findings. Tightening in the same commit is
     * what makes the assertion evaluated rather than trusted - the rule
     * CLAUDE.md records from the today-dashboard phantom tables.
     */
    const baseline = JSON.parse(read('docs/passing-story-orphans-baseline.json'));
    expect(baseline.count).toBe(baseline.entries.length);
    expect(baseline.entries.filter((e: string) => e.includes('server/lib/migrate.ts'))).toEqual([]);
  });
});
