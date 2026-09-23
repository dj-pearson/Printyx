import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adjustmentFor, toInventoryView } from '../../../client/src/lib/inventory-item';

/**
 * Round 195. The inventory page read camelCase fields off raw snake_case rows
 * (so every item showed zero stock needing a reorder), Add Item and Update
 * Stock had no handlers, the empty state toasted "Add item dialog would open
 * here", and the adjust endpoint concatenated a string quantity.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const PAGE = strip(readFileSync(join(root, 'client/src/pages/inventory.tsx'), 'utf8'));
const FN = strip(readFileSync(join(root, 'supabase/functions/inventory/index.ts'), 'utf8'));

describe('toInventoryView', () => {
  it('maps the snake_case columns the page reads', () => {
    const v = toInventoryView({
      id: 'i1',
      name: 'Toner K',
      part_number: 'TK-1',
      quantity_on_hand: 4,
      reorder_point: '2',
      unit_cost: '12.50',
      bin_location: 'A3',
    });
    expect(v).toMatchObject({
      partNumber: 'TK-1',
      quantityOnHand: 4,
      reorderPoint: 2,
      unitCost: 12.5,
      binLocation: 'A3',
    });
  });
  it('keeps a missing quantity null and a real zero zero', () => {
    expect(toInventoryView({ id: 'x' }).quantityOnHand).toBeNull();
    expect(toInventoryView({ id: 'x', quantity_on_hand: 0 }).quantityOnHand).toBe(0);
  });
});

describe('adjustmentFor', () => {
  it('turns a counted total into the delta the endpoint takes', () => {
    expect(adjustmentFor(10, '7')).toBe(-3);
    expect(adjustmentFor(null, '5')).toBe(5);
  });
  it('sends nothing for no change or a count that is not a whole non-negative number', () => {
    expect(adjustmentFor(10, '10')).toBeNull();
    for (const bad of ['', '-1', '2.5', 'abc']) expect(adjustmentFor(10, bad), bad).toBeNull();
  });
});

describe('the adjust endpoint', () => {
  const branch = FN.slice(FN.indexOf("action === 'adjust'"), FN.indexOf("action === 'reserve'"));
  it('coerces and validates the quantity before adding it', () => {
    expect(branch).toMatch(/const quantity = Number\(body\.quantity\)/);
    expect(branch).toMatch(/Number\.isInteger\(quantity\)/);
  });
  it('refuses a result below zero before writing', () => {
    const refusal = branch.indexOf('newOnHand < 0');
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(branch.indexOf('.update('));
  });
});

describe('the page', () => {
  it('maps rows through the view', () => {
    expect(PAGE).toMatch(/\.map\(toInventoryView\)/);
  });
  it('wires Add Item and Update Stock to the endpoints', () => {
    expect(PAGE).toMatch(/apiRequest\('\/api\/inventory', 'POST'/);
    expect(PAGE).toMatch(/apiRequest\(`\/api\/inventory\/\$\{item\.id\}\/adjust`, 'POST'/);
    expect(PAGE).toMatch(/onClick=\{\(\) => setAddOpen\(true\)\}/);
    expect(PAGE).toMatch(/onClick=\{\(\) => openStockCount\(item\)\}/);
    expect(PAGE).not.toContain('would open here');
  });
  it('bulk delete counts what happened', () => {
    expect(PAGE).toContain('bulkDelete(itemIds');
    expect(PAGE).not.toContain('Promise.all');
  });
});
