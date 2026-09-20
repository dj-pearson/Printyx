/**
 * A PCI control that is written and called by nothing (QUALITY-002).
 *
 * `server/services/payment-audit-service.ts` is the only writer of
 * `payment_audit_trail` and `payment_method_changes`, and nothing imports it,
 * so both tables have never held a row. What makes it worth a test rather than
 * a comment is the second half: `data-retention-service.ts` declares a 7-year
 * PCI retention policy for `payment_audit_trail`. A retention rule on a table
 * nothing fills reads, from the outside, exactly like a control that runs.
 *
 * This is the AUDIT-034 shape - a security control applied by nothing - and it
 * takes the same treatment: assert the current state so it cannot go stale,
 * and DESIGN THE TEST TO FAIL the day someone wires it, so the header above the
 * service is corrected in the same commit that makes it wrong.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { invoiceSubscriptionId } from '../../services/payment-audit-service';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** This file names the service and both tables in its own header. */
function stripComments(src: string): string {
  return src.replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(repo, dir))) {
    if (['node_modules', 'dist', 'build', 'tests'].includes(entry)) continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(repo, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

const SERVICE = 'server/services/payment-audit-service.ts';

describe('the payment audit trail is not wired, and says so', () => {
  it('nothing in server/, client/ or the edge tree imports it', () => {
    const importers = ['server', 'client/src', 'supabase/functions', 'scripts']
      .flatMap((root) => walk(root))
      .filter((f) => f !== SERVICE)
      .filter((f) => stripComments(read(f)).includes('payment-audit-service'));

    /**
     * FAILING HERE IS THE POINT. If you have just given this service a caller,
     * that is good news - remove this assertion, correct the header on the
     * service (which currently states it is unwired), and check that the
     * retention policy below now describes something real.
     */
    expect(importers).toEqual([]);
  });

  it('it really is the only writer of both tables', () => {
    for (const table of ['payment_audit_trail', 'payment_method_changes']) {
      const camel = table.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
      const writers = ['server', 'supabase/functions']
        .flatMap((root) => walk(root))
        .filter((f) => f !== SERVICE && !f.includes('/shared/'))
        .filter((f) => {
          const src = stripComments(read(f));
          return (
            new RegExp(`\\.insert\\(\\s*${camel}\\b`).test(src) ||
            new RegExp(`from\\(['"\`]${table}['"\`]\\)[\\s\\S]{0,120}\\.insert\\(`).test(src)
          );
        });
      expect(writers, `${table} gained a writer outside the service`).toEqual([]);
    }
  });

  it('the retention policy that makes this look live is still declared', () => {
    // Named so the gap is discoverable from either end. If the policy goes,
    // this assertion should go with it - and if the service gets wired, the
    // policy stops being misleading.
    const retention = read('server/services/data-retention-service.ts');
    expect(retention).toContain('payment_audit_trail');
  });

  it('the service header states the gap rather than implying it works', () => {
    // Flattened first: a JSDoc header wraps, so `have never held a row`
    // spans two lines with a ` * ` in the middle. Asserting on the raw text
    // fails for formatting reasons rather than for the reason that matters.
    const header = read(SERVICE)
      .slice(0, 2000)
      .replace(/\n\s*\*\s?/g, ' ')
      .replace(/\s+/g, ' ');
    expect(header).toContain('CALLED BY NOTHING');
    expect(header).toContain('have never held a row');
    expect(header).toContain('NOTHING IMPORTS IT');
  });
});

describe('the invoice subscription id survives a Stripe API version bump', () => {
  const src = read(SERVICE);

  /**
   * Called rather than grepped. The first version of this asserted the body
   * contained 'subscription_details', and a mutant that renamed the property to
   * `subscription_detailsX` SURVIVED it - the string was still a substring of
   * the broken name. Reading source proves the text is there; only running it
   * proves the id comes out.
   */
  const invoice = (o: Record<string, unknown>) =>
    o as unknown as Parameters<typeof invoiceSubscriptionId>[0];

  it('reads the flat field the pinned API version sends', () => {
    // 2024-11-20.acacia, which stripe-service.ts pins, still returns this.
    expect(invoiceSubscriptionId(invoice({ subscription: 'sub_flat' }))).toBe('sub_flat');
    expect(invoiceSubscriptionId(invoice({ subscription: { id: 'sub_obj' } }))).toBe('sub_obj');
  });

  it('reads the parent shape a newer API version sends', () => {
    // invoice.subscription was removed in 2025-03-31.basil and moved here. A
    // cast would keep compiling and start writing null the day the pin moves.
    const newer = invoice({
      parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_new' } },
    });
    expect(invoiceSubscriptionId(newer)).toBe('sub_new');
    const expanded = invoice({
      parent: {
        type: 'subscription_details',
        subscription_details: { subscription: { id: 'sub_exp' } },
      },
    });
    expect(invoiceSubscriptionId(expanded)).toBe('sub_exp');
  });

  it('a one-off invoice yields undefined, not a null written as a string', () => {
    expect(invoiceSubscriptionId(invoice({}))).toBeUndefined();
    // quote_details is the other parent type; it carries no subscription.
    expect(
      invoiceSubscriptionId(invoice({ parent: { type: 'quote_details', quote_details: {} } })),
    ).toBeUndefined();
  });

  it('no call site reads invoice.subscription directly any more', () => {
    expect(stripComments(src)).not.toMatch(/\binv\w*\.subscription\b/);
  });
});
