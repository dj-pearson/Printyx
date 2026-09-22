/**
 * COP-B09 AC6: "Territory changes reassign cleanly without orphaning records,
 * and the change is auditable."
 *
 * The first half held by construction and the story's own notes said so. The
 * second was absent - create, update and delete all wrote with no record of any
 * of it - and the reason it matters is the reason the first half holds:
 * membership is resolved AT READ TIME by matching a territory's name or code
 * against business_records.territory, so a rename takes effect instantly and
 * silently across every account naming it.
 *
 * Two defects the wiring exposed, both in branches that reported success:
 * PUT and DELETE never read the row, so nothing could be diffed; and DELETE
 * answered "Territory deleted" for an id that was never there, because
 * PostgREST's delete matches nothing and returns no error.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  territoryChange,
  territorySnapshot,
  AUDITED_TERRITORY_FIELDS,
  MATCH_KEY_FIELDS,
  OWNERSHIP_FIELDS,
} from '../../../shared/territory-audit';
import { writeAuditLog } from '../../../supabase/functions/_shared/audit-log';
import { auditLogs } from '../../../shared/drizzle-schema';

const ROOT = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const FN = read('supabase/functions/sales-territories/index.ts');
const AUDIT = read('supabase/functions/_shared/audit-log.ts');

const territory = (over: Record<string, unknown> = {}) => ({
  id: 't-1',
  territory_name: 'North',
  territory_code: 'N',
  territory_type: 'geographic',
  description: 'Northern accounts',
  is_active: true,
  owner_id: 'u-1',
  manager_id: 'u-9',
  team_members: ['u-2'],
  monthly_quota: '5000.00',
  ...over,
});

describe('a territory change says what it moved', () => {
  it('reports only the fields the patch carried', () => {
    // A PATCH omitting a field has not changed it. Reporting every column as a
    // change to null is the blanket-object defect one table over.
    const c = territoryChange(territory(), { description: 'Northern region' });
    expect(Object.keys(c.changed)).toEqual(['description']);
    expect(c.changed.description).toEqual({ from: 'Northern accounts', to: 'Northern region' });
  });

  it('marks a RENAME as reassigning, because matching is read-time', () => {
    const c = territoryChange(territory(), { territory_name: 'North Region' });
    expect(c.matchKeysChanged).toEqual(['territory_name']);
    expect(c.reassigns).toBe(true);
  });

  it('marks a CODE change as reassigning too', () => {
    const c = territoryChange(territory(), { territory_code: 'NR' });
    expect(c.matchKeysChanged).toEqual(['territory_code']);
    expect(c.reassigns).toBe(true);
  });

  it("marks an owner or team change as moving a rep's book", () => {
    expect(territoryChange(territory(), { owner_id: 'u-7' }).ownershipChanged).toEqual([
      'owner_id',
    ]);
    expect(territoryChange(territory(), { team_members: ['u-3'] }).ownershipChanged).toEqual([
      'team_members',
    ]);
    expect(territoryChange(territory(), { owner_id: 'u-7' }).reassigns).toBe(true);
  });

  it('does NOT treat manager_id as ownership', () => {
    // manager_id is who the territory REPORTS TO. Conflating it with owner_id
    // is the defect COP-B09 AC3 records: a manager over four territories would
    // otherwise read those four as their own book.
    const c = territoryChange(territory(), { manager_id: 'u-8' });
    expect(c.changed.manager_id).toBeTruthy();
    expect(c.ownershipChanged).toEqual([]);
    expect(c.reassigns).toBe(false);
  });

  it('does not call a description edit a reassignment', () => {
    expect(territoryChange(territory(), { description: 'x' }).reassigns).toBe(false);
  });

  it('is not fooled by numeric text: PostgREST returns numeric as a STRING', () => {
    // monthly_quota comes back as "5000.00"; a caller sending 5000 has changed
    // nothing, and logging it as a quota change would send an auditor looking
    // for a decision nobody made.
    expect(territoryChange(territory(), { monthly_quota: 5000 }).changed).toEqual({});
    expect(territoryChange(territory(), { monthly_quota: 6000 }).changed.monthly_quota).toEqual({
      from: '5000.00',
      to: 6000,
    });
  });

  it('treats null and undefined as the same "not set"', () => {
    const t = territory({ territory_code: null });
    expect(territoryChange(t, { territory_code: null }).changed).toEqual({});
  });

  it('compares jsonb by value, not by reference', () => {
    expect(territoryChange(territory(), { team_members: ['u-2'] }).changed).toEqual({});
    expect(territoryChange(territory(), { team_members: ['u-2', 'u-3'] }).ownershipChanged).toEqual(
      ['team_members'],
    );
  });

  it('survives a missing before-row rather than throwing', () => {
    const c = territoryChange(null, { territory_name: 'New' });
    expect(c.changed.territory_name).toEqual({ from: null, to: 'New' });
  });

  it('snapshots exactly the audited fields, and null for a missing row', () => {
    const snap = territorySnapshot(territory());
    expect(Object.keys(snap!).sort()).toEqual([...AUDITED_TERRITORY_FIELDS].sort());
    expect(territorySnapshot(null)).toBeNull();
  });

  it('keeps the two field sets inside the audited set', () => {
    for (const f of [...MATCH_KEY_FIELDS, ...OWNERSHIP_FIELDS]) {
      expect(AUDITED_TERRITORY_FIELDS as readonly string[]).toContain(f);
    }
  });
});

describe('the audit writer supplies every column the table requires', () => {
  it('names each NOT NULL column, derived rather than copied', () => {
    // A hand-copied list is a 23502 waiting for the next schema change, so the
    // requirement comes from drizzle's own config.
    const cols = getTableConfig(auditLogs).columns;
    const required = cols.filter((c) => c.notNull && !c.hasDefault).map((c) => c.name);
    expect(required.length).toBeGreaterThan(4);
    const body = AUDIT.slice(AUDIT.indexOf(".from('audit_logs').insert("));
    for (const col of required) {
      expect({ col, supplied: body.includes(`${col}:`) }).toEqual({ col, supplied: true });
    }
  });

  it('writes `timestamp`, not `created_at`', () => {
    // CLAUDE.md records this as a confirmed true positive; the column with a
    // default is the one nobody has to supply, and the one that does not exist
    // would be a phantom column in a write.
    const names = getTableConfig(auditLogs).columns.map((c) => c.name);
    expect(names).toContain('timestamp');
    expect(names).not.toContain('created_at');
  });

  it('takes the first x-forwarded-for entry, not the proxy chain', () => {
    expect(AUDIT).toContain("forwarded?.split(',')[0]");
  });

  // CALLED, not read. A source check for `} catch (err) {` plus a
  // `return { written: false` passed while the catch body was replaced with
  // `throw err`, because the OTHER such return - in the if(error) branch - was
  // still there. Presence is not a property; invoking it is.
  const stub = (behaviour: 'ok' | 'error' | 'throw') => {
    const rows: Record<string, unknown>[] = [];
    const client = {
      from: () => ({
        insert: (values: Record<string, unknown>) => {
          if (behaviour === 'throw') throw new Error('connection reset');
          rows.push(values);
          return Promise.resolve({ error: behaviour === 'error' ? { message: 'denied' } : null });
        },
      }),
    };
    return { client, rows };
  };
  const entry = {
    tenantId: 't-1',
    userId: 'u-1',
    action: 'UPDATE_TERRITORY',
    resource: 'sales_territories',
  };
  const request = () =>
    new Request('https://example.test/x', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'vitest' },
    });

  it('resolves rather than rejecting when the insert THROWS', async () => {
    const { client } = stub('throw');
    await expect(writeAuditLog(client, entry, request())).resolves.toMatchObject({
      written: false,
    });
  });

  it('reports a rejected insert rather than claiming it was written', async () => {
    const { client } = stub('error');
    const out = await writeAuditLog(client, entry, request());
    expect(out.written).toBe(false);
    expect(out.error).toContain('denied');
  });

  it('writes the caller ip, not the proxy chain, and defaults severity', async () => {
    const { client, rows } = stub('ok');
    const out = await writeAuditLog(client, entry, request());
    expect(out).toEqual({ written: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].ip_address).toBe('203.0.113.7');
    expect(rows[0].severity).toBe('medium');
    expect(rows[0].category).toBe('data_modification');
    expect(rows[0].tenant_id).toBe('t-1');
  });

  it('falls back to a placeholder ip rather than writing null into a NOT NULL column', async () => {
    const { client, rows } = stub('ok');
    await writeAuditLog(client, entry, new Request('https://example.test/x'));
    expect(rows[0].ip_address).toBe('0.0.0.0');
  });
});

describe('every territory write is recorded, and neither claims a write it did not make', () => {
  const branchOf = (method: string) => {
    const at = FN.indexOf(`req.method === '${method}'`);
    expect(at).toBeGreaterThan(-1);
    const next = FN.slice(at + 10).search(/req\.method === '(GET|POST|PUT|DELETE)'/);
    return FN.slice(at, next === -1 ? FN.length : at + 10 + next);
  };

  it.each([
    ['POST', 'CREATE_TERRITORY'],
    ['PUT', 'UPDATE_TERRITORY'],
    ['DELETE', 'DELETE_TERRITORY'],
  ])('%s writes a %s entry', (method, action) => {
    const body = branchOf(method);
    expect(body).toContain('writeAuditLog(');
    expect(body).toContain(`action: '${action}'`);
  });

  it.each(['PUT', 'DELETE'])('%s reads the row before writing, so there is a diff', (method) => {
    const body = stripComments(branchOf(method));
    expect(body).toContain('const { data: before }');
    expect(body).toContain('.maybeSingle()');
    // Bound to the branch, not to the file: both branches need their own.
    expect(body).toMatch(/if \(!before\) \{/);
  });

  it.each(['PUT', 'DELETE'])('%s answers 404 rather than reporting a phantom write', (method) => {
    const body = stripComments(branchOf(method));
    const at = body.indexOf('if (!before) {');
    expect(at).toBeGreaterThan(-1);
    expect(body.slice(at, at + 200)).toContain('404');
  });

  it('marks a reassigning update high, and a delete always high', () => {
    expect(stripComments(branchOf('PUT'))).toContain("change.reassigns ? 'high' : 'medium'");
    expect(stripComments(branchOf('DELETE'))).toContain("severity: 'high'");
  });

  it("records the deleted territory's NAME, which is what says who moved", () => {
    const body = stripComments(branchOf('DELETE'));
    expect(body).toContain('oldValues: territorySnapshot(before)');
    expect(body).toContain('territoryName:');
  });

  it('does not invent an affected-account count', () => {
    // Answering "how many accounts moved" means the coverage scan - every
    // business_record in the tenant - which is far too expensive on a write
    // path, and an approximation would miss the case-insensitive and code
    // matches the real resolver makes.
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const body = stripComments(branchOf(method));
      expect(body).not.toContain('territoryCoverage(');
      expect(body).not.toMatch(/accountsMoved|affectedAccounts/);
    }
  });
});
