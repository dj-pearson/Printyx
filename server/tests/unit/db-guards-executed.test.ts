/**
 * The database-bound guards, executed (COP-M00 / COP-M07, round 88).
 *
 * Six scripts in package.json need a live database, so no round had ever run
 * them and their state was assumed rather than known. Round 87 got `check:drift`
 * to run for the first time by fixing SQL that had never parsed. This round
 * replayed all 80 journalled migrations into a scratch Postgres 16 and ran the
 * rest of them against it.
 *
 * Two outcomes are locked here: the drift guard reports ZERO across 682 tables,
 * and the stage-resolution guard no longer calls an empty database a pass.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { locationHistory } from '../../../shared/mobile-service-schema';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('the one drift finding across 682 tables', () => {
  /**
   * `check:drift`'s first clean pass reported exactly one mismatch:
   * `location_history.id`, declared uuid and `varchar DEFAULT
   * gen_random_uuid()` in migration 0000.
   *
   * The DECLARATION moved, because the database is right: 343 of this schema's
   * `id` columns are varchar against 300 uuid, `tenants.id` is
   * `varchar PRIMARY KEY DEFAULT gen_random_uuid()`, nothing holds a foreign
   * key to this column, and converting a primary key on a table that takes a
   * GPS fix per technician per minute is a full rewrite under an exclusive
   * lock for no behavioural gain.
   */
  it('location_history.id is declared as the column actually is', () => {
    const col = getTableConfig(locationHistory).columns.find((c) => c.name === 'id');
    expect(col).toBeDefined();
    expect(col!.getSQLType()).toMatch(/^varchar/);
    expect(col!.primary).toBe(true);
  });

  it('matches migration 0000, which is the authority on the live shape', () => {
    const ddl = read('drizzle/migrations/0000_fuzzy_blizzard.sql');
    const at = ddl.indexOf('CREATE TABLE "location_history" (');
    expect(at).toBeGreaterThan(-1);
    const create = ddl.slice(at, ddl.indexOf(');', at));
    expect(create).toMatch(/"id" varchar PRIMARY KEY/);
    // No later migration alters it, so 0000 is the whole story here.
    expect(ddl.match(/ALTER TABLE "location_history"[^\n]*"id"/g) ?? []).toEqual([]);
  });

  it('keeps session_id as uuid, because that one agrees', () => {
    // It references mobile_service_sessions.id, which IS uuid live. Correcting
    // the whole file to varchar would have created drift rather than removed it.
    //
    // Resolved through getTableConfig rather than by reading the source: three
    // tables in this file declare `sessionId: uuid('session_id')`, so a source
    // scan - or a mutation - lands on whichever comes first and says nothing
    // about THIS table. That is how a mutant on line 70 appeared to survive an
    // assertion about line 144.
    const col = getTableConfig(locationHistory).columns.find((c) => c.name === 'session_id');
    expect(col!.getSQLType()).toBe('uuid');
  });

  it('says why, so nobody "fixes" it back to uuid', () => {
    const src = read('shared/mobile-service-schema.ts');
    const at = src.indexOf("pgTable('location_history'");
    const block = src.slice(at, src.indexOf("id: varchar('id')", at));
    expect(block).toMatch(/varchar, NOT uuid/);
    expect(block).toMatch(/tenants\.id/);
  });
});

describe('an empty database is unknown, not a pass', () => {
  const RAW = read('scripts/check-stage-resolution.mjs');
  /**
   * Comments blanked for the absence assertion below: the fix's own comment
   * quotes the broken `totals.deals === 0` while explaining why it never
   * fired, so a raw scan reports the explanation as the defect. SEVENTH time
   * this session, and the second inside a test written with the rule in view -
   * which is the argument for stripping by default rather than when it occurs
   * to you.
   */
  const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  /**
   * The header promises "did not run" is never read as "passed", and it
   * delivered that for the CONNECT case only. Pointed at a replayed schema
   * with no rows it printed "Checked 0 deal(s) ... ✓ Every deal resolves to
   * exactly one canonical pipeline stage" - true of an empty set, and the
   * guard CLAUDE.md says to run before and after touching any stage writer.
   */
  it('exits 2 when there are no deals at all', () => {
    /**
     * Bound to the FIRST exit after the floor opens, not to a window ending at
     * the next `process.exit(2)`. The first cut did the latter and a mutant
     * changing the floor to exit 0 SURVIVED: with the floor's own exit gone,
     * the search ran on to the catch block's exit(2), and the catch says
     * "Treat this as unknown, not as a pass" too, so every assertion matched
     * text belonging to a different construct. Fifth time a window crossed
     * into the next thing this session.
     */
    const at = SRC.indexOf('Number(totals.deals) === 0');
    expect(at).toBeGreaterThan(-1);
    const firstExit = SRC.slice(at).match(/process\.exit\((\d)\)/);
    expect(firstExit?.[1]).toBe('2');
    const block = SRC.slice(at, at + (firstExit?.index ?? 0));
    expect(block).toMatch(/could NOT RUN/);
    expect(block).toMatch(/unknown, not a pass/);
  });

  it('coerces the count, because node-postgres returns it as a string', () => {
    /**
     * The floor was written as `totals.deals === 0` and silently never fired:
     * count(*) comes back as '0', because a bigint does not fit a JS number
     * safely. Caught by running it against an empty database rather than by
     * reading it - a floor that cannot fire is the same vacuous pass it was
     * added to close.
     */
    expect(SRC).toMatch(/Number\(totals\.deals\) === 0/);
    expect(SRC).not.toMatch(/totals\.deals === 0/);
  });

  it('keys on deals rather than on stages, deliberately', () => {
    // A tenant can legitimately have no canonical stages before its template
    // is bootstrapped, and a deployment can have no legacy stages once the
    // COP-M07 migration finishes. Neither means "wrong database"; no deals at
    // all does.
    const at = RAW.indexOf('Number(totals.deals) === 0');
    expect(RAW.slice(Math.max(0, at - 1200), at)).toMatch(/Deliberately keyed on DEALS/);
  });

  it('still passes and still fails on substance', () => {
    // Verified live against a scratch Postgres with the full chain replayed:
    // one deal resolving through a mirrored legacy stage exits 0, the same
    // deal repointed at a stage with no mirror exits 1, no deals exits 2.
    expect(SRC).toMatch(/process\.exit\(1\)/);
    expect(SRC).toMatch(/✓ Every deal resolves to exactly one canonical pipeline stage\./);
  });
});
