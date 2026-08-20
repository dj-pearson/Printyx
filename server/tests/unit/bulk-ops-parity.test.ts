// PROD-014 parity lock.
//
// The bulk endpoints had no branch on the edge functions, so the action word
// became the id: DELETE /product-models/bulk-delete deleted where
// id = 'bulk-delete'. `id` is a varchar on all three tables, so that matched no
// row, PostgREST reported no error, and the function answered 200 — the user
// was told the bulk delete succeeded and nothing was deleted.
//
// Both backends now parse the request the same way. The two rules worth pinning
// are the empty-list refusal (an empty ids array must not read as "all") and
// the update whitelist (an endpoint meant for an invoice's status must not be
// able to rewrite its amount).
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';

import * as node from '../../lib/bulk-ops';
import * as edge from '../../../supabase/functions/_shared/bulk-ops';
import { invoices } from '@shared/schema';

const invoiceColumns = new Set(
  Object.values(getTableColumns(invoices as never) as Record<string, { name: string }>).map(
    (c) => c.name,
  ),
);

describe('parseBulkIds parity', () => {
  const cases: Array<[string, unknown]> = [
    ['a normal list', { ids: ['a', 'b'] }],
    ['an empty list', { ids: [] }],
    ['a missing ids key', {}],
    ['a null body', null],
    ['ids as a string', { ids: 'a,b' }],
    ['a list with a non-string', { ids: ['a', 7] }],
    ['a list with an empty string', { ids: ['a', ''] }],
    ['over the cap', { ids: Array.from({ length: 501 }, (_, i) => `id-${i}`) }],
    ['exactly at the cap', { ids: Array.from({ length: 500 }, (_, i) => `id-${i}`) }],
  ];

  it.each(cases)('%s', (_label, body) => {
    expect(edge.parseBulkIds(body)).toEqual(node.parseBulkIds(body));
  });

  it('refuses an empty list rather than treating it as everything', () => {
    // The difference between a no-op and deleting a tenant's invoices.
    expect(edge.parseBulkIds({ ids: [] }).ok).toBe(false);
    expect(node.parseBulkIds({ ids: [] }).ok).toBe(false);
  });

  it('caps at the same 500 Express caps at', () => {
    expect(edge.MAX_BULK_IDS).toBe(node.MAX_BULK_IDS);
    expect(edge.MAX_BULK_IDS).toBe(500);
    expect(edge.parseBulkIds({ ids: Array(501).fill('x') }).ok).toBe(false);
    expect(edge.parseBulkIds({ ids: Array(500).fill('x') }).ok).toBe(true);
  });
});

describe('parseBulkUpdate parity', () => {
  const cases: Array<[string, unknown]> = [
    ['a status change', { ids: ['a'], updates: { status: 'paid' } }],
    [
      'camelCase and snake_case together',
      { ids: ['a'], updates: { invoiceStatus: 'sent', sales_rep: 'r1' } },
    ],
    ['only unknown fields', { ids: ['a'], updates: { totalAmount: 0 } }],
    ['a mix of known and unknown', { ids: ['a'], updates: { status: 'paid', totalAmount: 0 } }],
    ['no updates key', { ids: ['a'] }],
    ['updates as an array', { ids: ['a'], updates: ['status'] }],
    ['no ids', { updates: { status: 'paid' } }],
  ];

  it.each(cases)('%s', (_label, body) => {
    expect(edge.parseBulkUpdate(body, 'invoices')).toEqual(node.parseBulkUpdate(body, 'invoices'));
  });

  it('drops a field that is not whitelisted, on both sides', () => {
    // total_amount is a real column, which is exactly why it must not be
    // reachable from an endpoint the UI calls to set a status.
    const body = { ids: ['a'], updates: { status: 'paid', totalAmount: 0, total_amount: 0 } };
    for (const parse of [edge.parseBulkUpdate, node.parseBulkUpdate]) {
      const out = parse(body, 'invoices');
      expect(out.ok).toBe(true);
      expect(out.updates).toEqual({ status: 'paid' });
    }
  });

  it('refuses when nothing survives the whitelist', () => {
    const out = edge.parseBulkUpdate({ ids: ['a'], updates: { totalAmount: 0 } }, 'invoices');
    expect(out.ok).toBe(false);
    expect(out.message).toBe('No valid update fields provided');
  });

  it('refuses an unknown resource rather than allowing everything', () => {
    const out = edge.parseBulkUpdate({ ids: ['a'], updates: { status: 'x' } }, 'not-a-resource');
    expect(out.ok).toBe(false);
    expect(
      node.parseBulkUpdate({ ids: ['a'], updates: { status: 'x' } }, 'not-a-resource').ok,
    ).toBe(false);
  });

  it('maps every whitelisted field to a real invoices column', () => {
    for (const column of Object.values(edge.BULK_UPDATE_FIELDS.invoices)) {
      expect(invoiceColumns.has(column), column).toBe(true);
    }
  });

  it('whitelists the same fields on both sides', () => {
    expect(edge.BULK_UPDATE_FIELDS).toEqual(node.BULK_UPDATE_FIELDS);
  });
});
