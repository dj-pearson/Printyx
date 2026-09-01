/**
 * The purchase-order workflow writes columns that exist (AUDIT-037).
 *
 * supabase/functions/purchase-orders/ implements submit, approve, reject and
 * receive end to end, and every one of them wrote at least one column the table
 * does not have - so each answered a 42703. Search named two more. It was
 * invisible because purchase_orders is declared twice and check:phantom-cols
 * skipped tables in that state until the ambiguity became resolvable.
 *
 * Two different fixes, chosen per column. A name that already had a home was
 * rebound (approved_at -> approved_date, supplier_id -> vendor_id,
 * reference_number/notes -> po_number/description). Genuine workflow state with
 * nowhere to live got a column in 0065: dropping it would mean a rejection with
 * no reason and a receipt with no receiver.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const fn = stripComments(read('supabase/functions/purchase-orders/index.ts'));
const migration = read('drizzle/migrations/0065_spicy_purple_man.sql');
const schema = read('shared/schema.ts');

const ADDED = [
  'submitted_at',
  'approval_notes',
  'rejected_at',
  'rejected_by',
  'rejection_reason',
  'received_by',
  'last_receipt_date',
  'receipt_notes',
];

describe('the workflow state has columns now', () => {
  it('declares all eight where drizzle-kit reads them', () => {
    const at = schema.indexOf('export const purchaseOrders = pgTable(');
    const decl = schema.slice(at, at + 4000);
    expect(at).toBeGreaterThan(-1);
    for (const col of ADDED) expect(decl, col).toContain(`'${col}'`);
  });

  it('adds them idempotently, like 0046/0047/0064', () => {
    for (const col of ADDED) {
      expect(migration, col).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS "${col}"`));
    }
    expect(migration).toMatch(/table_name = 'purchase_orders'/);
    expect(migration).not.toMatch(/ADD COLUMN "\w+"/);
  });
});

describe('the names that already had a home are rebound, not duplicated', () => {
  it('writes approved_date, not approved_at', () => {
    expect(fn).toMatch(/approved_date: new Date\(\)\.toISOString\(\)/);
    expect(fn).not.toMatch(/approved_at:/);
  });

  it('searches the columns the table has', () => {
    // reference_number and notes are not columns, so every search was a 42703.
    // Scoped to the search: the CREATE and UPDATE payloads still write
    // reference_number and eight more phantom columns from a NAMED VARIABLE,
    // which check:phantom-cols cannot see (it resolves inline literals only).
    // That is recorded on AUDIT-037 rather than rushed here.
    const at = fn.indexOf('if (search) {');
    const block = fn.slice(at, at + 400);
    expect(at).toBeGreaterThan(-1);
    expect(block).not.toMatch(/reference_number/);
    expect(block).toMatch(/po_number\.ilike[\s\S]{0,40}description\.ilike/);
  });

  it('reads vendor_id in the validate function', () => {
    const validate = stripComments(read('supabase/functions/validate/index.ts'));
    expect(validate).toMatch(/vendor_id, expected_date, approved_date/);
    expect(validate).not.toMatch(/supplier_id/);
  });
});

describe('auto-replenishment stops reporting orders it cannot create', () => {
  const asr = read('supabase/functions/auto-supply-replenishment/index.ts');

  it('answers 501 instead of reporting a count', () => {
    // The insert omitted six NOT NULL columns and swallowed its own error, so a
    // run that ordered nothing looked like a run with nothing to order.
    const at = asr.indexOf("endpoint === 'trigger'");
    const branch = asr.slice(at, at + 2600);
    expect(at).toBeGreaterThan(-1);
    expect(branch).toMatch(/code: 'NOT_IMPLEMENTED'/);
    expect(branch).toMatch(/501/);
    // The other ordersCreated in this file counts auto_supply_orders, a
    // different table, and that branch does check its error.
    expect(stripComments(branch)).not.toMatch(/ordersCreated/);
  });

  it('no longer names columns purchase_orders and its items lack', () => {
    const code = stripComments(asr);
    expect(code).not.toMatch(/source_rule_id/);
    expect(code).not.toMatch(/order_type/);
  });

  it('stops reading rule columns the settings table does not have', () => {
    // supply_replenishment_rules is one row of per-tenant settings, not a
    // per-product rule set: no is_active, auto_order, product_id,
    // reorder_point, warehouse_id or reorder_quantity.
    const at = asr.indexOf("endpoint === 'trigger'");
    const branch = stripComments(asr.slice(at, at + 2600));
    expect(branch).not.toMatch(/auto_order/);
    expect(branch).not.toMatch(/reorder_point/);
  });
});
