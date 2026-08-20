// Journal-entry input contract (PROD-008).
//
// The same rules ran in two places and disagreed. Express (server/routes-financial.ts)
// validated a HEADER-level entry - entryNumber, description, entryDate, header
// debit/credit totals - and required debits to equal credits. The journal-entries
// edge function, which is what production actually executes, instead summed a
// `lineItems` array the frontend never sends: totals came out 0/0, the balance
// check passed trivially, and every entry created in production was written with
// total_debit = 0 and total_credit = 0. The amounts the user typed were discarded.
//
// journal_entry_lines does not exist in any schema or migration, so the
// line-item model the edge function assumed was never real. This module is the
// one contract, kept pure so Deno and vitest can both hold it, and locked to the
// Express zod schema by server/tests/unit/journal-entry-contract-parity.test.ts.

export type JournalEntryInput = {
  entryNumber: string;
  description: string;
  entryDate: string;
  reference?: string;
  totalDebit: number;
  totalCredit: number;
  status: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  // `errors` is keyed by field, matching what Express puts on the wire
  // (error.flatten().fieldErrors). `formErrors` carries whole-body complaints,
  // which zod reports with an EMPTY fieldErrors - so a non-object body must not
  // produce per-field errors here either, or the two responses diverge.
  | { ok: false; errors: Record<string, string[]>; formErrors?: string[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Mirrors z.coerce.number(): Number(input), then reject anything not finite.
// The edge cases matter - Number('') and Number(null) are both 0, which is a
// legitimate zero total, while Number(undefined) and Number('abc') are NaN.
function coerceNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value === undefined) return NaN;
  return Number(value as any);
}

function requireString(
  value: unknown,
  field: string,
  message: string,
  errors: Record<string, string[]>,
): string | undefined {
  if (typeof value !== 'string') {
    push(errors, field, 'Expected string, received ' + typeName(value));
    return undefined;
  }
  if (value.length < 1) {
    push(errors, field, message);
    return undefined;
  }
  return value;
}

function typeName(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function push(errors: Record<string, string[]>, field: string, message: string) {
  (errors[field] ??= []).push(message);
}

function amount(
  value: unknown,
  field: string,
  errors: Record<string, string[]>,
): number | undefined {
  const n = coerceNumber(value);
  if (!Number.isFinite(n)) {
    push(errors, field, 'Expected number, received ' + typeName(value));
    return undefined;
  }
  if (n < 0) {
    push(errors, field, 'Number must be greater than or equal to 0');
    return undefined;
  }
  return n;
}

/** Debits and credits agree to within half a cent. */
export function isBalanced(totalDebit: number, totalCredit: number): boolean {
  return Math.abs(totalDebit - totalCredit) < 0.005;
}

/** Full-entry validation, for POST. Rejects unbalanced entries. */
export function parseJournalEntry(body: unknown): ValidationResult<JournalEntryInput> {
  if (!isPlainObject(body)) {
    return { ok: false, errors: {}, formErrors: ['Expected object, received ' + typeName(body)] };
  }
  const errors: Record<string, string[]> = {};
  const b = body;

  const entryNumber = requireString(
    b.entryNumber,
    'entryNumber',
    'Entry number is required',
    errors,
  );
  const description = requireString(
    b.description,
    'description',
    'Description is required',
    errors,
  );
  const entryDate = requireString(b.entryDate, 'entryDate', 'Entry date is required', errors);

  let reference: string | undefined;
  if (b.reference !== undefined) {
    if (typeof b.reference !== 'string') {
      push(errors, 'reference', 'Expected string, received ' + typeName(b.reference));
    } else {
      reference = b.reference;
    }
  }

  const totalDebit = amount(b.totalDebit, 'totalDebit', errors);
  const totalCredit = amount(b.totalCredit, 'totalCredit', errors);

  let status = 'draft';
  if (b.status !== undefined) {
    if (typeof b.status !== 'string') {
      push(errors, 'status', 'Expected string, received ' + typeName(b.status));
    } else {
      status = b.status;
    }
  }

  // The balance rule runs only once both totals are themselves valid, matching
  // zod's .refine() - a refinement never sees a value that failed its schema.
  if (
    Object.keys(errors).length === 0 &&
    totalDebit !== undefined &&
    totalCredit !== undefined &&
    !isBalanced(totalDebit, totalCredit)
  ) {
    push(errors, 'totalCredit', 'Total debits must equal total credits');
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      entryNumber: entryNumber as string,
      description: description as string,
      entryDate: entryDate as string,
      reference,
      totalDebit: totalDebit as number,
      totalCredit: totalCredit as number,
      status,
    },
  };
}

/**
 * Partial validation, for PATCH. Every field optional; NO balance rule, matching
 * Express, which applies .partial() to the fields schema and so drops the
 * refinement with it. A patch that leaves an entry unbalanced is accepted by
 * both - noted here because it looks like an oversight and is load-bearing
 * parity, not something to "fix" on one side only.
 */
export function parseJournalEntryPatch(
  body: unknown,
): ValidationResult<Partial<JournalEntryInput>> {
  if (!isPlainObject(body)) {
    return { ok: false, errors: {}, formErrors: ['Expected object, received ' + typeName(body)] };
  }
  const errors: Record<string, string[]> = {};
  const b = body;
  const out: Partial<JournalEntryInput> = {};

  for (const [field, message] of [
    ['entryNumber', 'Entry number is required'],
    ['description', 'Description is required'],
    ['entryDate', 'Entry date is required'],
  ] as const) {
    if (b[field] === undefined) continue;
    const v = requireString(b[field], field, message, errors);
    if (v !== undefined) out[field] = v;
  }

  for (const field of ['reference', 'status'] as const) {
    if (b[field] === undefined) continue;
    if (typeof b[field] !== 'string') {
      push(errors, field, 'Expected string, received ' + typeName(b[field]));
    } else {
      out[field] = b[field] as string;
    }
  }

  for (const field of ['totalDebit', 'totalCredit'] as const) {
    if (b[field] === undefined) continue;
    const n = amount(b[field], field, errors);
    if (n !== undefined) out[field] = n;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: out };
}

/**
 * camelCase input -> the real journal_entries columns. The table is the flat
 * header-level model in shared/journal-entries-schema.ts; there is no
 * posted_at, posted_by or original_entry_id, which is what the edge function's
 * post and reverse handlers were writing.
 */
export function toJournalEntryColumns(input: Partial<JournalEntryInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.entryNumber !== undefined) row.entry_number = input.entryNumber;
  if (input.description !== undefined) row.description = input.description;
  if (input.entryDate !== undefined) row.entry_date = input.entryDate;
  if (input.reference !== undefined) row.reference = input.reference;
  if (input.status !== undefined) row.status = input.status;
  // numeric(14,2) columns: Express sends String(n), and PostgREST is given the
  // same so a value never round-trips through a float in one path and not the
  // other.
  if (input.totalDebit !== undefined) row.total_debit = String(input.totalDebit);
  if (input.totalCredit !== undefined) row.total_credit = String(input.totalCredit);
  return row;
}
