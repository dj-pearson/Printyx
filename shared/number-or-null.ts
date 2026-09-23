/**
 * A numeric column read off PostgREST (which returns numerics as strings):
 * null when absent, empty or not a number, and a real 0 stays 0. The usual
 * `parseInt(x) || 50` spelling turns 0 into the default, which is how a 0%
 * probability read as 50%.
 */
export function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
