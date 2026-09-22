/**
 * COP-B01 AC5 / COP-I01 AC1: the benchmark covers the workspace it is quoted
 * about, and it can actually run.
 *
 * TWO PROPERTIES, and the second one is why this test exists at all.
 *
 * COVERAGE: `npm run bench:crm` is the only thing in this repo that answers
 * "is the CRM fast enough", and its numbers get quoted in CLAUDE.md. A query
 * shape it does not time is a shape nobody has measured, so the My Day
 * workspace's six reads are asserted present by name.
 *
 * IT MUST BE ABLE TO INSERT. `deals.created_by_id` is NOT NULL and the seed
 * omitted it, so the script died on its first statement against a faithfully
 * migrated database - proven, not inferred, by replaying the chain into a
 * scratch Postgres 16 and running it. A benchmark that cannot run is the
 * performance equivalent of a guard that passes vacuously, and this one had
 * already been cited as evidence. Every NOT NULL column with no default on
 * the tables it seeds must appear in its INSERT.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { deals, businessRecordActivities, companies } from '../../../shared/schema';

const root = path.resolve(__dirname, '../../..');
const bench = readFileSync(path.join(root, 'scripts/bench-crm-lists.mjs'), 'utf-8');

/** The INSERT statement this script issues for one table. */
function seedStatement(table: string): string {
  // The column list can start on the next line, so the table name is matched
  // against any whitespace rather than a single space.
  const match = new RegExp(`INSERT INTO ${table}\\s`).exec(bench);
  expect(match, `no INSERT INTO ${table} in the benchmark`).not.toBeNull();
  const at = match!.index;
  const end = bench.indexOf('FROM generate_series', at);
  return bench.slice(at, end > at ? end : at + 900);
}

/** Columns a row MUST carry: not null, no default, not generated. */
function requiredColumns(table: ReturnType<typeof getTableConfig>): string[] {
  return table.columns
    .filter((c) => c.notNull && !c.hasDefault)
    .map((c) => c.name)
    .filter((name) => name !== 'id');
}

describe('bench:crm seeds every column the schema demands', () => {
  it.each([
    ['deals', deals],
    ['companies', companies],
    ['business_record_activities', businessRecordActivities],
  ])('%s', (name, table) => {
    const stmt = seedStatement(name);
    for (const column of requiredColumns(getTableConfig(table as never))) {
      expect(stmt, `${name}.${column} is NOT NULL with no default and is not seeded`).toContain(
        column,
      );
    }
  });

  it('knows deals.created_by_id is one of them, which is the column that broke it', () => {
    // Pinned by name because this is the regression, and a derived check that
    // silently stopped deriving would look identical to a passing one.
    expect(requiredColumns(getTableConfig(deals as never))).toContain('created_by_id');
  });
});

describe('bench:crm times the My Day workspace', () => {
  const shapes = [
    'my-day overdue activities',
    'my-day due today',
    'my-day stalled deals',
    'my-day recent wins',
    'my-day team pipeline',
    'my-day team activity',
  ];

  it.each(shapes)('covers %s', (shape) => {
    expect(bench).toContain(shape);
  });

  it('and still covers the list and board shapes COP-I01 added', () => {
    for (const shape of ['accounts list (page 1', 'deals board by stage', 'forecast by close date'])
      expect(bench).toContain(shape);
  });

  it('states what it does not measure, so a green run is not quoted as end-to-end', () => {
    expect(bench).toContain('NOT MEASURED');
    expect(bench).toContain('not sufficient');
  });

  it('refuses to run without an explicit database URL', () => {
    // It seeds and deletes; falling back to DATABASE_URL would point it at
    // whatever the developer had configured, which may be production.
    expect(bench).toContain('BENCH_DATABASE_URL');
    expect(bench).not.toContain('process.env.DATABASE_URL');
  });
});
