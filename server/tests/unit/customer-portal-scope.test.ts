/**
 * Whose account a customer-portal request reads is decided once, and not by the
 * caller (SEC-EDGE-001).
 *
 * Every branch in this function resolved its customer as
 * `?customerId=` || `?customer_id=` || the JWT claim, then checked only that
 * the customer belonged to the caller's tenant - on the SERVICE ROLE client,
 * which bypasses RLS. The override exists for a real reason (`_context.ts`
 * called it the dealer-staff view, and a support agent opening a customer's
 * portal data is the feature), but NOTHING VERIFIED THE CALLER WAS STAFF, and
 * a portal customer is in the tenant too - so that check passed for them as
 * well, and `?customerId=<sibling>` returned the sibling's dashboard,
 * invoices, equipment and usage.
 *
 * IMPACT, STATED HONESTLY: nothing in this repo sets `customer_id` on any
 * user, so no portal customers exist yet and the staff branch is what runs
 * today. This is a door closed before the feature that opens it ships.
 *
 * The second half is the same SEC-TENANT-003 reasoning the file already
 * applied to tenant, one field over: the claim was read from `user_metadata`
 * as a fallback, and the session holder writes that bag.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const INDEX = strip(read('supabase/functions/customer-portal/index.ts'));
const CONTEXT = strip(read('supabase/functions/customer-portal/handlers/_context.ts'));

describe('the customer claim comes from the bag the caller cannot write', () => {
  it('reads app_metadata and no longer falls back to user_metadata', () => {
    // supabase.auth.updateUser writes user_metadata. Every query here runs on
    // the service-role client, so a claim taken from there is a customer of
    // the caller's choosing.
    expect(INDEX).toContain('user.app_metadata?.customer_id');
    expect(INDEX).not.toContain('user_metadata?.customer_id');
  });
});

describe('a portal customer cannot address another account', () => {
  it('refuses a query param that disagrees with the claim', () => {
    expect(INDEX).toContain('CUSTOMER_SCOPE_VIOLATION');
    // 403, not a silent fall back to their own id: quietly serving their own
    // data would hide a probe.
    const guard = INDEX.slice(INDEX.indexOf('requestedCustomerId'));
    expect(guard.slice(0, 700)).toContain('403');
  });

  it('the refusal runs before any branch dispatches', () => {
    const guardAt = INDEX.indexOf('CUSTOMER_SCOPE_VIOLATION');
    expect(guardAt).toBeGreaterThan(0);
    for (const branch of ["subRoute === 'dashboard'", "subRoute === 'service-requests'"]) {
      const at = INDEX.indexOf(branch);
      expect(at, `branch missing: ${branch}`).toBeGreaterThan(0);
      expect(guardAt, `guard runs after ${branch}`).toBeLessThan(at);
    }
  });

  it('a caller with no claim keeps the override, because that is staff', () => {
    // The dealer-staff view is the reason the parameter exists; the fix is to
    // stop portal customers using it, not to remove it.
    expect(INDEX).toContain('claimedCustomerId ?? requestedCustomerId');
  });
});

describe('the customer is resolved exactly once', () => {
  it('no branch re-reads the parameter for itself', () => {
    // Five branches each had their own `?customerId= || ?customer_id= || claim`
    // chain. A sixth would have inherited the hole.
    const reReads = [...INDEX.matchAll(/searchParams\.get\('customer_?[iI]d'\)/g)];
    // Only the single resolution point at the top may read it.
    expect(reReads.length).toBe(2);
    const resolveAt = INDEX.indexOf('const requestedCustomerId');
    for (const m of reReads) {
      expect(m.index).toBeGreaterThan(resolveAt - 1);
      expect(m.index).toBeLessThan(resolveAt + 200);
    }
  });

  it('the handlers read the resolved value rather than the URL', () => {
    expect(CONTEXT).toContain('return ctx.customerId;');
    expect(CONTEXT).not.toContain("ctx.url.searchParams.get('customerId')");
  });

  it('resolveCustomerId is still a function, so a local re-resolve shows in a diff', () => {
    expect(CONTEXT).toContain('export function resolveCustomerId');
  });
});
