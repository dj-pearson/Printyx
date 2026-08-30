/**
 * Sixteen mobile handlers queried eight tables that do not exist (CR-017).
 *
 * routes-workflow-mobile.ts served /api/mobile and /api/mobile-field from raw
 * SQL strings naming mobile_work_orders, mobile_field_orders,
 * mobile_parts_inventory, mobile_order_line_items, mobile_app_sessions,
 * field_technicians, field_work_orders and voice_notes - none of them in any
 * Drizzle schema or migration. Every one was a permanent 500 in dev, and
 * production never ran them: getApiUrl sends both prefixes to the edge
 * functions of those names, which serve a disjoint set of paths.
 *
 * Eight of the sixteen had no caller in any of the seven client trees. The rest
 * back MobileOptimization.tsx and MobileFieldOperations.tsx, which have
 * therefore never loaded - and rebuilding those pages is AUDIT-033, a decision
 * about what they are for, not a port.
 *
 * TWO THINGS WORTH KEEPING VISIBLE. POST /api/mobile/sync was not a sync: it
 * INSERTed a fabricated GPS position per technician - 40.7128 + Math.random() *
 * 0.1, a point in New York, with a random 80-100% battery - into
 * technician_locations, a REAL table, and answered "Mobile data sync completed".
 * And GET /api/mobile-field/metrics ended with `SELECT 95.5 as gps_accuracy`,
 * commented "Mock GPS accuracy metric".
 *
 * The durable half of this story is scripts/check-sql-string-tables.mjs, which
 * is what would have caught any of it. Comments are stripped before matching -
 * the notes left in place of these handlers name every table they used.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const PHANTOM = [
  'mobile_work_orders',
  'mobile_field_orders',
  'mobile_parts_inventory',
  'mobile_order_line_items',
  'mobile_app_sessions',
  'field_technicians',
  'field_work_orders',
  'voice_notes',
];

const workflowMobile = read('server/routes-workflow-mobile.ts');
const opsExtended = read('server/routes-operations-extended.ts');

describe('the handlers that could never work are gone', () => {
  it.each(PHANTOM)('no longer queries %s', (table) => {
    expect(workflowMobile).not.toContain(table);
  });

  it.each([
    '/api/mobile/metrics',
    '/api/mobile/work-orders',
    '/api/mobile/parts-inventory',
    '/api/mobile/field-orders',
    '/api/mobile/technician-locations',
    '/api/mobile/app-sessions',
    '/api/mobile/sync',
    '/api/mobile-field/metrics',
    '/api/mobile-field/technicians',
    '/api/mobile-field/work-orders',
    '/api/mobile-field/voice-notes',
  ])('leaves no handler on %s', (path) => {
    expect(workflowMobile).not.toContain(`'${path}'`);
  });

  it('stops writing invented GPS positions into technician_locations', () => {
    // The insert looped over technicians and gave each a point near 40.7128,
    // -74.006 with a random battery level, then reported a completed sync.
    // Scoped to the write: the /api/mobile/dashboard FIXTURE still carries those
    // same coordinates, which is AUDIT-033's half of this and not a table.
    expect(workflowMobile).not.toContain('technician_locations');
    expect(workflowMobile).not.toContain('Math.random()');
  });

  it('stops reporting a hardcoded GPS accuracy', () => {
    expect(workflowMobile).not.toContain('gps_accuracy');
    expect(workflowMobile).not.toContain('95.5');
  });

  it('keeps the handlers that read real tables', () => {
    // /api/mobile/dashboard and /route-optimization are fixtures rather than
    // phantom-table queries, and belong to AUDIT-033; the four /api/tenants and
    // five /api/customers/:id/* handlers are real and called.
    expect(workflowMobile).toContain("'/api/mobile/dashboard'");
    expect(workflowMobile).toContain("'/api/customers/:id/equipment'");
  });
});

describe('both CR-017 routers are clean', () => {
  it.each(['server/routes-workflow-mobile.ts', 'server/routes-operations-extended.ts'])(
    '%s names no undeclared relation',
    (file) => {
      const source = file.includes('workflow') ? workflowMobile : opsExtended;
      for (const table of [
        ...PHANTOM,
        'commission_payments',
        'sales_representatives',
        'iot_devices',
      ]) {
        expect(source).not.toContain(table);
      }
    },
  );
});

describe('the guard that would have caught this', () => {
  it('exists, is wired into CI, and passes', () => {
    expect(existsSync(join(repo, 'scripts/check-sql-string-tables.mjs'))).toBe(true);
    expect(readFileSync(join(repo, '.github/workflows/ci.yml'), 'utf8')).toContain(
      'check:sql-string-tables',
    );
    // Exit code, not output: a guard that prints a tick and exits 1 is the
    // failure mode this repo has hit before.
    execFileSync('node', [join(repo, 'scripts/check-sql-string-tables.mjs')], { cwd: repo });
  });

  it('reads only strings that are SQL, not English prose', () => {
    // A first cut matched FROM/UPDATE anywhere in a file and reported 515
    // references, nearly all of them sentences like "update the baseline".
    const guard = readFileSync(join(repo, 'scripts/check-sql-string-tables.mjs'), 'utf8');
    expect(guard).toContain('function isSql');
    expect(guard).toContain('function stringLiterals');
  });

  it('does not read EXTRACT(field FROM column) as a table reference', () => {
    // The trap is which side the name is on: EXTRACT(MONTH FROM payment_date)
    // puts the COLUMN after FROM, so listing date-part words as non-relations
    // reads it backwards and reports payment_date as a missing table.
    const guard = readFileSync(join(repo, 'scripts/check-sql-string-tables.mjs'), 'utf8');
    expect(guard).toContain('function withoutExtract');
  });

  it('excludes CTE names declared anywhere in the file', () => {
    // These queries interpolate, so `WITH quota_data AS (...) ${filter}` and
    // `FROM quota_data` land in different template literals.
    const guard = readFileSync(join(repo, 'scripts/check-sql-string-tables.mjs'), 'utf8');
    expect(guard).toContain('fileLocals');
  });
});
