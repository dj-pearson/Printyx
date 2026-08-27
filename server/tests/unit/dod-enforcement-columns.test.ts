/**
 * QUALITY-002: routes-dod-enforcement validated five workflow hand-offs
 * against columns none of these tables has. Drizzle emits nothing for an
 * undefined column rather than throwing, so each .select() produced a
 * statement with an empty operand and Postgres rejected it — all five
 * validators answered 500.
 *
 * tsc catches this class, but only while the ratchet holds; a regression
 * elsewhere can offset it. These name the specific columns so a reintroduction
 * points at the field rather than at a count.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

/** Comments stripped: the file's own header names the phantom columns to
 *  explain what was wrong, and that is documentation, not a read. */
const ROUTES = fs
  .readFileSync('server/routes-dod-enforcement.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('dod-enforcement reads columns that exist', () => {
  it.each([
    ['quotes.lineItems', 'line items live in quote_line_items'],
    ['purchaseOrders.lineItems', 'line items live in purchase_order_items'],
    ['proposals.content', 'the narrative is in named columns'],
    ['proposals.sections', 'the narrative is in named columns'],
    ['proposals.branding', 'styling is templateId / customStyling'],
    ['businessRecords.contactName', 'the column is primaryContactName'],
    ['businessRecords.email', 'the column is primaryContactEmail'],
    ['warehouseKittingOperations.itemsProcessed', 'the work is checklistItems'],
  ])('does not read %s (%s)', (phantom) => {
    expect(ROUTES).not.toContain(phantom);
  });

  it('counts quote line items from their own table', () => {
    expect(ROUTES).toContain('quoteLineItems.quoteId');
  });

  it('counts purchase order items from their own table', () => {
    expect(ROUTES).toContain('purchaseOrderItems.purchaseOrderId');
  });

  // defects_found is jsonb — an array of defect objects. `defectsFound > 0`
  // compared an array to a number.
  it('treats defectsFound as an array, not a count', () => {
    expect(ROUTES).toContain('Array.isArray(operation.defectsFound)');
    expect(ROUTES).not.toMatch(/defectsFound\s*>\s*0/);
  });
});
