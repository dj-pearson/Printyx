/**
 * What KIND of loop this is, from its header and body.
 *
 * Its own module so `server/tests/unit/nplus1-classification.test.ts` can
 * import the real function instead of slicing it out of the report script's
 * source - that slice broke the first time prettier reformatted the script,
 * which is a test failing for a reason that has nothing to do with the code
 * under test. See the header of scripts/report-nplus1-loops.mjs for what each
 * kind means and why only TENANT is worth reporting.
 */
export function classify(head, body) {
  // `for (let offset = 0; ; offset += 1000)` and friends: an index step of more
  // than one is paging or batching either way, never one-query-per-row.
  const step = head.match(/\+=\s*(\d+)/);
  if (step && Number(step[1]) > 1) return 'batching';
  // A named step - `i += METRICS_CONCURRENCY` - is the same shape with the size
  // hoisted to a constant, which is if anything the more deliberate version.
  if (/\+=\s*[A-Z][A-Z0-9_]{2,}\b/.test(head)) return 'batching';
  // A NUMERIC bound: `i < 10`, `i < 6 && frontier.length` - the count is in the
  // source, so it cannot grow with a customer's business.
  if (/;\s*\w+\s*<\s*\d+\s*(?:&&|;)/.test(head)) return 'bounded';
  if (/\boffset\b|\bpage\b|\bcursor\b|hasMore|\.range\(/.test(head)) return 'paging';
  if (/fetchAllRows|\.range\(/.test(body)) return 'paging';
  if (/\bchunk\(|\bbatch(es)?\b|slice\(\s*i\s*,/.test(head)) return 'batching';
  if (/\battempt|\bretry|\btries\b/i.test(head)) return 'retry';
  // A literal array, an Object.entries over a literal, or a constant the file
  // declares: the count cannot grow with a customer's business.
  if (/of\s*\[|Object\.(entries|keys|values)\(\s*\{/.test(head)) return 'bounded';
  const name = head.match(/of\s+([A-Z][A-Z0-9_]*)\b/);
  if (name) return 'bounded';
  return 'TENANT';
}
