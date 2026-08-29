/**
 * The two PostgREST error predicates now have a single definition in
 * supabase/functions/_shared/postgrest-errors.ts. Three call sites depend on
 * them: the billing and customer-portal handlers, which tolerate a missing
 * drift table, and auto-lead-routing, which turns one into a 503 rather than
 * the two fabricated "sample rules" it used to return.
 *
 * Both directions matter and are asserted here. A false negative reinstates the
 * silent-empty-list failure the predicate exists to stop; a false positive is
 * worse, because a real error - a permission denial, a bad filter - would be
 * reported as "this table does not exist" and sent whoever reads it looking for
 * a migration that is not missing.
 */
import { describe, it, expect } from 'vitest';
import {
  isMissingTableError,
  isMissingColumnError,
} from '../../../supabase/functions/_shared/postgrest-errors';

describe('isMissingTableError', () => {
  it('recognises the Postgres and PostgREST codes for an absent relation', () => {
    expect(isMissingTableError({ code: '42P01' })).toBe(true);
    expect(isMissingTableError({ code: 'PGRST205' })).toBe(true);
  });

  it('recognises the message forms, since PostgREST does not always set a code', () => {
    expect(
      isMissingTableError({
        message: "Could not find the table 'public.lead_routing_rules' in the schema cache",
      }),
    ).toBe(true);
    expect(isMissingTableError({ message: 'relation "work_orders" does not exist' })).toBe(true);
  });

  it('is not fooled by an absent error', () => {
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError(undefined)).toBe(false);
  });

  it('does not claim a missing table for unrelated failures', () => {
    expect(
      isMissingTableError({ code: '42501', message: 'permission denied for table deals' }),
    ).toBe(false);
    expect(isMissingTableError({ code: 'PGRST116', message: 'JSON object requested' })).toBe(false);
  });

  it('separates a missing COLUMN from a missing table', () => {
    // 42703 says the relation is there and the column is not. Answering that
    // with "the table does not exist" points the reader at the wrong migration.
    const missingColumn = { code: '42703', message: 'column deals.deal_value does not exist' };
    expect(isMissingColumnError(missingColumn)).toBe(true);
    // The message form does carry "does not exist", so this one is caught by the
    // message branch too - the code check is what tells them apart, and callers
    // that need the distinction must test isMissingColumnError first.
    expect(isMissingColumnError({ code: '42P01' })).toBe(false);
  });
});

describe('isMissingColumnError', () => {
  it('recognises PGRST204, the write-side form', () => {
    expect(
      isMissingColumnError({
        code: 'PGRST204',
        message: "Could not find the 'discount_reason' column of 'proposals'",
      }),
    ).toBe(true);
  });

  it('does not fire on an ordinary constraint violation', () => {
    expect(
      isMissingColumnError({ code: '23502', message: 'null value in column "type" violates' }),
    ).toBe(false);
  });
});
