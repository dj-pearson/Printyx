#!/usr/bin/env node
/**
 * PA-011 guard: fail if any database table dump is tracked in git.
 *
 * These files (named like `<table>_rows.csv` / `<table>_rows.sql`, the export
 * shape produced by Supabase/pgAdmin "export rows") routinely carry real
 * customer PII and must never live in the repository. This runs in CI so a
 * dump can't be re-committed after the history purge.
 */
import { execSync } from 'node:child_process';

// Table-export naming only — precise enough to avoid flagging legitimate
// template/fixture CSVs (e.g. product_accessories_template.csv).
const BLOCKED = /(^|\/)[^/]*_rows\.(csv|sql)$/i;

let tracked = [];
try {
  tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch (err) {
  console.error('check-no-data-dumps: could not list git files:', err.message);
  process.exit(2);
}

const offenders = tracked.filter((f) => BLOCKED.test(f));

if (offenders.length > 0) {
  console.error('\n✗ Database table dumps must not be committed (may contain PII):\n');
  for (const f of offenders) console.error('  - ' + f);
  console.error(
    '\nRemove them (`git rm`) and keep them out of git. They are ignored via .gitignore.\n',
  );
  process.exit(1);
}

console.log('✓ No database table dumps tracked in git.');
