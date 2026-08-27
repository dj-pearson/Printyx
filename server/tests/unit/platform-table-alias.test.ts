/**
 * QUALITY-002: importing a platform_* table under the name of the tenant table
 * it resembles.
 *
 * shared/platform-crm-schema.ts holds the ROOT-ADMIN CRM tables. None of them
 * has a tenant_id column. shared/lead-scoring-schema.ts and
 * shared/lead-assignment-schema.ts hold tenant-scoped tables with almost the
 * same export names, so `platformRepCapacity as repCapacity` compiles, reads
 * naturally, and filters by a column that is not there — a 42703 on every
 * request.
 *
 * It happened twice: auto-lead-routing-service and the router that drives it.
 * Both are fixed. This stops a third.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['server', 'client/src', 'supabase/functions'];

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  (function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (!/node_modules|dist|\.git/.test(p)) walk(p);
      } else if (/\.tsx?$/.test(p)) out.push(p);
    }
  })(dir);
  return out;
}

/** `platformFoo as foo` in an import list, comments excluded. */
const ALIAS = /\bplatform[A-Z]\w*\s+as\s+[a-z]\w*/g;

const offenders: string[] = [];
for (const root of ROOTS) {
  for (const file of sourceFiles(root)) {
    // This file carries the pattern in its own assertions.
    if (file.endsWith('platform-table-alias.test.ts')) continue;
    const source = fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    for (const m of source.matchAll(ALIAS)) offenders.push(`${file}: ${m[0]}`);
  }
}

describe('platform_* tables are not aliased to tenant names', () => {
  it('no file imports a platform table under a lowercase alias', () => {
    expect(offenders).toEqual([]);
  });

  // Guard the guard: the pattern must still match the shape it was written for.
  it('the pattern recognises the alias it exists to catch', () => {
    expect('platformRepCapacity as repCapacity').toMatch(ALIAS);
    expect('platformLeadScoringRules as leadScoringRules').toMatch(ALIAS);
  });

  // A platform table imported under its OWN name is correct and common.
  it('does not object to an un-aliased platform import', () => {
    expect('import { platformRepCapacity } from ...').not.toMatch(ALIAS);
  });
});
