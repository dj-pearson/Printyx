/**
 * Two forms that could never have worked (AUDIT-037).
 *
 * Both were hidden by the same guard gap - a payload built as a named variable -
 * and both fail the same way: a column that is not there makes the whole write a
 * 42703, so the feature reports a server error and nothing is saved.
 *
 * INVITING A USER. supabase/functions/admin/ created the auth account, then
 * inserted phone, job_title and department into `users`, which has none of them.
 * The insert failed, the cleanup branch deleted the auth account again, and the
 * caller got "Failed to create user record". Those three live on user_settings,
 * the same correction COP-M01 made to the user and users-team functions.
 *
 * CREATING A PURCHASE ORDER. The page and the function did not share a
 * vocabulary at all: the page posts poNumber, requestedBy, expectedDate,
 * description, deliveryAddress and specialInstructions - the real column names -
 * and the function read referenceNumber, expectedDeliveryDate, four shipTo*
 * parts, notes and internalNotes. It also never set requested_by, which is NOT
 * NULL, so it would have failed even with the names right.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('inviting a user writes to the table that has the columns', () => {
  const admin = read('supabase/functions/admin/index.ts');
  const code = stripComments(admin);

  it('keeps profile fields out of the users payload', () => {
    const at = code.indexOf('const newUserData = {');
    const payload = code.slice(at, code.indexOf('};', at));
    expect(at).toBeGreaterThan(-1);
    for (const col of ['phone', 'job_title', 'department']) {
      expect(payload, col).not.toContain(col);
    }
    expect(payload).toContain('first_name');
  });

  it('upserts them onto user_settings instead', () => {
    expect(code).toMatch(/from\('user_settings'\)\.upsert\(/);
    // user_settings.user_id carries a real UNIQUE constraint, so onConflict
    // resolves - an index alone would not be enough for PostgREST.
    expect(code).toMatch(/onConflict: 'user_id'/);
    expect(read('shared/schema.ts')).toMatch(
      /userId: varchar\('user_id'\)\.notNull\(\)\.unique\(\)/,
    );
  });

  it('maps locale onto the column that exists, which is language', () => {
    expect(code).toMatch(/settingsUpdate\.language = body\.locale/);
    expect(code).not.toMatch(/updateData\.locale/);
  });

  it('does not fail an invitation over an optional profile field', () => {
    // The account works without a job title; undoing the invite would not be an
    // improvement.
    const at = code.indexOf("from('user_settings').upsert");
    expect(code.slice(at, at + 600)).toMatch(/console\.error\('Error storing invited user profile/);
  });
});

describe('a purchase order is created with the columns the page sends', () => {
  const po = stripComments(read('supabase/functions/purchase-orders/index.ts'));
  const page = read('client/src/pages/PurchaseOrders.tsx');

  it('sets requested_by, which is NOT NULL and was never set', () => {
    expect(po).toMatch(/requested_by: body\.requestedBy/);
  });

  it('speaks the page vocabulary', () => {
    for (const field of ['expectedDate', 'deliveryAddress', 'specialInstructions', 'requestedBy']) {
      expect(page, field).toContain(field);
      expect(po, field).toContain(field);
    }
  });

  it('drops the four fields nothing supplies rather than adding columns', () => {
    // reference_number, currency, shipping_method and payment_terms: the page
    // sends none, the PO number is the reference, and payment terms belong to
    // the vendor. Adding columns for input nothing supplies is how this file
    // got into that state.
    for (const col of ['reference_number', 'currency', 'shipping_method', 'payment_terms']) {
      expect(po, col).not.toContain(`${col}:`);
    }
  });

  it('adds the lifecycle audit columns instead, in one idempotent migration', () => {
    const sql = read('drizzle/migrations/0066_puzzling_red_wolf.sql');
    for (const col of [
      'submitted_by',
      'ordered_at',
      'ordered_by',
      'cancelled_at',
      'cancelled_by',
      'cancellation_reason',
    ]) {
      expect(sql, col).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS "${col}"`));
    }
    expect(sql).toMatch(/table_name = 'purchase_orders'/);
  });
});
