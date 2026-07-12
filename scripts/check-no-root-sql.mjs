#!/usr/bin/env node
/**
 * PA-033 guard: fail if any *.sql file is tracked at the repo root.
 *
 * SQL schema changes belong in the versioned migration chain
 * (drizzle/migrations/) or the RLS set (drizzle/rls/) — never as ad-hoc root
 * scripts, which caused the schema-of-record drift the audit found. Legacy
 * one-offs are archived under scripts/legacy-sql/.
 */
import { execSync } from 'node:child_process';

let tracked = [];
try {
  tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch (err) {
  console.error('check-no-root-sql: could not list git files:', err.message);
  process.exit(2);
}

// Root-level (no slash in the path) .sql files.
const offenders = tracked.filter((f) => !f.includes('/') && f.toLowerCase().endsWith('.sql'));

if (offenders.length > 0) {
  console.error('\n✗ SQL files must not live at the repo root:\n');
  for (const f of offenders) console.error('  - ' + f);
  console.error(
    '\nMove schema changes into drizzle/migrations/ (npm run db:generate) or\n' +
      'drizzle/rls/, or archive one-offs under scripts/legacy-sql/.\n',
  );
  process.exit(1);
}

console.log('✓ No *.sql files at the repo root.');
