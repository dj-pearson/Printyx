#!/usr/bin/env node
/**
 * API error-shape ratchet (CR-023).
 *
 * CLAUDE.md documents one error shape for this API:
 *
 *   { "message": "...", "code": "ERROR_CODE", "details": {}, "requestId": "uuid" }
 *
 * The edge functions emit it. Express largely does not: handlers answer with a
 * bare `{ error: '...' }`, so a client cannot branch on `code` and a 500 in a
 * user's screenshot cannot be tied to a log line. `globalErrorHandler` produces
 * the right shape but only for THROWN errors — a handler that calls
 * res.status(500).json(...) itself never reaches it.
 *
 * This counts the responses that answer with an `error` key, per file, and
 * refuses to let the count grow. It is a ratchet rather than a gate because the
 * surface is ~1,900 call sites; converting them is incremental by design and
 * the point is that new ones stop appearing.
 *
 * WHAT IT DOES NOT CATCH, stated so a pass is not read as more than it is:
 * a handler answering `{ message }` with no code and no requestId is out of
 * contract too, but that shape is indistinguishable by grep from a legitimate
 * non-error body, so only the `error` key is counted.
 *
 * Usage:
 *   node scripts/check-error-shape.mjs
 *   node scripts/check-error-shape.mjs --list
 *   node scripts/check-error-shape.mjs --update-baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const baselinePath = join(repo, 'docs', 'error-shape-baseline.json');
const args = process.argv.slice(2);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * `res.status(400).json({ error: ... })` and `res.json({ error: ... })`.
 * Multi-line objects count too: the key is what matters, not the formatting.
 */
const ERROR_SHAPE = /\.json\(\s*\{\s*(?:\/\/[^\n]*\n\s*)*error\s*:/g;

const counts = {};
const sites = [];

for (const file of walk(join(repo, 'server'))) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(repo, file).replace(/\\/g, '/');
  let n = 0;
  for (const match of src.matchAll(ERROR_SHAPE)) {
    n += 1;
    sites.push(`${rel}:${src.slice(0, match.index).split('\n').length}`);
  }
  if (n > 0) counts[rel] = n;
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (args.includes('--list')) {
  for (const site of sites) console.log('  ' + site);
  console.log(
    `${total} response(s) with an \`error\` key across ${Object.keys(counts).length} file(s).`,
  );
  process.exit(0);
}

if (args.includes('--update-baseline')) {
  const previous = existsSync(baselinePath)
    ? (JSON.parse(readFileSync(baselinePath, 'utf8')).counts ?? {})
    : {};
  const previousTotal = Object.values(previous).reduce((a, b) => a + b, 0);
  if (previousTotal > 0 && total > previousTotal) {
    console.error(
      `✗ Refusing to raise the baseline: ${previousTotal} -> ${total}. This ratchet only shrinks.`,
    );
    process.exit(1);
  }
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'CR-023 API error-shape ratchet. CLAUDE.md specifies { message, code, details, requestId } ' +
          'for every error; these responses answer with an `error` key instead, so a client cannot ' +
          'branch on the code and the response cannot be tied to a log line. Convert them with ' +
          'sendError() from server/lib/error-response.ts. Keyed by file so unrelated edits do not ' +
          'renumber entries. Shrink these counts, never grow them.',
        counts,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `✓ Baseline updated: ${total} response(s) across ${Object.keys(counts).length} file(s).`,
  );
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing ${relative(repo, baselinePath)}. Run with --update-baseline first.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')).counts ?? {};
const grown = Object.entries(counts).filter(([file, n]) => n > (baseline[file] ?? 0));
const shrunk = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n);

if (grown.length > 0) {
  console.error('✗ Out-of-contract error responses grew:\n');
  for (const [file, n] of grown) console.error(`    ${file}: ${baseline[file] ?? 0} -> ${n}`);
  console.error(
    '\nThe API error shape is { message, code, details, requestId } — see CLAUDE.md.\n' +
      'Use sendError() (or badRequest/unauthorized/forbidden/notFound/serverError)\n' +
      'from server/lib/error-response.ts instead of res.json({ error }).',
  );
  process.exit(1);
}

const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(
  `✓ No new out-of-contract error responses (${total} known, baseline ${baselineTotal})` +
    (shrunk.length ? `; ${shrunk.length} file(s) improved — tighten with --update-baseline` : '') +
    '.',
);
