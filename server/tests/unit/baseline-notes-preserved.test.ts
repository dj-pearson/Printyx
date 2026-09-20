/**
 * A baseline writer must not eat the note somebody wrote in it.
 *
 * Every ratchet here is annotated, and that annotation is the whole difference
 * between a worklist and an undifferentiated list: "each is a question - who
 * fills this in?", "a TODO list, not settled debt", "these 30 are PRINTED on
 * every run because each needs its own call". A writer that regenerates its
 * default `note` on every `--update-baseline` discards all of it, silently, on
 * the next tighten.
 *
 * It cost two rounds on check:raw-body-writes before a test caught it: the
 * paragraph explaining why that count jumped from 12 to 23 - the one thing
 * stopping a reader taking it for a regression - was written, lost, rewritten
 * and lost again inside one round.
 *
 * An empirical sweep of all 33 writers found FIVE that destroyed a hand-written
 * note: check-fk-id-types, check-month-arithmetic, check-no-random-metrics,
 * check-insert-tenant-id and check-unwritten-tables. Two of them own worklists
 * CLAUDE.md names by hand.
 *
 * This is a source check rather than a re-run of that sweep, because running 33
 * scripts in a unit test is minutes of wall clock for a property that is
 * visible in four lines of each file.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Every guard script that writes a JSON baseline. */
