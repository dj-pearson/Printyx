#!/usr/bin/env node
/**
 * check-edge-path-normalization.mjs — edge-function routing ratchet.
 *
 * THE INVARIANT: an edge handler never sees its own name in the path.
 * supabase/functions/server.ts (the Coolify dispatcher) resolves the function from URL
 * segment 0 and then STRIPS it (`stripSegments = 1`; it rewrites the path to
 * `'/' + pathParts.slice(1).join('/')`) before invoking the handler. So a request to
 * functions.printyx.net/seo/settings arrives at the handler as `/settings`.
 *
 * Therefore reading the resource out of index [1] of a raw split:
 *
 *     const pathParts = url.pathname.split('/').filter(Boolean);
 *     const resource = pathParts[1];   // <-- undefined in production
 *
 * makes every `resource === '...'` guard false and the function 404s on EVERY route.
 * The fix is one line — the idempotent helper, which strips an OPTIONAL prefix so the
 * routes resolve whether the segment is present or already stripped:
 *
 *     const { parts } = normalizePath(url.pathname, 'seo');
 *     const resource = parts[0];
 *
 * This class of bug is INVISIBLE IN DEV: if the prefix is not in crmProxies, Express
 * serves it locally and the edge function is never exercised. seo and deal-desk were
 * each 404ing on every endpoint in production and nothing caught it.
 *
 * Usage:
 *   node scripts/check-edge-path-normalization.mjs                  # check (CI)
 *   node scripts/check-edge-path-normalization.mjs --update-baseline
 *   node scripts/check-edge-path-normalization.mjs --list
 *
 * ── Detection, and why it is shaped this way ────────────────────────────────
 * Grepping for `pathParts[1]` alone OVER-REPORTS by ~48x: it is perfectly correct in a
 * function that reads [0] as the resource (right, post-strip) and [1] as an id — e.g.
 * `deals` does `const dealId = pathParts[0]; const subResource = pathParts[1]`. Keying
 * on a COMMENT that asserts pathParts[0] is the fn's own name UNDER-reports (most
 * offenders have no such comment).
 *
 * The real signature is: the file splits the pathname itself, reads index >= 1, and
 * NEVER reads index 0 — i.e. it believes segment 0 is its own name. That is what this
 * checks. It is a heuristic, not a parser; a function doing something exotic with the
 * path may need an allowlist entry with a note.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const fnsDir = join(repo, 'supabase', 'functions');
const baselinePath = join(repo, 'docs', 'edge-path-normalization-baseline.json');

const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

function stripComments(src) {
  // Line comments first (a "/*" inside a line comment would otherwise open a phantom
  // block), and preserve line count so any future line reporting stays honest.
  return src
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

function scan() {
  const offenders = [];
  const migrated = [];

  for (const entry of readdirSync(fnsDir)) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue;
    const dir = join(fnsDir, entry);
    if (!statSync(dir).isDirectory()) continue;
    const index = join(dir, 'index.ts');
    if (!existsSync(index)) continue;

    const src = stripComments(readFileSync(index, 'utf8'));

    if (/\bnormalizePath\s*\(/.test(src)) {
      migrated.push(entry);
      continue;
    }

    // Does it split the pathname itself?
    const splitsPath =
      /\.pathname\s*\.?\s*\n?\s*\.split\(/.test(src) || /pathname\.split\(/.test(src);
    if (!splitsPath) continue;

    // Find the variable the split is assigned to, e.g. `const pathParts = ...split('/')`.
    const m = src.match(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*pathname\s*\.split\(/);
    const varName = m ? m[1] : 'pathParts';
    const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const readsZero = new RegExp(`\\b${esc}\\[0\\]`).test(src);
    const readsHigher = new RegExp(`\\b${esc}\\[[1-9]\\d*\\]`).test(src);

    // Reads >= 1 but never 0 => it believes segment 0 is its own function name.
    if (readsHigher && !readsZero) {
      offenders.push(entry);
    }
  }

  offenders.sort();
  migrated.sort();
  return { offenders, migrated };
}

const { offenders, migrated } = scan();

if (list) {
  console.log(`Edge functions NOT using normalizePath and reading [1+] but never [0]`);
  console.log(
    `(= assuming their own prefix survives server.ts's strip → 404 on every route in prod)\n`,
  );
  for (const o of offenders) console.log(`  ${o}`);
  console.log(
    `\n${offenders.length} suspected / ${migrated.length} migrated / ${offenders.length + migrated.length} total`,
  );
  console.log(
    `\nNOTE: static heuristic. Verify against a deploy (one curl per prefix) before\n` +
      `budgeting remediation — some of these functions may be dead.`,
  );
  process.exit(0);
}

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'Edge path-normalization ratchet. scripts/check-edge-path-normalization.mjs fails CI when a NEW edge ' +
          'function reads its path from index [1+] of a raw pathname split without ever reading [0] — i.e. assumes ' +
          "its own name survives server.ts's stripSegments=1, which 404s every route in production (invisible in " +
          'dev when the prefix is not in crmProxies). Entries here are the pre-existing suspects. Shrink this list, ' +
          'never grow it: migrate a function to normalizePath (one line + an import), then re-run with ' +
          '--update-baseline. Suspected-broken is a STATIC heuristic — verify against a deploy before trusting it.',
        suspected: offenders,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `✓ Baseline updated: ${offenders.length} suspected, ${migrated.length} already migrated.`,
  );
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(
    `✗ Missing ${baselinePath}. Run: node scripts/check-edge-path-normalization.mjs --update-baseline`,
  );
  process.exit(1);
}

const allowed = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).suspected);
const novel = offenders.filter((o) => !allowed.has(o));

if (novel.length > 0) {
  console.error(
    `✗ ${novel.length} edge function(s) newly read their path from [1+] without normalizePath:\n`,
  );
  for (const n of novel) console.error(`  supabase/functions/${n}/index.ts`);
  console.error(
    `\nAn edge handler never sees its own name: server.ts strips the function-name segment\n` +
      `before invoking it, so index [1] is undefined and EVERY route 404s in production.\n` +
      `This will NOT show up in dev if the prefix is not in crmProxies.\n\n` +
      `Fix (one line):\n` +
      `  import { normalizePath } from '../_shared/path.ts';\n` +
      `  const { parts } = normalizePath(url.pathname, '<function-name>');\n` +
      `  const resource = parts[0];\n`,
  );
  process.exit(1);
}

const fixed = [...allowed].filter((a) => !offenders.includes(a));
if (fixed.length > 0) {
  console.log(
    `✓ No new un-normalized edge functions. ${fixed.length} baselined function(s) now migrated:`,
  );
  for (const f of fixed) console.log(`    ${f}`);
  console.log('  Tighten with: node scripts/check-edge-path-normalization.mjs --update-baseline');
} else {
  console.log(
    `✓ No new un-normalized edge functions (${offenders.length} known, ${migrated.length} migrated).`,
  );
}
