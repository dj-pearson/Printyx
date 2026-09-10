import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * parts_order_items is only ever reached through its parent order, and the
 * three /:id/items handlers plus DELETE /:id took that id straight from the URL
 * and handed it to the SERVICE-ROLE client, which bypasses RLS. Nothing checked
 * whose order it was.
 *
 * The read leaked another tenant's part numbers, quantities and unit prices.
 * The write appended rows to their order. The delete was the worst: it ran
 * before the tenant-scoped delete of the order row, so their order survived
 * with every line stripped off it, and the caller got { success: true }.
 */
const SRC = readFileSync('supabase/functions/parts-orders/index.ts', 'utf8');

/** Source with block and line comments blanked out - an absence assertion must
 *  not be satisfied by the comment explaining the removal. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('parts-orders tenant scoping', () => {
  it('resolves the order against the tenant before touching its items', () => {
    expect(CODE).toMatch(/\.from\('parts_orders'\)[\s\S]{0,200}?\.eq\('tenant_id', tenantId\)/);
    expect(CODE).toContain('async function ownedOrder');
  });

  it('gates all three item handlers and the delete on that check', () => {
    const gates = CODE.match(/if \(!\(await ownedOrder\(orderId\)\)\) return notFound\(\);/g) ?? [];
    expect(gates.length).toBe(3);
  });

  it('never queries parts_order_items without a tenant filter', () => {
    // Every chain rooted at parts_order_items must carry tenant_id, except the
    // insert, which sets it in the payload.
    const chains = [...CODE.matchAll(/\.from\('parts_order_items'\)([\s\S]{0,400}?);/g)];
    expect(chains.length).toBeGreaterThan(0);
    for (const [, chain] of chains) {
      if (/\.insert\(/.test(chain)) continue; // insert sets tenant_id in the row payload
      expect(chain).toMatch(/tenant_id/);
    }
  });
});
