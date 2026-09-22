/**
 * A customer portal that trusted a caller-supplied request id (SEC-EDGE-001).
 *
 * `portal-service` is a CUSTOMER surface: the page is routed at /portal and its
 * own header opens "the customer describes what's wrong". All four endpoints
 * take a `requestId` from the caller and looked it up filtered on `tenant_id`
 * and nothing else - and a portal customer is in the tenant.
 *
 * So one customer could pass another's request id and read its timeline, read
 * the free text they typed into it, submit a star rating on their behalf, and
 * run `POST /classify` against it - which OPENS A SERVICE TICKET on that
 * customer's account, moves their request to 'assigned', and writes status
 * history signed "AI Dispatch". That last one is a write against someone else's
 * account, not a read leak.
 *
 * Same defect and same fix as `customer-portal` one function over: the claim
 * comes from `app_metadata` ONLY, because the session holder writes
 * `user_metadata` through `supabase.auth.updateUser` and every query here runs
 * on the SERVICE ROLE client, which bypasses RLS.
 *
 * IMPACT, STATED SO THE WRITE-UP IS HONEST: nothing in this repo sets
 * `customer_id` on any user, so there are no portal customers yet and the staff
 * branch is what runs today. This closes a door before the feature that opens
 * it ships.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { customerServiceRequests } from '../../../shared/customer-portal-schema';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Comments blanked on BOTH sides: this file and the handler describe the same
 *  defect, and an absence assertion that matches its own explanation reports
 *  the fix as the bug. */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const FN = strip(read('supabase/functions/portal-service/index.ts'));
const PORTAL = strip(read('supabase/functions/customer-portal/index.ts'));
const APP = read('client/src/App.tsx');

describe('the claim is read from the bag the session holder cannot write', () => {
  it('has a corpus to check', () => {
    expect(FN.length).toBeGreaterThan(2000);
    expect(FN).toContain("from('customer_service_requests')");
  });

  it('reads app_metadata and never falls back to user_metadata', () => {
    expect(FN).toMatch(/user\.app_metadata\?\.customer_id/);
    // The fallback is the whole defect in customer-portal's version of this.
    expect(FN).not.toContain('user_metadata');
  });

  it('matches the resolution customer-portal already settled on', () => {
    expect(PORTAL).toMatch(/user\.app_metadata\?\.customer_id/);
    expect(PORTAL).not.toContain('user_metadata');
  });

  it('this really is a customer surface, not a staff console', () => {
    // The impact claim rests on it. A staff-only page would make the tenant
    // filter correct and this whole change unnecessary.
    expect(APP).toMatch(/path="\/portal" component=\{CustomerPortalService\}/);
  });
});

