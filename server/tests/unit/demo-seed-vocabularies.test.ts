/**
 * `npm run seed:demo` can fill a freshly provisioned database again
 * (PA-032 / round 90).
 *
 * Round 89 made `db:migrate` able to create a database for the first time in
 * 29 migrations. The seeder is what makes that database usable, and PA-032's
 * evidence line says "seed:demo then runs clean" - taken at 43 migrations, like
 * the rest of it. At 80 it died:
 *
 *     new row for relation "service_tickets" violates check constraint
 *     "service_tickets_status_check"   (23514)
 *
 * `0078_wf_v05_ticket_vocabulary.sql` fixed the ticket vocabulary to
 * open|assigned|scheduled|en_route|on_site|in_progress|on_hold|completed|
 * cancelled, and the seeder still wrote 'resolved'. The CHECK is NOT VALID, so
 * existing rows were never re-checked and only NEW ones are refused - which is
 * why this shows up on a fresh provision and on no established database.
 *
 * The vocabularies here are DERIVED from the migration that declares them, so a
 * later change to either one fails this rather than the next person's seed.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const SEED = read('server/seeds/demo-data.ts').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
/**
 * Comment-stripped, and anchored on ADD CONSTRAINT below.
 *
 * The migration's header quotes each constraint NAME while explaining how to
 * validate it later, so the first occurrence of `service_tickets_status_check`
 * is in prose and a slice from there finds no members at all. Ninth comment
 * trap this session; the anchor is the real fix, the strip is the belt.
 */
const MIGRATION = read('drizzle/migrations/0078_wf_v05_ticket_vocabulary.sql').replace(
  /^\s*--.*$/gm,
  '',
);

/** The members of one `col IN (...)` / `= ANY (ARRAY[...])` CHECK. */
function vocabulary(constraint: string): string[] {
  const at = MIGRATION.indexOf(`ADD CONSTRAINT ${constraint}`);
  expect({ constraint, declared: at > -1 }).toEqual({ constraint, declared: true });
  const clause = MIGRATION.slice(at, MIGRATION.indexOf(';', at));
  const members = [...clause.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  expect(members.length).toBeGreaterThan(1);
  return members;
}

describe('the demo seeder writes only values the CHECK allows', () => {
  const STATUSES = vocabulary('service_tickets_status_check');
  const PRIORITIES = vocabulary('service_tickets_priority_check');

  it('derives a real vocabulary from the migration, not a copied list', () => {
    expect(STATUSES).toContain('completed');
    expect(STATUSES).not.toContain('resolved');
    expect(PRIORITIES).toEqual(expect.arrayContaining(['low', 'medium', 'high', 'urgent']));
  });

  /** The ticket block, bounded by its own array literal. */
  const ticketBlock = (() => {
    const at = SEED.indexOf('const ticketData');
    expect(at).toBeGreaterThan(-1);
    return SEED.slice(at, SEED.indexOf('.insert(serviceTickets)', at));
  })();

  it('every seeded ticket status is in the vocabulary', () => {
    const written = [...ticketBlock.matchAll(/status: '([a-z_]+)'/g)].map((m) => m[1]);
    expect(written.length).toBeGreaterThanOrEqual(4);
    expect([...new Set(written.filter((s) => !STATUSES.includes(s)))]).toEqual([]);
  });

  it('every seeded ticket priority is in the vocabulary', () => {
    const written = [...ticketBlock.matchAll(/priority: '([a-z_]+)'/g)].map((m) => m[1]);
    expect(written.length).toBeGreaterThanOrEqual(4);
    expect([...new Set(written.filter((p) => !PRIORITIES.includes(p)))]).toEqual([]);
  });

  it('says why, because the constraint being NOT VALID is the confusing part', () => {
    // An established database accepts nothing new and rejects nothing old, so
    // "it works in our environment" and "the seeder is broken" are both true.
    expect(read('server/seeds/demo-data.ts')).toMatch(/NOT VALID/);
  });
});

describe('what the corrected chain now produces, end to end', () => {
  /**
   * Verified against a scratch Postgres 16, not asserted from source:
   * `db:migrate` exits 0 with 683 tables and 52 roles, then `seed:demo` exits 0
   * and fills business_records (8), deals (3), equipment (5), service_tickets
   * (4), contracts (3), invoices (4), tasks (4), company_contacts (5) and
   * meter_readings (4).
   *
   * The part worth recording: `check:stage-resolution` then reports "Checked 3
   * deal(s) against 6 legacy stage(s) and 6 canonical stage(s) ... ✓" - the
   * FIRST time that guard has passed on substance rather than vacuously, and
   * the proof that round 88's empty-database floor discriminates rather than
   * merely refusing.
   */
  it('the seeder is reachable from the CLI and the admin endpoint, one copy', () => {
    // Two byte-identical 1,300-line copies used to carry the same defects and
    // needed fixing twice; this one would have been two fixes.
    const cli = read('server/seeds/seed-all-demo-data.ts');
    expect(cli).toMatch(/from '\.\/demo-data'/);
    expect(read('server/routes/admin-seed-routes.ts')).toMatch(/demo-data/);
  });

  it('seeds a deal that resolves through a mirrored legacy stage', () => {
    // What makes check:stage-resolution meaningful against this database: the
    // seed has to produce BOTH sides of the bridge, or the guard passes on an
    // empty set again.
    // Anchored: a bare /legacyStageId/ is satisfied by `legacyStageIdX`, so a
    // mutant renaming the field survived it. Substring overlap is the trap
    // CLAUDE.md already records for `subject:` inside `activity_subject:`.
    expect(SEED).toMatch(/(^|[^A-Za-z_])dealStages([^A-Za-z_]|$)/);
    expect(SEED).toMatch(/(^|[^A-Za-z_])pipelineStages([^A-Za-z_]|$)/);
    expect(SEED).toMatch(/(^|[^A-Za-z_])legacyStageId([^A-Za-z_]|$)/);
  });
});
