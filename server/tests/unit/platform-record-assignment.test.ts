/**
 * The bulk-assign button existed on neither host, the PATCH beside it wrote a
 * phantom column, and the assignment history had no writer (round 130).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_BULK_ASSIGN,
  buildBulkAssignPlan,
  type AssignableRecord,
} from '@shared/platform-record-assignment';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/(?<![:/])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

const EDGE = read('supabase/functions/platform-crm/index.ts');
const EDGE_CODE = stripComments(EDGE);
const PAGE_CODE = stripComments(read('client/src/pages/PlatformBusinessRecords.tsx'));
const MIGRATION = read('drizzle/migrations/0000_fuzzy_blizzard.sql');
const SCHEMA = read('shared/platform-crm-schema.ts');

const found = (rows: [string, string | null][]): AssignableRecord[] =>
  rows.map(([id, rep]) => ({ id, assigned_sales_rep: rep }));

const plan = (recordIds: unknown, assignedRep: unknown, rows: AssignableRecord[] = []) =>
  buildBulkAssignPlan({
    recordIds,
    assignedRep,
    found: rows,
    actorId: 'admin-1',
    now: new Date('2026-09-21T12:00:00Z'),
  });

/** Every column `platform_business_records` really has, from the chain. */
const RECORD_COLUMNS: Set<string> = (() => {
  const at = MIGRATION.indexOf('CREATE TABLE "platform_business_records" (');
  const body = MIGRATION.slice(at, MIGRATION.indexOf('\n);', at));
  return new Set([...body.matchAll(/^\t"([a-z0-9_]+)"/gm)].map((m) => m[1]));
})();