describe('every request query is narrowed to the caller', () => {
  it('walks each site rather than counting the helper', () => {
    // A total is not a property: five calls with one site left open still
    // counts five. Each `.from('customer_service_requests')` is checked.
    const sites = [...FN.matchAll(/\.from\('customer_service_requests'\)/g)];
    expect(sites.length).toBeGreaterThanOrEqual(5);
    const unscoped: number[] = [];
    for (const m of sites) {
      const before = FN.slice(Math.max(0, (m.index ?? 0) - 300), m.index ?? 0);
      if (!before.includes('scopeToCustomer(')) {
        unscoped.push(FN.slice(0, m.index ?? 0).split('\n').length);
      }
    }
    expect(unscoped).toEqual([]);
  });

  it('the owner column is real, which check:phantom-cols cannot tell you here', () => {
    /**
     * THE GUARD'S DOCUMENTED BLIND SPOT, covered deliberately. A column literal
     * applied inside a helper is not on a resolvable `.from()` chain, so
     * check:phantom-cols either skips it or - as it did on the first version of
     * this file - attributes it to whatever table it last saw and reports a
     * false positive. Drizzle's own table config is the authority.
     */
    const columns = getTableConfig(customerServiceRequests).columns.map((c) => c.name);
    expect(columns).toContain('customer_id');
    expect(FN).toMatch(/const CUSTOMER_OWNER_COLUMN = 'customer_id';/);
  });

  it('one definition of the narrowing, so a fifth endpoint cannot differ', () => {
    // customer-portal ended up with five copies of the same broken chain.
    expect(FN).toMatch(/function scopeToCustomer<Q>\(/);
    const body = FN.slice(FN.indexOf('function scopeToCustomer<Q>('));
    expect(body.slice(0, 300)).toMatch(
      /claimedCustomerId[\s\S]{0,40}\(query as any\)\.eq\(CUSTOMER_OWNER_COLUMN/,
    );
  });

  it('no claim keeps the tenant-wide view, so staff are not locked out', () => {
    const body = FN.slice(FN.indexOf('function scopeToCustomer<Q>('));
    // The false branch returns the query untouched.
    expect(body.slice(0, 300)).toMatch(/: query;/);
  });

  it('the classifications read is gated through the request that owns it', () => {
    // portal_service_classifications carries no customer column, and the row
    // holds the free text the other customer typed.
    const guard = FN.indexOf('ownsRequest(admin, tenantId, second, claimedCustomerId)');
    const readAt = FN.indexOf("from('portal_service_classifications')");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(readAt);
  });

  it('the ownership check fails closed', () => {
    // A check that says yes when the database is unreachable is not a check.
    const body = FN.slice(FN.indexOf('async function ownsRequest('));
    expect(body.slice(0, 900)).toMatch(/if \(error\) return false;/);
  });
});

describe('the write branch is scoped before it writes', () => {
  it('classify resolves the request under the claim before creating a ticket', () => {
    const at = FN.indexOf('async function handleClassify(');
    const body = FN.slice(at, FN.indexOf('async function classify('));
    const lookup = body.indexOf("select('id, customer_id, title, equipment_id, status')");
    const insert = body.indexOf("from('service_tickets')");
    expect(lookup).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(lookup).toBeLessThan(insert);
    // And that lookup is the scoped one.
    expect(body.slice(Math.max(0, lookup - 300), lookup)).toContain('scopeToCustomer(');
  });

  it('the status update is filtered too, not left to the preceding read', () => {
    const at = FN.indexOf("status: 'assigned',");
    expect(at).toBeGreaterThan(-1);
    const before = FN.slice(Math.max(0, at - 500), at);
    expect(before).toContain('scopeToCustomer(');
  });

  it('rate is scoped on the write itself', () => {
    const at = FN.indexOf('customer_rating: rating');
    expect(at).toBeGreaterThan(-1);
    const before = FN.slice(Math.max(0, at - 400), at);
    expect(before).toContain('scopeToCustomer(');
  });

  it('every handler takes the claim, so none can forget to ask', () => {
    for (const sig of [
      'async function handleClassify(',
      'async function handleRate(',
      'async function handleTimeline(',
    ]) {
      const at = FN.indexOf(sig);
      expect({ sig, found: at > -1 }).toEqual({ sig, found: true });
      const params = FN.slice(at, FN.indexOf('): Promise<Response>', at));
      expect({ sig, takesClaim: params.includes('claimedCustomerId') }).toEqual({
        sig,
        takesClaim: true,
      });
    }
  });
});

describe('a request on another account is not confirmed to exist', () => {
  it('answers 404, never 403', () => {
    // 403 tells a customer which request ids are real on someone else's
    // account, which is the thing the scoping exists to hide.
    expect(FN).toContain("message: 'Service request not found'");
    expect(FN).not.toContain('CUSTOMER_SCOPE_VIOLATION');
    expect(FN).not.toMatch(/\b403\b/);
  });
});

describe('the verdict is recorded with the paths behind it', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json')) as {
    counts: Record<string, number>;
    triage: { fn: string; verdict: string; reason?: string; pathsRead?: string }[];
  };

  it('is filed row-scoped with the paths that were read', () => {
    const entry = triage.triage.find((e) => e.fn === 'portal-service');
    expect(entry?.verdict).toBe('row-scoped');
    expect((entry?.pathsRead ?? '').length).toBeGreaterThan(80);
  });

  it('the counts block still matches the entries it summarises', () => {
    const actual: Record<string, number> = {};
    for (const e of triage.triage) actual[e.verdict] = (actual[e.verdict] ?? 0) + 1;
    expect(triage.counts).toEqual(actual);
    // Round 91 emptied the unexamined worklist by settling the last entry
    // (handoff-task-templates). The floor here used to be `> 0`, guarding
    // against clearing the list by GUESSING verdicts rather than reading the
    // handlers. That property does not depend on the list being non-empty, so
    // it is asserted once over every entry in
    // server/tests/unit/edge-rbac-triage-integrity.test.ts.
    expect(triage.counts.unexamined ?? 0).toBe(0);
  });
});
