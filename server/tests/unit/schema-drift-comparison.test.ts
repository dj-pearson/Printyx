/**
 * `check:drift` could never run, and once it could its output was 99.7% noise
 * (COP-M00 / round 87).
 *
 * It is one of the migration story's tools and one of six scripts this
 * container "cannot run". Pointed at a real Postgres 16 with the journalled
 * chain replayed, it died before reading a row:
 *
 *     error: syntax error at or near "notnull"   (42601, position 38)
 *
 * `notnull` is Postgres's POSTFIX "IS NOT NULL" operator, so
 * `(is_nullable = 'NO') notnull` parses as an operator application, never as a
 * column alias. The guard exits 2 on that, which is honest - it fails safe -
 * but it means check:drift has never once reported on drift, on any database,
 * since it was written.
 *
 * With the alias renamed it ran and produced 332 findings, of which 331 were
 * comparisons it could not win. See below.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(process.cwd(), 'scripts/check-schema-drift.ts'), 'utf8');

describe('the emitted SQL parses', () => {
  it('uses no bare `notnull` alias', () => {
    /**
     * Renamed rather than quoted. `"notnull"` would parse, and would leave the
     * next editor one unquoted copy away from the same 42601 - on a script
     * whose failure mode is silence about schema drift.
     */
    expect(SRC).not.toMatch(/\bnotnull\b/);
    expect(SRC).toMatch(/\(is_nullable = 'NO'\) is_required/);
  });

  it('still emits the NOT NULL comparison it renamed', () => {
    // A floor: deleting the column rather than renaming it would also satisfy
    // the assertion above while removing a whole class of drift detection.
    expect(SRC).toMatch(/with expected\(tbl, col, sqltype, is_required\) as \(values/);
    expect(SRC).toMatch(/where e\.is_required and not l\.is_required/);
  });
});

describe('a comparison the query cannot win is not drift', () => {
  /**
   * `information_schema.columns.data_type` answers 'USER-DEFINED' for every
   * enum and 'ARRAY' for every array, and NEVER names the specific type. The
   * expected side, built from drizzle, names the enum ('review_decision') or
   * the element ('text array'). So every one of the schema's 252 enum columns
   * and 78 array columns mismatched by construction: 331 of 332 findings on
   * the first real run, burying the one that was genuine.
   *
   * Both sides collapse to the same word now. 332 findings -> 2, both
   * actionable.
   */
  it('collapses an enum column at collection, where its enum-ness is known', () => {
    expect(SRC).toMatch(/import \{ PgTable, PgEnumColumn, getTableConfig \}/);
    expect(SRC).toMatch(/sqlType: is\(c, PgEnumColumn\) \? 'enum' : c\.getSQLType\(\)/);
  });

  it('collapses an array on both sides', () => {
    // Expected side: drizzle spells it `text[]`, normalised to `... array`.
    expect(SRC).toMatch(/if \(base\.endsWith\(' array'\)\) return 'array';/);
    // Live side: data_type is the literal string 'ARRAY'.
    expect(SRC).toMatch(/when 'ARRAY' then 'array'/);
  });

  it('keeps the live enum mapping the expected side now matches', () => {
    expect(SRC).toMatch(/when 'USER-DEFINED' then 'enum'/);
  });

  it('says in the code why a wrong enum is out of scope', () => {
    // The collapse trades away "is it the RIGHT enum", and a guard that
    // narrows what it can see must say so where the narrowing happens rather
    // than only in a story note.
    const at = SRC.indexOf("if (base.endsWith(' array')) return 'array';");
    expect(at).toBeGreaterThan(-1);
    expect(SRC.slice(Math.max(0, at - 1200), at)).toMatch(
      /compares loosely on purpose|out of scope/,
    );
  });
});
