/**
 * SEC-001: SQL Injection Prevention Tests
 *
 * Validates that vulnerable SQL patterns have been remediated across the codebase.
 * These tests scan actual source files for known-bad patterns to prevent regression.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SERVER_DIR = path.resolve(__dirname, '..', '..');

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(SERVER_DIR, relativePath), 'utf-8');
}

function countMatches(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

/** Every .ts under server/, so a property is checked on the tree rather than on one named file. */
function walkServer(dir: string = SERVER_DIR, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'tests') continue;
      walkServer(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('SEC-001: SQL Injection Prevention', () => {
  // NOTE: The former `routes-sales-pipeline.ts` describe block was removed when
  // the file was migrated to supabase/functions/sales-pipeline/ and the complex
  // SQL moved to parameterized Postgres functions in drizzle/functions/sales-pipeline.sql.
  // Edge-function SQL runs via .rpc() with typed parameters — no string
  // interpolation, so the injection surface is gone.

  // Eight of the ten reporting services this block scanned are DELETED (CR-017
  // follow-on): director, executive, sales, sales-manager, sales-supervisor,
  // service, service-manager and team. They were orphans - nothing in any tree
  // imported them but this test - and supabase/functions/reports/ says so in its
  // own headers ("Replaces server/routes/<x>-reports-api.ts + server/services/
  // <x>-reporting-service.ts"). Six of the eight also queried activities, quotas,
  // sales_quotas or parts_usage, tables that exist in no schema and no migration.
  //
  // The injection surface went with them. The reports edge function builds every
  // query through PostgREST's builder - no sql.raw, no ARRAY literal assembled
  // from a string, no interpolation - which is the same reason the
  // routes-sales-pipeline block above was removed rather than repointed.
  //
  // Two services survive because server/services/team-alert-service.ts calls
  // their getTeamQuickStats: warehouse and service-supervisor. That cluster is
  // itself unreachable (nothing imports team-alert-service either) and is
  // annotated rather than deleted, per PROD-008c. service-supervisor is the one
  // of the two that carried raw SQL, so it stays under this guard.
  describe('HIGH: Reporting services - No ARRAY construction via sql.raw()', () => {
    const reportingServices = ['services/service-supervisor-reporting-service.ts'];

    for (const service of reportingServices) {
      it(`${service} should not use sql.raw() to construct ARRAY literals`, () => {
        const content = readFile(service);
        // Pattern: sql.raw(`ARRAY[${ids.map(...).join(...)}]`)
        const arrayRawPattern = /sql\.raw\s*\(\s*`?\s*ARRAY\s*\[/gi;
        const matches = countMatches(content, arrayRawPattern);
        expect(matches).toBe(0);
      });

      it(`${service} should not use .map() with string quoting inside sql.raw()`, () => {
        const content = readFile(service);
        // Pattern: .map((id) => `'${id}'`).join(',')
        const mapQuotePattern = /\.map\s*\([^)]*\)\s*=>\s*`'?\$\{[^}]+\}'?`\s*\)\s*\.join/g;
        const matches = countMatches(content, mapQuotePattern);
        expect(matches).toBe(0);
      });
    }
  });

  describe('MEDIUM: INTERVAL interpolation - No sql.raw() in INTERVAL expressions', () => {
    // These two used to name routes-contract-alerts.ts, the only file the
    // property had ever been checked on. QUALITY-002 deleted that file - four
    // uncalled handlers with seven phantom columns, 404 in production - and
    // rather than delete its coverage with it, the check is now a SCAN. A
    // security property asserted about one file by name stops being enforced
    // the day that file is renamed, let alone removed.
    it('no server file interpolates a raw value into an INTERVAL', () => {
      const files = walkServer();
      expect(files.length).toBeGreaterThan(100);
      const offenders = files.filter((f) =>
        /INTERVAL\s+'\$\{sql\.raw/.test(fs.readFileSync(f, 'utf-8')),
      );
      expect(offenders.map((f) => path.relative(SERVER_DIR, f))).toEqual([]);
    });

    it('nor builds an INTERVAL by concatenating a value into the unit', () => {
      // `INTERVAL '${n} days'` is the same hole wearing template syntax: the
      // safe form multiplies a fixed unit, `INTERVAL '1 day' * ${Number(n)}`.
      //
      // The unit is ANY word, not a list of four. Naming day|hour|month|year
      // let `INTERVAL '${LOCK_TIMEOUT_MS} milliseconds'` sit in
      // server/lib/migrate.ts through every run of this suite - the
      // ban-one-spelling failure this repo already paid for on setMonth vs
      // setUTCMonth, at unit granularity.
      const offenders = walkServer().filter((f) =>
        /INTERVAL\s+'\$\{(?!sql\.raw)[^}]*\}\s*[a-z]/i.test(fs.readFileSync(f, 'utf-8')),
      );
      expect(offenders.map((f) => path.relative(SERVER_DIR, f))).toEqual([]);
    });

    // NOTE: The routes-proposals.ts INTERVAL tests were removed when the file
    // migrated to supabase/functions/proposals/. Edge version uses explicit
    // date arithmetic (`new Date(Date.now() - n * 86400000).toISOString()`)
    // and parameterized supabase-js filters — no raw SQL INTERVAL interpolation.
  });

  describe('Static audit scanner exists and is functional', () => {
    it('sql-injection-audit.ts scanner script should exist', () => {
      const scannerPath = path.join(SERVER_DIR, 'scripts', 'sql-injection-audit.ts');
      expect(fs.existsSync(scannerPath)).toBe(true);
    });

    it('scanner should define vulnerability patterns', () => {
      const content = readFile('scripts/sql-injection-audit.ts');
      expect(content).toContain('sql.raw');
      expect(content).toContain('ARRAY');
      expect(content).toContain('INTERVAL');
      expect(content).toContain('.replace');
    });
  });

  describe('General SQL injection pattern checks across codebase', () => {
    it('should not have any .replace() patterns for SQL parameter substitution in server/', () => {
      // Scan key route files for the dangerous replace pattern
      const routeFiles = fs
        .readdirSync(SERVER_DIR)
        .filter((f) => f.startsWith('routes-') && f.endsWith('.ts'));

      for (const file of routeFiles) {
        const content = readFile(file);
        const dangerousReplace = /\.replace\s*\(\s*['"]\$\d+['"]\s*,\s*`'?\$\{/g;
        const matches = countMatches(content, dangerousReplace);
        if (matches > 0) {
          throw new Error(`${file} contains ${matches} dangerous .replace() SQL substitution(s)`);
        }
      }
    });
  });
});
