#!/usr/bin/env node
/**
 * A request body spread straight into PostgREST (COP-M01).
 *
 * `.update({ ...body, updated_at })` looks like a tidy pass-through and is two
 * defects wearing one line.
 *
 * FIRST, IT DECIDES THE SPELLING OF EVERY FIELD FOR YOU. PostgREST wants column
 * names. If the page sends camelCase - and in this tree most do, because the
 * read paths hand back camelCase through toCamel - every write is a PGRST204
 * and the endpoint reports a 500. `PUT /leads/:id` was exactly this, and it was
 * PRODUCTION-ONLY: /api/leads is not proxied, so dev went through Express and
 * Drizzle, which maps field names to columns. Editing a lead worked on every
 * machine a developer owns and on no deployed one.
 *
 * SECOND, THE BODY CAN SET COLUMNS THE CALLER SHOULD NEVER SET. A
 * `.eq('tenant_id', tenantId)` filter decides WHICH row the write lands on, not
 * what is written into it, so a body carrying `tenant_id` moves the row to
 * another tenant. `id`, `created_by` and audit columns like `converted_by` go
 * the same way. SEC-TENANT-005 covers the filter half of this; the payload half
 * is this guard.
 *
 * THE FIX SHAPE is `supabase/functions/_shared/business-record-write.ts`: an
 * explicit column whitelist, both spellings accepted, unwritable columns
 * refused, and whatever was dropped REPORTED on the response rather than
 * swallowed (COP-B06 - a fallback that quietly narrows a write turns a renamed
 * field into data loss that reports success).
 *
 * WHAT THIS CANNOT SEE, stated so a clean run is not read as proof: a body
 * assigned to another name first (`const payload = await req.json()` then
 * `.update(payload)`), a spread of an object built from the body, and Express
 * handlers, which go through Drizzle and are a different problem. The baseline
 * is a WORKLIST, not settled debt - every entry is the same question, "can this
 * body name a column it should not, and does its caller spell fields the way
 * this table does".
 *
 * Usage:
 *   node scripts/check-raw-body-writes.mjs
 *   node scripts/check-raw-body-writes.mjs --update-baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(repo, 'supabase/functions');
const baselinePath = join(repo, 'docs', 'raw-body-writes-baseline.json');
const update = process.argv.includes('--update-baseline');

/**
 * Line comments before block comments, and the `https://` lookbehind kept -
 * the two mistakes check:shared-helper-imports and check:seo-assets each paid
 * for. A header that quotes the pattern it forbids would otherwise report
 * itself.
 */
function stripComments(src) {
  return src.replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** `.update({ ...body` / `.insert({ ...payload` — the spread must be FIRST in the literal. */
const SPREAD =
  /\.(update|insert|upsert)\(\s*\{\s*\.\.\.\s*(body|payload|data|req\.body|updates|fields)\b/g;

const findings = [];
for (const file of walk(root)) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    SPREAD.lastIndex = 0;
    const match = SPREAD.exec(lines[i]);
    if (!match) continue;
    // The table is on the nearest preceding .from('...') in the same chain.
    let table = 'unknown';
    for (let j = i; j >= Math.max(0, i - 6); j--) {
      const from = /\.from\('([a-z_]+)'\)/.exec(lines[j]);
      if (from) {
        table = from[1];
        break;
      }
    }
    findings.push({
      file: relative(repo, file),
      verb: match[1],
      source: match[2],
      table,
    });
  }
}

const key = (f) => `${f.file}:${f.verb}:${f.table}`;
findings.sort((a, b) => key(a).localeCompare(key(b)));

if (update) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        note:
          'Edge handlers that spread a request body straight into PostgREST. Shrink-only. Each ' +
          'entry is the same question: can this body name a column it should not (tenant_id, id, ' +
          'created_by), and does its caller spell fields the way the table does? See ' +
          'scripts/check-raw-body-writes.mjs and the fix shape in ' +
          '_shared/business-record-write.ts.',
        count: findings.length,
        writes: findings.map(key),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ Baseline written: ${findings.length} raw body write(s).`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`✗ Missing ${baselinePath}. Run with --update-baseline to create it.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const known = new Set(baseline.writes ?? []);
const added = findings.filter((f) => !known.has(key(f)));
const gone = [...known].filter((k) => !findings.some((f) => key(f) === k));

if (added.length > 0) {
  console.error(`✗ ${added.length} new handler(s) spreading a request body into PostgREST:\n`);
  for (const f of added) console.error(`    ${f.file}  .${f.verb}() on ${f.table}`);
  console.error(
    '\n  The body decides its own column names, so a camelCase caller is a PGRST204 the\n' +
      '  moment it runs - and it can name tenant_id, which moves the row to another tenant.\n' +
      '  Map and whitelist it: see supabase/functions/_shared/business-record-write.ts.',
  );
  process.exit(1);
}

console.log(`✓ No new raw body writes (${findings.length} baselined).`);

if (gone.length > 0) {
  console.log(`\n  ${gone.length} baselined write(s) now mapped or gone:`);
  for (const k of gone.sort()) console.log(`    ${k}`);
  console.log('  Tighten: node scripts/check-raw-body-writes.mjs --update-baseline');
}
