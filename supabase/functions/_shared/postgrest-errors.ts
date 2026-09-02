/**
 * PostgREST error classification.
 *
 * PostgREST does not throw. On failure it leaves `.data` null and puts the
 * reason in `.error`, so code that destructures only `data` and falls back to
 * `?? []` turns a missing relation into an empty list. That is how several
 * edge functions came to report "no results" for a table that has never
 * existed. Classify the error and say so instead.
 *
 * `isMissingTableError` was copied into `billing/handlers/_context.ts` and
 * `customer-portal/handlers/_context.ts` before this module existed; both now
 * re-export from here so the predicate has one definition.
 */

type PostgrestErrorLike = { code?: string; message?: string } | null | undefined;

/** 42P01 (undefined_table) from Postgres, PGRST205 (unknown relation) from PostgREST's schema cache. */
export function isMissingTableError(error: unknown): boolean {
  const e = error as PostgrestErrorLike;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  const msg = (e.message || '').toLowerCase();
  return msg.includes('could not find the table') || msg.includes('does not exist');
}

/**
 * 23505 (unique_violation) — the row is already there under that key.
 *
 * WF-L-04 wants this told apart from a real failure: `equipment.serial_number` is
 * globally unique, so a warehouse associate re-keying a serial they already
 * entered gets a refusal that is an ANSWER, not a fault, and the receipt should
 * say "already registered" rather than "could not be created".
 */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as PostgrestErrorLike;
  if (!e) return false;
  if (e.code === '23505') return true;
  const msg = (e.message || '').toLowerCase();
  return msg.includes('duplicate key value') || msg.includes('already exists');
}

/** 42703 (undefined_column) / PGRST204 — the write named a column the table does not have. */
export function isMissingColumnError(error: unknown): boolean {
  const e = error as PostgrestErrorLike;
  if (!e) return false;
  if (e.code === '42703' || e.code === 'PGRST204') return true;
  const msg = (e.message || '').toLowerCase();
  return msg.includes('could not find the') && msg.includes('column');
}
