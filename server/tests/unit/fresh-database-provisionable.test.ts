/**
 * `db:migrate` can build a database again (PA-032 / round 89).
 *
 * PA-032's goal is "make a fresh database provisionable from versioned
 * migrations alone (DR readiness)". It was marked passing, verified green at
 * 43 migrations and 668 tables. There are 80 now, and it had been broken since
 * number 72 with nothing checking - so the disaster-recovery guarantee was gone
 * for 29 migrations.
 *
 * Two defects, each hiding the next, because drizzle runs the chain in ONE
 * transaction and stops at the first error:
 *
 *   0072  21 of 45 roles named a `role_type` the enum has never had. One
 *         INSERT, so all 45 failed on 22P02 and not one row was ever inserted
 *         on any database.
 *   0073  UPDATE roles SET updated_at = NOW() - `roles` has no timestamps at
 *         all. 42703.
 *
 * Either one left the fresh database with ZERO tables. Verified end to end:
 * with both corrected, `tsx server/lib/migrate.ts` against an empty Postgres 16
 * exits 0 and produces 683 tables, 80 recorded migrations, 52 seeded roles and
 * COMPANY_ADMIN at level 7 - after which check:drift reports no drift and
 * check:migrations passes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error - .mjs guard with no type declarations
import { analyzeChain } from '../../../scripts/check-migration-enum-values.mjs';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (s: string) => s.replace(/^--.*$/gm, '');

describe('0072 seeds role_type values the enum has', () => {
  const RAW = read('drizzle/migrations/0072_seed_role_catalogue.sql');
  const SQL = strip(RAW);

  /** The enum as migration 0000 declares it - derived, not copied. */
  const ENUM = (() => {
    const m = strip(read('drizzle/migrations/0000_fuzzy_blizzard.sql')).match(
      /CREATE TYPE "public"\."role_type" AS ENUM\(([^)]*)\)/,
    );
    expect(m).toBeTruthy();
    return m![1].split(',').map((v) => v.trim().replace(/'/g, ''));
  })();

  it('has the five members it always had', () => {
    expect(ENUM).toEqual([
      'platform_admin',
      'company_admin',
      'regional_manager',
      'location_manager',
      'department_role',
    ]);
  });

  it('every inserted role_type is a member', () => {
    // Third column of each VALUES row, per the INSERT's column list.
    const rows = [...SQL.matchAll(/^ {2}\('[^']*', '[^']*', '([^']*)'/gm)].map((m) => m[1]);
    expect(rows.length).toBeGreaterThanOrEqual(45);
    const bad = [...new Set(rows.filter((r) => !ENUM.includes(r)))];
    expect(bad).toEqual([]);
  });

  it('is still one statement, which is why a bad value cost everything', () => {
    // No statement-breakpoint: all 45 rows share a fate. That is what turned a
    // wrong literal into "db:migrate cannot create a database".
    expect((SQL.match(/INSERT INTO roles/g) ?? []).length).toBe(1);
    // Asserted on the COMMENT-STRIPPED source: the correction note added above
    // the INSERT contains the words "no statement-breakpoint", so a raw scan
    // reports the explanation as the defect. Eighth time this session.
    expect(SQL).not.toMatch(/statement-breakpoint/);
  });

  it('records that it had never applied, since editing a migration needs that', () => {
    expect(RAW).toMatch(/HAD NEVER APPLIED ANYWHERE/);
  });

  it('still seeds COMPANY_ADMIN, which signup fails without', () => {
    // supabase/functions/signup answers MISSING_ADMIN_ROLE without this row and
    // tells the operator to apply the migration chain - the one thing that
    // could not work.
    expect(SQL).toMatch(/'COMPANY_ADMIN', 'company_admin'/);
    expect(read('supabase/functions/signup/index.ts')).toMatch(/0072_seed_role_catalogue\.sql/);
  });
});

