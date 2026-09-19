#!/usr/bin/env node
/**
 * A write to a credential column of `integration_credentials` must go through
 * the vault (SEC-CRED-VAULT-001 AC6). Hard gate at zero.
 *
 * The five columns - api_key, api_secret, access_token, refresh_token,
 * webhook_secret - were plaintext from migration 0000 while the schema comment
 * above them said "encrypted at application level". Nothing said otherwise
 * because nothing looked: tsc sees a string going into a text column and has no
 * opinion, and an edge function names the column in a STRING, so even the
 * phantom-column guard only cares that it exists.
 *
 * WHAT IS CHECKED, and the rule is deliberately about the WRITE rather than the
 * file: a file that writes any of those five columns must also name the
 * envelope module. It is a coarse rule on purpose. A precise one would have to
 * follow the value from the request body to the insert through whatever helper
 * assembles the payload, which is the same dataflow `check:insert-tenant-id`
 * gave up on and started counting instead; here the file-level rule is exact
 * enough because there are five writers in the whole tree and each one is a few
 * lines long.
 *
 * WHAT IT CANNOT SEE: a payload built in one file and written in another, and a
 * raw SQL string naming the table (CR-017's blind spot - there are none today,
 * and this reports any it finds as a separate finding rather than pretending to
 * check them).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const COLUMNS = ['api_key', 'api_secret', 'access_token', 'refresh_token', 'webhook_secret'];
const FIELDS = ['apiKey', 'apiSecret', 'accessToken', 'refreshToken', 'webhookSecret'];
const VAULT = 'credential-envelope';
const TABLE = 'integration_credentials';
const DRIZZLE_TABLE = 'integrationCredentials';

const SCAN_DIRS = ['server', 'supabase/functions', 'scripts', 'client/src'];
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

/** Blank comments so a header explaining the rule is never read as code. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
const unvaulted = [];
const rawSql = [];

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel.includes('credential-envelope')) continue; // the vault itself
  if (rel.startsWith('server/tests/')) continue; // tests construct payloads on purpose

  const raw = readFileSync(file, 'utf8');
  if (!raw.includes(TABLE) && !raw.includes(DRIZZLE_TABLE)) continue;
  const src = stripComments(raw);
  if (!src.includes(TABLE) && !src.includes(DRIZZLE_TABLE)) continue;

  const vaulted = src.includes(VAULT);

  // A raw SQL string naming the table is invisible to every column rule here.
  if (!vaulted) {
    for (const m of src.matchAll(new RegExp(`(INSERT\\s+INTO|UPDATE)\\s+"?${TABLE}"?`, 'gi'))) {
      rawSql.push({ rel, line: src.slice(0, m.index).split('\n').length, text: m[0] });
    }
  }

  const writes = [];
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    for (const col of COLUMNS) {
      if (new RegExp(`['"\`]?${col}['"\`]?\\s*:`).test(line)) writes.push({ line: i + 1, col });
    }
    for (const field of FIELDS) {
      if (new RegExp(`\\b${field}\\s*:`).test(line)) writes.push({ line: i + 1, col: field });
    }
  });
  if (writes.length === 0) continue;
  if (vaulted) continue;

  for (const w of writes) unvaulted.push({ rel, ...w });
}

let failed = false;

if (unvaulted.length > 0) {
  failed = true;
  console.error(
    `\ncheck:credential-vault FAILED - ${unvaulted.length} credential write(s) that do not go through ${VAULT}:\n`,
  );
  for (const u of unvaulted) console.error(`  ${u.rel}:${u.line}  ${u.col}`);
  console.error(
    '\nEncrypt with encryptSecret / encryptCredentialFields / encryptCredentialColumns before the write,',
  );
  console.error('or read with readSecret. See server/services/credential-envelope.ts.\n');
}

if (rawSql.length > 0) {
  failed = true;
  console.error(`\ncheck:credential-vault FAILED - raw SQL writes to ${TABLE}:\n`);
  for (const r of rawSql) console.error(`  ${r.rel}:${r.line}  ${r.text}`);
  console.error(
    '\nA table name inside a string literal is invisible to the column rule above (CR-017).',
  );
  console.error('Write through Drizzle or PostgREST so the vault is on the path.\n');
}

if (failed) process.exit(1);

console.log(
  `check:credential-vault OK - every writer of ${TABLE}'s credential columns goes through the vault.`,
);
