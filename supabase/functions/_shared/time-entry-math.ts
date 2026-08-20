// Task timer arithmetic (PROD-008b).
//
// Pure - no imports - so vitest can load it directly. The handler that uses it
// pulls in _shared/http.ts, which is Deno-only, and a test importing that file
// fails at collection before a single assertion runs. Anything worth asserting
// therefore lives here rather than next to the I/O.

/**
 * Minutes elapsed since `startedAt`, rounded to the nearest minute and floored
 * at 1. The floor matches the Express implementation this replaces: a timer
 * started and stopped immediately logs a minute rather than a zero-length
 * entry, which would otherwise show up as an entry that took no time.
 *
 * A missing or unparseable start returns 1 rather than throwing - a stop that
 * cannot compute its duration must still close the entry, or the timer stays
 * running forever.
 */
export function elapsedMinutes(startedAt: string | null | undefined, now: Date): number {
  if (!startedAt) return 1;
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return 1;
  return Math.max(Math.round((now.getTime() - started) / 60000), 1);
}