describe('0073 writes only columns roles has', () => {
  const RAW = read('drizzle/migrations/0073_role_module_permissions.sql');
  const SQL = strip(RAW);

  /** roles' real columns, from its CREATE TABLE. */
  const COLUMNS = (() => {
    const ddl = strip(read('drizzle/migrations/0000_fuzzy_blizzard.sql'));
    const at = ddl.indexOf('CREATE TABLE "roles" (');
    expect(at).toBeGreaterThan(-1);
    const body = ddl.slice(at, ddl.indexOf('\n);', at));
    return [...body.matchAll(/^\t"([a-z_]+)"/gm)].map((m) => m[1]);
  })();

  it('roles has created_at and no updated_at, which is the precise fact', () => {
    /**
     * Checked rather than assumed, and it corrected me: a first pass read
     * "roles has no timestamps at all" off a truncated column dump. It has
     * `created_at timestamp DEFAULT now()` and no `updated_at` - which is
     * exactly what 0073's UPDATE named, and why the error was 42703 on that
     * one column rather than on the whole idea of a timestamp.
     */
    expect(COLUMNS).toContain('permissions');
    expect(COLUMNS).toContain('created_at');
    expect(COLUMNS).not.toContain('updated_at');
  });

  it('the UPDATE sets only real columns', () => {
    const at = SQL.indexOf('UPDATE roles AS r');
    expect(at).toBeGreaterThan(-1);
    const setClause = SQL.slice(at, SQL.indexOf('FROM (VALUES', at));
    const assigned = [...setClause.matchAll(/(?:SET|,)\s*([a-z_]+)\s*=/g)].map((m) => m[1]);
    expect(assigned.length).toBeGreaterThan(0);
    expect(assigned.filter((c) => !COLUMNS.includes(c))).toEqual([]);
  });

  it('keeps the permissions fill, which is its substance', () => {
    expect(SQL).toMatch(/SET permissions = v\.permissions/);
  });
});

describe('the guard that stops this recurring', () => {
  it('is wired into CI as well as package.json', () => {
    // PA-032 verified db:migrate at 43 migrations and nothing re-checked for
    // 29 more. Being runnable is not being run (CR-023, round 86).
    expect(read('.github/workflows/ci.yml')).toContain('npm run check:migration-enums');
    expect(JSON.parse(read('package.json')).scripts['check:migration-enums']).toBe(
      'node scripts/check-migration-enum-values.mjs',
    );
  });

  it('refuses to pass when it parses too little to be real', () => {
    // A floor, because a parser that stops matching would otherwise report a
    // clean chain - the vacuous pass this session has now found three times.
    const src = read('scripts/check-migration-enum-values.mjs');
    expect(src).toMatch(/enums\.size < 10 \|\| enumColumns\.size < 10/);
    expect(src).toMatch(/Not a pass/);
  });

  it('accumulates ALTER TYPE ... ADD VALUE, proven by calling it', () => {
    /**
     * A source-level assertion here SURVIVED a mutant that gutted the
     * accumulation loop, because the regex constant it matched was still in
     * the file - and the real chain happens to add `consent_type.recording`
     * without any migration inserting it, so the branch is correct and
     * unexercised. Reading source proves the text is there; only calling it
     * proves the value comes out.
     */
    const chain = [
      {
        rel: 'a.sql',
        // Formatted exactly as drizzle emits: tab-indented columns and the
        // closing paren at column 0. A first cut indented it, the CREATE TABLE
        // pattern did not match, no enum COLUMN was tracked, and the
        // accept-case then passed for the wrong reason - caught only by the
        // reject-case below, which is why both halves are here.
        sql: [
          `CREATE TYPE "public"."mood" AS ENUM('calm');`,
          `CREATE TABLE "pets" (`,
          `\t"id" varchar,`,
          `\t"mood" "mood"`,
          `);`,
        ].join('\n'),
      },
      { rel: 'b.sql', sql: `ALTER TYPE "public"."mood" ADD VALUE IF NOT EXISTS 'feral';` },
      { rel: 'c.sql', sql: `INSERT INTO pets (id, mood) VALUES ('p1', 'feral');` },
    ];
    expect(analyzeChain(chain).findings).toEqual([]);

    // And the same insert BEFORE the value exists is a finding, so the
    // assertion above is about ordering rather than about nothing.
    const early = [chain[0], { rel: 'c.sql', sql: chain[2].sql }];
    expect(analyzeChain(early).findings).toEqual([
      { file: 'c.sql', table: 'pets', column: 'mood', type: 'mood', value: 'feral' },
    ]);
  });
});
