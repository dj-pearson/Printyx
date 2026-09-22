/**
 * A query parameter that names WHOSE data, honoured on a tenant filter alone
 * (SEC-EDGE-001).
 *
 * The customer-portal fix named a shape rather than a bug, so this round
 * grepped the edge tree for the rest of it: `?userId=`, `?customerId=`,
 * `?technicianId=`, `?employeeId=` used to decide the subject rather than to
 * filter a list. Most hits are legitimate - `?customerId=` on `/invoices`
 * narrows the tenant's invoices and the tenant filter is the control - and two
 * were not.
 *
 *   - daily-briefing: GET / took `?userId=` and POST /generate took
 *     `body.userId`, so any member could read a colleague's briefing and
 *     GENERATE one for them, which writes a log row and emails them.
 *   - crm: GET /analytics/conversion read `sales_metrics` - per-rep conversion
 *     and quota movement - filtered only by a `?userId=` the caller supplies.
 *
 * Both are narrowed rather than removed: a manager looking at a report is the
 * legitimate use, and `_shared/scope.ts` already answers who that is.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const BRIEF = strip(read('supabase/functions/daily-briefing/index.ts'));
const CRM = strip(read('supabase/functions/crm/index.ts'));

describe('a briefing override has to land inside the caller tier', () => {
  it('both entry points check the scope', () => {
    // The read and the write. The write matters more: it inserts a log row
    // against the target and emails them.
    expect(BRIEF.match(/scopeAllows\(/g) ?? []).toHaveLength(3); // definition + 2 call sites
    expect(BRIEF).toContain('OUT_OF_SCOPE');
  });

  it('the caller addressing themselves needs no scope resolution', () => {
    // The common case must not pay for a lookup, and a rep whose own id is
    // outside a degraded tier must still read their own briefing.
    const fn = BRIEF.slice(BRIEF.indexOf('function scopeAllows'));
    expect(fn.slice(0, 400)).toContain('targetUserId === callerId');
  });

  it('an unrestricted tier keeps the override', () => {
    // scope.userIds === null means the tier imposes no user filter at all.
    const fn = BRIEF.slice(BRIEF.indexOf('function scopeAllows'));
    expect(fn.slice(0, 400)).toContain('scope.userIds === null');
  });

  it('the generate check runs before the row is looked up or written', () => {
    const genAt = BRIEF.indexOf('const targetUserId');
    const checkAt = BRIEF.indexOf('scopeAllows(scope, targetUserId', genAt);
    const lookupAt = BRIEF.indexOf("from('users')", genAt);
    expect(checkAt).toBeGreaterThan(genAt);
    expect(checkAt).toBeLessThan(lookupAt);
  });
});

describe('per-rep sales metrics are scoped before the parameters apply', () => {
  it('the scope narrows the query first', () => {
    const at = CRM.indexOf("from('sales_metrics')");
    expect(at).toBeGreaterThan(0);
    const branch = CRM.slice(at, at + 1600);
    expect(branch).toContain('applyUserScope(query,');
    expect(branch).toContain("'user_id'");
  });

  it('the caller parameters are applied on top, so they can only narrow', () => {
    const scopeAt = CRM.indexOf('applyUserScope(query,');
    const paramAt = CRM.indexOf("url.searchParams.get('userId')", scopeAt);
    expect(paramAt).toBeGreaterThan(scopeAt);
  });
});

describe('the shape that is already correct elsewhere stays correct', () => {
  it('commission still scopes pay before its employeeId filter', () => {
    // WF-R-05 got there first; this asserts it did not regress while the same
    // pattern was being applied next door.
    const COMMISSION = strip(read('supabase/functions/commission/index.ts'));
    const scopeAt = COMMISSION.indexOf('applyUserScope(query,');
    expect(scopeAt).toBeGreaterThan(0);
    expect(COMMISSION.indexOf("query.eq('employee_id', employeeId)")).toBeGreaterThan(scopeAt);
    // A calculation belonging to nobody is a broken row, not shared work.
    expect(COMMISSION).toContain('includeUnowned: false');
  });
});
