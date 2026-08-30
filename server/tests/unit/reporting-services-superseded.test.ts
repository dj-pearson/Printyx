/**
 * Ten reporting services, 5,839 lines, that nothing called.
 *
 * check:sql-string-tables (added the same day) reported twelve live-service
 * references to relations that do not exist: activities, quotas, sales_quotas,
 * parts_usage and ai_tasks, across five files in server/services. Tracing them
 * turned up something larger than the tables - NOTHING IMPORTED ANY OF THEM.
 * Eight of the ten had no importer at all outside one test, and
 * supabase/functions/reports/ says why in its own handler headers: "Replaces
 * server/routes/<x>-reports-api.ts + server/services/<x>-reporting-service.ts".
 * The Express routers went; their service layer did not.
 *
 * The live implementation is also demonstrably better. Its _queries/ modules
 * build every statement through PostgREST's builder rather than raw SQL, so
 * there is no interpolation to audit, and its headers record the same
 * unbacked-table findings honestly ("sales_quotas table does NOT exist ->
 * personal quota report is degraded") instead of querying them.
 *
 * TWO SURVIVE, deliberately: warehouse and service-supervisor, because
 * server/services/team-alert-service.ts calls their getTeamQuickStats. That
 * service is itself unreachable - nothing imports it either - and is annotated
 * rather than deleted, per PROD-008c's rule that retiring complete work nobody
 * wired is a decision for a human.
 *
 * Comments are stripped where a file is matched, since the notes left behind
 * name every deleted file.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));
const has = (p: string) => existsSync(join(repo, p));

const DELETED = [
  'director',
  'executive',
  'sales',
  'sales-manager',
  'sales-supervisor',
  'service',
  'service-manager',
  'team',
];
const KEPT = ['warehouse', 'service-supervisor'];

describe('the superseded services are gone', () => {
  it.each(DELETED)('deletes %s-reporting-service.ts', (name) => {
    expect(has(`server/services/${name}-reporting-service.ts`)).toBe(false);
  });

  it('leaves no importer of a deleted service', () => {
    const test = read('server/tests/unit/sql-injection-prevention.test.ts');
    for (const name of DELETED) {
      expect(test).not.toContain(`${name}-reporting-service`);
    }
  });

  it('keeps the two team-alert-service depends on', () => {
    for (const name of KEPT) {
      expect(has(`server/services/${name}-reporting-service.ts`)).toBe(true);
    }
    const alerts = read('server/services/team-alert-service.ts');
    expect(alerts).toContain('WarehouseReportingService');
    expect(alerts).toContain('ServiceSupervisorReportingService');
  });

  it('records that the surviving cluster is unreachable rather than leaving it silent', () => {
    // Raw, not comment-stripped: the annotation IS the artifact here.
    for (const file of [
      'server/services/team-alert-service.ts',
      'server/services/warehouse-reporting-service.ts',
      'server/services/service-supervisor-reporting-service.ts',
    ]) {
      expect(readFileSync(join(repo, file), 'utf8')).toContain('UNREACHABLE');
    }
  });
});

describe('the live implementation is the one that survived', () => {
  it('names each deleted service as its predecessor', () => {
    // Raw: these are header comments, which is exactly what is being asserted.
    const headers = ['director', 'executive', 'sales', 'service', 'warehouse']
      .map((p) => readFileSync(join(repo, `supabase/functions/reports/_queries/${p}.ts`), 'utf8'))
      .join('\n');
    for (const name of ['director', 'sales', 'service', 'warehouse', 'executive']) {
      expect(headers).toContain(`server/services/${name}-reporting-service.ts`);
    }
  });

  it('builds its queries without raw SQL, so there is no interpolation to audit', () => {
    for (const p of ['sales', 'service', 'director', 'executive', 'warehouse', 'scoped']) {
      const source = read(`supabase/functions/reports/_queries/${p}.ts`);
      expect(source).not.toContain('sql.raw');
      expect(source).not.toMatch(/ARRAY\s*\[/);
    }
  });
});

describe('performance-monitor no longer invents slow queries', () => {
  const monitor = read('server/services/performance-monitor.ts');

  it('returns no hand-written query rows', () => {
    // A 1250ms query against ai_tasks - a table that exists nowhere - and an
    // 890ms one against calendar_events, in a function whose siblings had
    // already been corrected to answer null rather than guess.
    expect(monitor).not.toContain('ai_tasks');
    expect(monitor).not.toContain('1250');
    expect(monitor).not.toContain('890');
  });

  it('reports the count that IS measured', () => {
    // db-logger counts queries over its threshold without retaining them, so
    // the count is real even though the list is empty.
    expect(monitor).toContain('slowQueryCount');
    expect(monitor).toContain('getQueryStats()');
  });

  it('keeps the recommendation branch reading a real list', () => {
    // getDatabasePerformance's caller branches on slowQueries.length > 5, so the
    // invented rows fed a recommendation as well as a metric.
    expect(monitor).toMatch(/slowQueries\.length > 5/);
  });
});
