#!/usr/bin/env node
/**
 * Edge-path coverage guard (PROD-014).
 *
 * A domain can have an edge function and still 404 in production on most of
 * what the frontend calls it for. `check:routes` classifies per DOMAIN, so it
 * reports such a domain as "both divergent" and moves on. This looks INSIDE the
 * domain: for every literal sub-path a reachable client file calls
 * (/api/<domain>/<segment>), does that segment appear anywhere in the domain's
 * edge function source?
 *
 * A segment that appears nowhere is not proof of a 404 — a handler could
 * dispatch on a variable — but every real defect found this way had the same
 * shape, and the shape is worse than a 404 when the request falls through to a
 * generic branch instead:
 *
 *   DELETE /product-models/bulk-delete  -> delete where id = 'bulk-delete'
 *   POST   /invoices/bulk-delete        -> the CREATE-invoice branch
 *
 * `id` is a varchar, so the first matched no row, PostgREST reported no error,
 * and the user was told the bulk delete succeeded.
 *
 * Ratchet, not a gate: docs/edge-path-coverage-baseline.json records what is
 * known. The check fails on anything NEW and reports what has been resolved.
 *
 *   node scripts/check-edge-path-coverage.mjs [--update-baseline] [--list]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeParity } from './lib/route-parity.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repo, 'docs/edge-path-coverage-baseline.json');

/**
 * Source with comments removed.
 *
 * Scanning raw text was the first version and it was wrong: the comment ABOVE
 * a branch usually names the very path the branch handles, so renaming the
 * branch and leaving the comment kept the check green. Verified by mutation —
 * with comments included, renaming 'bulk-delete' to 'bulkDelete' passed.
 *
 * String state is tracked so a `//` inside a URL or a quoted path is not read
 * as the start of a comment.
 */
function stripComments(src) {
  let out = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += src[++i] ?? '';
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Concatenated, comment-stripped .ts source of an edge function directory. */
function readDirSrc(dir) {
  let out = '';
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out += readDirSrc(p);
    else if (p.endsWith('.ts')) out += stripComments(readFileSync(p, 'utf8'));
  }
  return out;
}

/** Segments that are never a route: template holes and path variables. */
function isLiteralSegment(segment) {
  return /^[a-z0-9][a-z0-9-]*$/.test(segment);
}

export function computeCoverageGaps() {
  const parity = computeParity(repo);
  const gaps = {};

  for (const row of parity.rows) {
    if (!row.edge || !row.frontendLive) continue;
    const dir = join(repo, 'supabase/functions', row.domain);
    if (!existsSync(dir)) continue;
    const src = readDirSrc(dir);

    const segments = new Set();
    for (const file of row.callers.live) {
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const re = new RegExp(`['"\`]/api/${row.domain}/([^'"\`?\\s/]+)`, 'g');
      for (const m of text.matchAll(re)) {
        if (isLiteralSegment(m[1])) segments.add(m[1]);
      }
    }

    const missing = [...segments]
      .filter((s) => !src.includes(`'${s}'`) && !src.includes(`"${s}"`) && !src.includes('`' + s))
      .sort();
    if (missing.length) gaps[row.domain] = missing;
  }

  return gaps;
}

function flatten(gaps) {
  return new Set(Object.entries(gaps).flatMap(([d, segs]) => segs.map((s) => `${d}/${s}`)));
}

const args = process.argv.slice(2);
const gaps = computeCoverageGaps();

if (args.includes('--list')) {
  for (const [domain, segments] of Object.entries(gaps).sort()) {
    console.log(`${domain}: ${segments.join(', ')}`);
  }
  const total = [...flatten(gaps)].length;
  console.log(`\n${Object.keys(gaps).length} domain(s), ${total} path(s).`);
  process.exit(0);
}

if (args.includes('--update-baseline')) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'Literal /api/<domain>/<segment> paths a reachable client file calls whose segment ' +
          "appears nowhere in that domain's edge function. Likely prod-only 404s, or worse — " +
          'a request that falls through to a generic :id branch. Do not grow this list; see ' +
          'scripts/check-edge-path-coverage.mjs.',
        gaps,
      },
      null,
      2,
    ) + '\n',
  );
  const total = [...flatten(gaps)].length;
  console.log(`Baseline updated: ${Object.keys(gaps).length} domain(s), ${total} path(s).`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`No baseline at ${baselinePath}. Create one with --update-baseline.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')).gaps ?? {};
const known = flatten(baseline);
const current = flatten(gaps);

const added = [...current].filter((p) => !known.has(p)).sort();
const resolved = [...known].filter((p) => !current.has(p)).sort();

if (added.length) {
  console.error(
    `✗ ${added.length} NEW frontend path(s) with no matching segment in the edge function:`,
  );
  for (const p of added) console.error(`    /api/${p}`);
  console.error(
    '\n  Either implement the branch, or — if the handler dispatches on a variable — confirm it\n' +
      '  resolves and re-baseline with: node scripts/check-edge-path-coverage.mjs --update-baseline',
  );
  process.exit(1);
}

if (resolved.length) {
  console.log(`ℹ ${resolved.length} baselined path(s) now resolve:`);
  for (const p of resolved.slice(0, 12)) console.log(`    /api/${p}`);
  if (resolved.length > 12) console.log(`    …and ${resolved.length - 12} more`);
  console.log('  Tighten with: node scripts/check-edge-path-coverage.mjs --update-baseline');
}

console.log(
  `✓ No new edge-path coverage gaps (${known.size} baselined across ${Object.keys(baseline).length} domain(s)).`,
);
