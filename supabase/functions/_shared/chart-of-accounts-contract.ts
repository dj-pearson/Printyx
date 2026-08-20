// Chart-of-accounts write contract (PROD-008).
//
// The update handler did `.update({ ...body })` with the request body spread in
// raw. ChartOfAccounts.tsx sends camelCase - accountCode, accountName,
// accountType, accountSubtype, parentAccountId, isActive - and none of those is
// a column, so every update was a PostgREST schema error. It never surfaced
// because the page also sends PATCH while only PUT was implemented, so the
// request 404'd before it could reach the broken update.
//
// Mapping camelCase to columns explicitly, rather than spreading, is the fix for
// both: an unknown key is dropped instead of failing the whole statement.
// Kept pure so Deno and vitest both load it.

/** The real chart_of_accounts columns a client is allowed to write. */
const FIELD_TO_COLUMN: Record<string, string> = {
  accountCode: 'account_code',
  account_code: 'account_code',
  // Older callers said accountNumber. There is no account_number column - it was
  // one of the four phantom names in the create payload - so it maps to
  // account_code rather than being dropped.
  accountNumber: 'account_code',
  account_number: 'account_code',
  accountName: 'account_name',
  account_name: 'account_name',
  accountType: 'account_type',
  account_type: 'account_type',
  accountSubtype: 'account_subtype',
  account_subtype: 'account_subtype',
  subType: 'account_subtype',
  sub_type: 'account_subtype',
  parentAccountId: 'parent_account_id',
  parent_account_id: 'parent_account_id',
  description: 'description',
  isActive: 'is_active',
  is_active: 'is_active',
  level: 'level',
};

/**
 * Columns a client must never set directly: balances are derived from posted
 * journal activity, and is_system marks seeded accounts.
 */
export const SERVER_OWNED_COLUMNS = [
  'id',
  'tenant_id',
  'current_balance',
  'debit_balance',
  'credit_balance',
  'is_system',
  'created_at',
  'updated_at',
];

export type AccountWrite = {
  columns: Record<string, unknown>;
  /** Keys that matched no column, echoed back so a caller can see what was dropped. */
  ignored: string[];
};

/**
 * camelCase (or snake_case) input -> columns. Empty strings on the optional
 * text fields become null: the form submits '' for an unset parent account,
 * and '' is not a valid parent_account_id.
 */
export function toAccountColumns(body: unknown): AccountWrite {
  const columns: Record<string, unknown> = {};
  const ignored: string[] = [];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { columns, ignored };
  }

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    const column = FIELD_TO_COLUMN[key];
    if (!column) {
      ignored.push(key);
      continue;
    }
    if (column === 'is_active') {
      columns[column] = value !== false;
    } else if (
      (column === 'parent_account_id' ||
        column === 'account_subtype' ||
        column === 'description') &&
      (value === '' || value === undefined)
    ) {
      columns[column] = null;
    } else {
      columns[column] = value;
    }
  }
  return { columns, ignored };
}

export type AccountValidation = { ok: true } | { ok: false; errors: Record<string, string[]> };

/**
 * Create-time required fields, matching the form schema in
 * ChartOfAccounts.tsx: account code, name and type are all min(1).
 */
export function validateNewAccount(columns: Record<string, unknown>): AccountValidation {
  const errors: Record<string, string[]> = {};
  const required: Array<[string, string, string]> = [
    ['account_code', 'accountCode', 'Account code is required'],
    ['account_name', 'accountName', 'Account name is required'],
    ['account_type', 'accountType', 'Account type is required'],
  ];
  for (const [column, field, message] of required) {
    const value = columns[column];
    if (typeof value !== 'string' || value.length < 1) errors[field] = [message];
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * An account may be deleted only when it carries no balance. The guard used to
 * read `balance`, which is not a column, so the value was always undefined and
 * the check NEVER fired - an account holding money could be deleted outright.
 * A null balance is a real zero (the column defaults to '0'); an unparseable
 * one is not, and blocks.
 */
export function isDeletable(currentBalance: unknown): boolean {
  if (currentBalance === null || currentBalance === undefined) return true;
  const n = Number(currentBalance);
  return Number.isFinite(n) && n === 0;
}
