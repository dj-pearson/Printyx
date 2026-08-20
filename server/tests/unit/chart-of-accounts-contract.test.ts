// PROD-008: the chart-of-accounts write contract.
//
// The update handler spread the request body straight into PostgREST. The page
// sends camelCase - accountCode, accountName, isActive - and none of those is a
// column, so every update was a schema error. It stayed hidden because the page
// also sends PATCH while only PUT existed, so the request 404'd first.
import { describe, it, expect } from 'vitest';
import {
  toAccountColumns,
  validateNewAccount,
  isDeletable,
  SERVER_OWNED_COLUMNS,
} from '../../../supabase/functions/_shared/chart-of-accounts-contract';

// Exactly what ChartOfAccounts.tsx submits.
const FORM_PAYLOAD = {
  accountCode: '1000',
  accountName: 'Cash',
  accountType: 'asset',
  accountSubtype: 'current',
  parentAccountId: '',
  description: 'Operating cash',
  isActive: true,
};

describe('toAccountColumns', () => {
  it('maps the real form payload to real columns', () => {
    expect(toAccountColumns(FORM_PAYLOAD).columns).toEqual({
      account_code: '1000',
      account_name: 'Cash',
      account_type: 'asset',
      account_subtype: 'current',
      // '' is not a valid parent_account_id; the form submits it for "no parent".
      parent_account_id: null,
      description: 'Operating cash',
      is_active: true,
    });
  });

  it('accepts snake_case too, so older callers keep working', () => {
    expect(
      toAccountColumns({ account_code: '2000', account_name: 'AP', account_type: 'liability' })
        .columns,
    ).toEqual({ account_code: '2000', account_name: 'AP', account_type: 'liability' });
  });

  it('maps the legacy accountNumber alias onto account_code', () => {
    // There is no account_number column - it was one of the phantom names in
    // the original create payload - so this must not be dropped.
    expect(toAccountColumns({ accountNumber: '3000' }).columns).toEqual({ account_code: '3000' });
  });

  it('reports unknown keys instead of failing the whole statement', () => {
    const { columns, ignored } = toAccountColumns({ accountCode: '1', balance: 500, nope: true });
    expect(columns).toEqual({ account_code: '1' });
    expect(ignored.sort()).toEqual(['balance', 'nope']);
  });

  it('only false turns is_active off, matching the column default', () => {
    expect(toAccountColumns({ isActive: false }).columns.is_active).toBe(false);
    expect(toAccountColumns({ isActive: true }).columns.is_active).toBe(true);
    expect(toAccountColumns({ isActive: undefined }).columns.is_active).toBe(true);
  });

  it('omits fields the caller did not name, so a PATCH never blanks a column', () => {
    expect(toAccountColumns({ description: 'x' }).columns).toEqual({ description: 'x' });
  });

  it('returns nothing for a non-object body rather than throwing', () => {
    for (const body of [null, undefined, [], 'nope', 7]) {
      expect(toAccountColumns(body).columns).toEqual({});
    }
  });

  it('never emits a server-owned column from client input', () => {
    const { columns } = toAccountColumns({
      id: 'x',
      tenant_id: 'other-tenant',
      current_balance: 999,
      is_system: true,
      accountCode: '1',
    });
    for (const owned of SERVER_OWNED_COLUMNS) {
      expect(columns[owned], `${owned} must not be settable by a client`).toBeUndefined();
    }
  });
});

describe('validateNewAccount', () => {
  it('accepts the real form payload', () => {
    expect(validateNewAccount(toAccountColumns(FORM_PAYLOAD).columns)).toEqual({ ok: true });
  });

  it('requires code, name and type, and names each in the form field', () => {
    const result = validateNewAccount({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      'accountCode',
      'accountName',
      'accountType',
    ]);
  });

  it('rejects an empty string, matching the form min(1)', () => {
    const result = validateNewAccount(
      toAccountColumns({ ...FORM_PAYLOAD, accountCode: '' }).columns,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a non-string code rather than coercing it', () => {
    const result = validateNewAccount(
      toAccountColumns({ ...FORM_PAYLOAD, accountCode: 1000 }).columns,
    );
    expect(result.ok).toBe(false);
  });
});

describe('isDeletable', () => {
  it('allows deleting an account with no balance', () => {
    expect(isDeletable(0)).toBe(true);
    expect(isDeletable('0')).toBe(true);
    // numeric(12,2) comes back as a string from PostgREST.
    expect(isDeletable('0.00')).toBe(true);
  });

  it('treats a null balance as zero, because the column defaults to it', () => {
    expect(isDeletable(null)).toBe(true);
    expect(isDeletable(undefined)).toBe(true);
  });

  it('blocks deleting an account that holds money', () => {
    expect(isDeletable('1250.00')).toBe(false);
    expect(isDeletable(-1)).toBe(false);
    expect(isDeletable(0.01)).toBe(false);
  });

  it('blocks on an unparseable balance rather than assuming zero', () => {
    // The guard this replaces read a column that does not exist, so the value
    // was always undefined and it NEVER fired - an account holding money could
    // be deleted outright. Anything it cannot read now blocks.
    expect(isDeletable('not a number')).toBe(false);
    expect(isDeletable({})).toBe(false);
  });
});