/** The literals inside one named list in the edge function. */
function listNames(open: string, close: string): string[] {
  const at = EDGE_CODE.indexOf(open);
  expect({ list: open, found: at > -1 }).toEqual({ list: open, found: true });
  const body = EDGE_CODE.slice(at + open.length, EDGE_CODE.indexOf(close, at));
  return [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
}

describe('the columns these lists name are columns that exist', () => {
  it('the table really has the five replacements, and none of the originals', () => {
    // Checked against the chain, not the declaration (round 88) - though here
    // the two agree. The index is NAMED
    // platform_business_records_assigned_rep_idx and sits on assignedSalesRep,
    // which is where one of the wrong names came from.
    expect(RECORD_COLUMNS.size).toBeGreaterThan(40);
    for (const real of [
      'primary_contact_phone',
      'annual_revenue',
      'address_line1',
      'assigned_sales_rep',
      'last_contact_date',
    ]) {
      expect({ real, exists: RECORD_COLUMNS.has(real) }).toEqual({ real, exists: true });
    }
    for (const phantom of [
      'phone',
      'estimated_revenue',
      'address',
      'assigned_rep',
      'last_activity_date',
    ]) {
      expect({ phantom, exists: RECORD_COLUMNS.has(phantom) }).toEqual({ phantom, exists: false });
    }
    expect(SCHEMA).toMatch(/assignedSalesRep: varchar\('assigned_sales_rep'\)/);
  });

  it('the export select names only real columns - it is handed to .select()', () => {
    // EXPORT_COLUMNS.join(',') goes straight into PostgREST, and an unknown
    // column fails the WHOLE statement, so the CSV button was a 42703 on every
    // request since it shipped.
    const names = listNames('const EXPORT_COLUMNS = [', '] as const;');
    expect(names.length).toBeGreaterThan(15);
    expect(names.filter((n) => !RECORD_COLUMNS.has(n))).toEqual([]);
  });

  it('the write whitelist names only real columns', () => {
    const names = listNames('const BUSINESS_RECORD_COLUMNS = new Set([', '\n]);');
    expect(names.length).toBeGreaterThan(15);
    expect(names.filter((n) => !RECORD_COLUMNS.has(n))).toEqual([]);
  });

  it('every exported column still has a heading, so the CSV is readable', () => {
    const cols = listNames('const EXPORT_COLUMNS = [', '] as const;');
    const at = EDGE_CODE.indexOf('const EXPORT_HEADERS');
    const headers = EDGE_CODE.slice(at, EDGE_CODE.indexOf('\n};', at));
    const keys = new Set([...headers.matchAll(/^\s{2}([a-z0-9_]+):/gm)].map((m) => m[1]));
    expect(cols.filter((c) => !keys.has(c))).toEqual([]);
    expect([...keys].filter((k) => !RECORD_COLUMNS.has(k))).toEqual([]);
  });

  it('and the old spellings still map onto their column, rather than being dropped', () => {
    // None of the five camel-to-snakes onto its column, so a plain toSnake
    // loses them in silence (COP-M01's four-fields rule). A client that has
    // not been redeployed still lands its field.
    for (const [sent, column] of [
      ['assignedRep', 'assigned_sales_rep'],
      ['phone', 'primary_contact_phone'],
      ['estimatedRevenue', 'annual_revenue'],
      ['address', 'address_line1'],
      ['lastActivityDate', 'last_contact_date'],
    ]) {
      expect({ sent, mapped: EDGE_CODE.includes(`${sent}: '${column}'`) }).toEqual({
        sent,
        mapped: true,
      });
    }
    expect(EDGE_CODE).toMatch(/RECORD_FIELD_ALIASES\[k\] \?\?/);
  });

  it('the pages read the real names, rather than keys nothing emits', () => {
    // camelRow camelises the RAW row, so a page reading `assignedRep` gets
    // undefined for every record - "Unassigned" about an assigned account.
    const DETAIL = stripComments(read('client/src/pages/PlatformBusinessRecordDetail.tsx'));
    for (const dead of [
      'record.assignedRep',
      'record.lastActivityDate',
      'record.estimatedRevenue',
      'record.phone',
    ]) {
      expect({ dead, present: DETAIL.includes(dead) }).toEqual({ dead, present: false });
    }
    expect(DETAIL).toContain('record.assignedSalesRep');
    expect(DETAIL).toContain('record.lastContactDate');
    expect(DETAIL).toContain('record.annualRevenue');
    expect(DETAIL).toContain('record.primaryContactPhone');
  });
});

describe('the engagement signal the health score reads has a writer', () => {
  // platform-cs read `last_engagement_date`, which nothing in the tree writes.
  // The `: 999` branch therefore fired for every tenant, costing all of them
  // the same 20 points, and the churn model's dormancy term never fired.
  const CS = stripComments(read('supabase/functions/platform-cs/index.ts'));
  const ACTIVITIES = stripComments(read('supabase/functions/platform-activities/index.ts'));

  it('the one writer of the table stamps last_contact_date', () => {
    expect(ACTIVITIES).toMatch(/last_contact_date: new Date\(\)\.toISOString\(\)/);
    expect(ACTIVITIES).not.toMatch(/last_engagement_date:/);
  });

  it('and both read sites go through one resolver that prefers it', () => {
    expect(CS).toContain('function lastActivityAt(');
    expect(CS).toMatch(/row\.last_contact_date, row\.last_engagement_date/);
    // Bound to the reads, not to a count: the bare column must not survive at
    // either site.
    expect(CS).not.toMatch(/new Date\(br\.last_engagement_date\)/);
    expect(CS.match(/lastActivityAt\(br\)/g) ?? []).toHaveLength(2);
  });
});

describe('the plan counts what happened', () => {
  it('assigns the records that change', () => {
    const result = plan(
      ['a', 'b'],
      'rep-9',
      found([
        ['a', null],
        ['b', 'rep-1'],
      ]),
    );
    expect(result.error).toBeUndefined();
    expect(result.changedIds.sort()).toEqual(['a', 'b']);
    expect(result.unchangedIds).toEqual([]);
  });

  it('a record already held by that rep is unchanged, not rewritten', () => {
    const result = plan(
      ['a', 'b'],
      'rep-9',
      found([
        ['a', 'rep-9'],
        ['b', 'rep-1'],
      ]),
    );
    expect(result.changedIds).toEqual(['b']);
    expect(result.unchangedIds).toEqual(['a']);
    // And it leaves no history row saying nothing moved.
    expect(result.history.map((h) => h.business_record_id)).toEqual(['b']);
  });

  it('an id that matches nothing is reported, not absorbed', () => {
    // A stale selection and an already-assigned record are different answers.
    const result = plan(['a', 'ghost'], 'rep-9', found([['a', null]]));
    expect(result.missingIds).toEqual(['ghost']);
    expect(result.unchangedIds).toEqual([]);
    expect(result.changedIds).toEqual(['a']);
  });

  it('duplicate ids are collapsed', () => {
    const result = plan(['a', 'a', 'a'], 'rep-9', found([['a', null]]));
    expect(result.changedIds).toEqual(['a']);
    expect(result.history).toHaveLength(1);
  });
});

describe('the history is the trail nothing used to write', () => {
  it('records who held it, including nobody', () => {
    const result = plan(
      ['a', 'b'],
      'rep-9',
      found([
        ['a', null],
        ['b', 'rep-1'],
      ]),
    );
    const byId = new Map(result.history.map((h) => [h.business_record_id, h]));
    // Null, not a sentinel: "was unassigned" and "we did not look" must not
    // read the same.
    expect(byId.get('a')!.assigned_from).toBeNull();
    expect(byId.get('b')!.assigned_from).toBe('rep-1');
    for (const row of result.history) {
      expect(row.assigned_to).toBe('rep-9');
      expect(row.assigned_by).toBe('admin-1');
      expect(row.assignment_reason).toBe('manual');
      expect(row.assigned_at).toBe('2026-09-21T12:00:00.000Z');
    }
  });

  it('an unnamed actor stays null, never a plausible name', () => {
    // `assigned_by` is nullable, so "we do not know who did this" is
    // representable - and writing 'system' would put a name in the one column
    // a reassignment dispute reads, for an actor nobody can check.
    const result = buildBulkAssignPlan({
      recordIds: ['a'],
      assignedRep: 'rep-9',
      found: found([['a', null]]),
      now: new Date('2026-09-21T12:00:00Z'),
    });
    expect(result.history[0].assigned_by).toBeNull();
  });

  it('supplies every NOT NULL column the table declares', () => {
    // Derived from the migration, so a column added later fails here.
    const at = MIGRATION.indexOf('CREATE TABLE "platform_lead_assignment_history" (');
    expect(at).toBeGreaterThan(-1);
    const body = MIGRATION.slice(at, MIGRATION.indexOf('\n);', at));
    const required = [...body.matchAll(/^\t"([a-z_]+)"([^,\n]*)/gm)]
      .filter((m) => /NOT NULL/.test(m[2]) && !/DEFAULT/.test(m[2]))
      .map((m) => m[1]);
    expect(required.length).toBeGreaterThan(1);
    const row = plan(['a'], 'rep-9', found([['a', null]])).history[0] as Record<string, unknown>;
    for (const column of required) {
      expect({ column, supplied: column in row }).toEqual({ column, supplied: true });
    }
  });

  it('and every key it writes is a real column', () => {
    const at = MIGRATION.indexOf('CREATE TABLE "platform_lead_assignment_history" (');
    const body = MIGRATION.slice(at, MIGRATION.indexOf('\n);', at));
    const columns = new Set([...body.matchAll(/^\t"([a-z_]+)"/gm)].map((m) => m[1]));
    const row = plan(['a'], 'rep-9', found([['a', null]])).history[0] as Record<string, unknown>;
    for (const key of Object.keys(row)) {
      expect({ key, real: columns.has(key) }).toEqual({ key, real: true });
    }
  });

  it('nothing else in the tree writes that table, which is why this is new', () => {
    // If a second writer appears, the "no trail" premise needs re-reading.
    const others = [
      'supabase/functions/platform-crm/index.ts',
      'shared/platform-record-assignment.ts',
    ];
    expect(others.every((f) => read(f).includes('platform_lead_assignment_history'))).toBe(true);
  });
});

describe('a malformed request is refused, never truncated', () => {
  it('needs a rep', () => {
    expect(plan(['a'], '').error).toMatch(/assignedRep/);
    expect(plan(['a'], '   ').error).toMatch(/assignedRep/);
    expect(plan(['a'], undefined).error).toMatch(/assignedRep/);
  });

  it('needs at least one id', () => {
    expect(plan([], 'rep-9').error).toMatch(/at least one/);
    expect(plan(['', '  '], 'rep-9').error).toMatch(/at least one/);
    expect(plan('not-an-array', 'rep-9').error).toMatch(/must be an array/);
  });

  it('refuses more than the cap rather than assigning some of them', () => {
    const ids = Array.from({ length: MAX_BULK_ASSIGN + 1 }, (_, i) => `id-${i}`);
    const result = plan(ids, 'rep-9');
    expect(result.error).toMatch(new RegExp(String(MAX_BULK_ASSIGN)));
    expect(result.changedIds).toEqual([]);
    // Exactly at the cap is fine.
    expect(plan(ids.slice(0, MAX_BULK_ASSIGN), 'rep-9').error).toBeUndefined();
  });
});

describe('the branch is wired, above the id routes', () => {
  it('it exists and matches the path the page posts', () => {
    expect(EDGE_CODE).toMatch(/resourceId === 'bulk' &&\s*parts\[2\] === 'assign'/);
    expect(PAGE_CODE).toMatch(/'\/api\/platform-crm\/business-records\/bulk\/assign'/);
  });

  it('above the /:id branches, or `bulk` is read as a record id', () => {
    const bulk = EDGE_CODE.indexOf("resourceId === 'bulk'");
    const byId = EDGE_CODE.indexOf("endpoint === 'business-records' && resourceId && !parts[2]");
    expect(bulk).toBeGreaterThan(-1);
    expect(byId).toBeGreaterThan(-1);
    expect(bulk).toBeLessThan(byId);
  });

  it('reads current owners before deciding, so assigned_from is real', () => {
    const at = EDGE_CODE.indexOf("resourceId === 'bulk'");
    const body = EDGE_CODE.slice(at, EDGE_CODE.indexOf('business-records/:id', at));
    const readAt = body.indexOf("select('id, assigned_sales_rep')");
    const planAt = body.indexOf('buildBulkAssignPlan(');
    expect({ read: readAt > -1 }).toEqual({ read: true });
    expect({ order: readAt < planAt }).toEqual({ order: true });
  });

  it('updates only the records that change', () => {
    const at = EDGE_CODE.indexOf("resourceId === 'bulk'");
    const body = EDGE_CODE.slice(at, EDGE_CODE.indexOf('business-records/:id', at));
    expect(body).toMatch(/\.in\('id', plan\.changedIds\)/);
    expect(body).toMatch(/assigned_sales_rep:/);
    expect(body).not.toMatch(/assigned_rep:/);
  });

  it('and writes the history it just made possible', () => {
    const at = EDGE_CODE.indexOf("resourceId === 'bulk'");
    const body = EDGE_CODE.slice(at, EDGE_CODE.indexOf('business-records/:id', at));
    expect(body).toMatch(/from\('platform_lead_assignment_history'\)\s*\.insert\(plan\.history\)/);
    // A failed history write is reported, not swallowed and not rolled back.
    expect(body).toMatch(/historyRecorded: false/);
    expect(body).toMatch(/warning:/);
  });
});

describe('the button is reachable, not a disabled placeholder', () => {
  // PA-047 disabled it honestly because nothing served the endpoint. Now that
  // something does, a mutation nobody can fire is the dead-state shape eslint
  // only reports as "assigned a value but never used".
  it('the Assign control fires the mutation', () => {
    expect(PAGE_CODE).toMatch(/bulkAssignMutation\.mutate\(\{/);
    expect(PAGE_CODE).not.toMatch(/title="Bulk assign is not available yet"/);
  });

  it('offers platform users rather than a free-text id', () => {
    // `assigned_sales_rep` holds a USER ID, so a typed value would store an id
    // nobody can verify. /managers is the endpoint the territory and rule
    // pages already pick from.
    expect(PAGE_CODE).toMatch(/'\/api\/platform-crm\/managers'/);
    expect(EDGE_CODE).toMatch(/endpoint === 'managers'/);
    expect(PAGE_CODE).toMatch(/disabled=\{!assignTo \|\| bulkAssignMutation\.isPending\}/);
  });

  it('keeps whatever did not move selected', () => {
    // Round 78: a retry must not mean finding those records again.
    expect(PAGE_CODE).toMatch(/setSelectedRecords\(new Set\(result\.missing\)\)/);
  });

  it('and reports a failure instead of swallowing it', () => {
    const at = PAGE_CODE.indexOf('const bulkAssignMutation');
    const body = PAGE_CODE.slice(at, PAGE_CODE.indexOf('const records =', at));
    expect(body).toMatch(/onError:/);
    expect(body).toMatch(/variant: 'destructive'/);
  });
});

describe('the page reports what moved', () => {
  it('through apiRequest, not a bare fetch', () => {
    expect(PAGE_CODE).not.toMatch(/fetch\('\/api\/platform-crm/);
    expect(PAGE_CODE).toMatch(/apiRequest<\{ assigned: number/);
  });

  it('and names the counts instead of claiming success', () => {
    // "Records assigned successfully" over a count of attempts is round 78's
    // shape; the server already knows the difference.
    expect(PAGE_CODE).not.toMatch(/Records assigned successfully/);
    expect(PAGE_CODE).toMatch(/result\.assigned/);
    expect(PAGE_CODE).toMatch(/result\.unchanged/);
    expect(PAGE_CODE).toMatch(/result\.missing/);
    expect(PAGE_CODE).toMatch(/Nothing to assign/);
  });
});