const writers = readdirSync(join(repo, 'scripts'))
  .filter((f) => /^check-.*\.(mjs|ts)$/.test(f))
  .map((f) => ({ file: f, src: read(join('scripts', f)) }))
  .filter((s) => /writeFileSync\(/.test(s.src));

describe('every baseline writer keeps a note it did not write', () => {
  it('there are writers to check, so this cannot pass vacuously', () => {
    expect(writers.length).toBeGreaterThan(25);
  });

  /**
   * A SHRINK-ONLY LIST, not a zero gate, and the distinction is honest rather
   * than convenient. An empirical sweep - back up the baseline, run the writer
   * with --update-baseline, diff the note, restore - proved only SIX writers
   * destroyed a note, because the rest regenerate text identical to what is in
   * the file. Those are not broken today; they are one annotation away from
   * being broken, which is a worklist rather than a defect.
   *
   * What this asserts is that the set never GROWS: a new writer must preserve,
   * and a fixed one may not regress.
   */
  const KNOWN_REGENERATORS = new Set([
    'check-calendar-date-bounds.mjs',
    'check-chained-where.mjs',
    'check-duplicate-routes.mjs',
    'check-duplicate-tables.mjs',
    'check-edge-path-coverage.mjs',
    'check-edge-path-normalization.mjs',
    'check-edge-rbac.mjs',
    'check-fabricated-fallbacks.mjs',
    'check-identical-fallback.mjs',
    'check-lint.mjs',
    'check-nav-targets.mjs',
    'check-no-static-posture.mjs',
    'check-orphan-files.mjs',
    'check-passing-story-orphans.mjs',
    'check-permission-vocabulary.mjs',
    'check-phantom-columns.ts',
    'check-prd-references.mjs',
    'check-query-states.mjs',
    'check-raw-api-fetch.mjs',
    'check-route-shadowing.mjs',
    'check-server-fabricated.mjs',
    'check-server-orphans.mjs',
    'check-session-user-auth.mjs',
    'check-shadowed-express.mjs',
    'check-sql-string-tables.mjs',
    'check-tenant-id-type.mjs',
    'check-types.mjs',
    'check-uncalled-express-routes.mjs',
    'check-unlinked-routes.mjs',
    'check-unreferenced-edge-fns.mjs',
  ]);

  it('no NEW writer regenerates its note', () => {
    // Walked per file, not counted: a total stays green while one regresses.
    const offenders: string[] = [];
    for (const { file, src } of writers) {
      if (!/\bnote:\s/.test(src)) continue;
      const preserves = /existingBaselineNote\(|existingNote\b/.test(src);
      if (!preserves && !KNOWN_REGENERATORS.has(file)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('the list shrinks, never grows', () => {
    // Every name on it must still be a writer that exists and still regenerate;
    // a stale entry would let a regression hide behind it.
    const stale: string[] = [];
    for (const file of KNOWN_REGENERATORS) {
      const writer = writers.find((w) => w.file === file);
      if (!writer) {
        stale.push(`${file} (no longer a writer)`);
        continue;
      }
      if (!/\bnote:\s/.test(writer.src)) {
        // It writes a baseline but puts no note in it, so it has nothing to
        // eat. Six entries were wrong this way on the first cut - a list built
        // from "writes a file" rather than "writes a note".
        stale.push(`${file} (emits no note - remove it from the list)`);
        continue;
      }
      if (/existingBaselineNote\(|existingNote\b/.test(writer.src)) {
        stale.push(`${file} (preserves now - remove it from the list)`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('the five that were fixed each read the baseline back', () => {
    // Named, because these are the ones an empirical run proved destroyed a
    // note rather than merely lacking the guard clause.
    for (const file of [
      'check-fk-id-types.mjs',
      'check-month-arithmetic.mjs',
      'check-no-random-metrics.mjs',
      'check-insert-tenant-id.mjs',
      'check-unwritten-tables.mjs',
      'check-raw-body-writes.mjs',
    ]) {
      const src = read(join('scripts', file));
      expect({ file, reads: /existingBaselineNote\(|existingNote\b/.test(src) }).toEqual({
        file,
        reads: true,
      });
      // And the preserved value is what it serialises, not just a variable it
      // computed and dropped - the COP-B04 shape.
      // Newline-tolerant: prettier wraps `note:` onto its own line as soon as
      // the fallback is a concatenation, and an assertion that assumes one
      // line reports a correct file as wrong.
      expect({
        file,
        used: /note:\s*\n?\s*existing(BaselineNote\(\w+\)|Note)\s*\?\?/.test(src),
      }).toEqual({ file, used: true });
    }
  });

  it('the preserver fails closed: an unreadable baseline falls back, never throws', () => {
    // A guard script that crashes on a missing baseline cannot create one.
    for (const file of ['check-unwritten-tables.mjs', 'check-raw-body-writes.mjs']) {
      const src = read(join('scripts', file));
      const at = src.search(/function existingBaselineNote\(|const existingNote = /);
      expect({ file, found: at > -1 }).toEqual({ file, found: true });
      const body = src.slice(at, at + 420);
      expect({ file, guarded: /catch \{\s*return null;/.test(body) }).toEqual({
        file,
        guarded: true,
      });
    }
  });
});

describe('the worklist notes this protects are still there', () => {
  it('the annotated baselines still carry their question', () => {
    // If one of these ever comes back as the generated default, the writer ate
    // it again and the assertion above missed it.
    const cases: [string, RegExp][] = [
      ['docs/unwritten-tables-baseline.json', /question/i],
      ['docs/raw-body-writes-baseline.json', /BECAUSE THE GUARD GOT BETTER/],
      ['docs/random-metrics-baseline.json', /Math\.random/],
      ['docs/tenant-write-filter-baseline.json', /SHRINK ONLY/],
    ];
    for (const [file, pattern] of cases) {
      const note = JSON.parse(read(file)).note as string;
      expect({ file, annotated: pattern.test(note) }).toEqual({ file, annotated: true });
    }
  });
});

describe('the two tables that made the gate red are recorded, with an answer', () => {
  /**
   * check:unwritten-tables was RED ON MAIN, not just here: `manager_insights`
   * and `sales_metrics` are read by supabase/functions/crm/index.ts and written
   * by nothing. Both have live callers - CrmGoalsDashboard's insights panel and
   * its conversion analysis - so both render as a feature that does not exist.
   */
  const CRM = read('supabase/functions/crm/index.ts');

  it('both are in the baseline', () => {
    const baseline = JSON.parse(read('docs/unwritten-tables-baseline.json'));
    const listed = JSON.stringify(baseline);
    for (const table of ['manager_insights', 'sales_metrics']) {
      expect({ table, recorded: listed.includes(table) }).toEqual({ table, recorded: true });
    }
  });

  it('each read site says who should fill the table in', () => {
    // AUDIT-028's rule: an entry is a QUESTION, and the answer belongs where
    // the next reader is - at the read, not only in a JSON list.
    const insights = CRM.indexOf("subRoute === 'manager-insights'");
    expect(insights).toBeGreaterThan(-1);
    expect(CRM.slice(Math.max(0, insights - 900), insights)).toMatch(
      /NOTHING WRITES `manager_insights`/,
    );

    const conversion = CRM.indexOf("parts[1] === 'conversion-analysis'");
    expect(conversion).toBeGreaterThan(-1);
    expect(CRM.slice(Math.max(0, conversion - 900), conversion)).toMatch(
      /NOTHING WRITES `sales_metrics`/,
    );
  });
});
