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

describe('SEC-001: SQL Injection Prevention', () => {
  describe('CRITICAL: routes-sales-pipeline.ts - No .replace() for SQL parameters', () => {
    const content = readFile('routes-sales-pipeline.ts');

    it('should not use .replace() to substitute SQL $N placeholders with values', () => {
      // Pattern: .replace('$1', `'${someVar}'`)
      const replacePattern = /\.replace\s*\(\s*['"]\$\d+['"]\s*,\s*`'?\$\{/g;
      const matches = countMatches(content, replacePattern);
      expect(matches).toBe(0);
    });

    it('should not use regex .replace() to substitute all SQL placeholders at once', () => {
      // Pattern: .replace(/\$(\d+)/g, ...)
      const regexReplacePattern = /\.replace\s*\(\s*\/\\\$\(\\d\+\)\/g/g;
      const matches = countMatches(content, regexReplacePattern);
      expect(matches).toBe(0);
    });

    it('should use parameterized queries with sql.raw(query, params)', () => {
      // Verify that sql.raw is called with a second array parameter
      const parameterizedPattern = /sql\.raw\s*\(\s*\w+\s*,\s*\[/g;
      const matches = countMatches(content, parameterizedPattern);
      expect(matches).toBeGreaterThan(0);
    });
  });

  describe('HIGH: Reporting services - No ARRAY construction via sql.raw()', () => {
    const reportingServices = [
      'services/sales-supervisor-reporting-service.ts',
      'services/sales-manager-reporting-service.ts',
      'services/sales-reporting-service.ts',
      'services/service-supervisor-reporting-service.ts',
      'services/service-manager-reporting-service.ts',
      'services/service-reporting-service.ts',
    ];

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
    it('routes-contract-alerts.ts should not interpolate raw values into INTERVAL', () => {
      const content = readFile('routes-contract-alerts.ts');
      // Pattern: INTERVAL '${sql.raw(String(...))} days'
      const intervalRawPattern = /INTERVAL\s+'\$\{sql\.raw/g;
      const matches = countMatches(content, intervalRawPattern);
      expect(matches).toBe(0);
    });

    it('routes-contract-alerts.ts should use parameterized INTERVAL multiplication', () => {
      const content = readFile('routes-contract-alerts.ts');
      // Should now use: INTERVAL '1 day' * ${Number(daysAhead)}
      const safeIntervalPattern = /INTERVAL\s+'1 day'\s*\*\s*\$\{/g;
      const matches = countMatches(content, safeIntervalPattern);
      expect(matches).toBeGreaterThan(0);
    });

    it('routes-proposals.ts should not directly interpolate values into INTERVAL', () => {
      const content = readFile('routes-proposals.ts');
      // Pattern: INTERVAL '${n} days' (direct interpolation inside sql``)
      const directIntervalPattern = /INTERVAL\s+'\$\{[^}]+\}\s+days'/g;
      const matches = countMatches(content, directIntervalPattern);
      expect(matches).toBe(0);
    });

    it('routes-proposals.ts should use parameterized INTERVAL multiplication', () => {
      const content = readFile('routes-proposals.ts');
      // Should now use: INTERVAL '1 day' * ${n}
      const safeIntervalPattern = /INTERVAL\s+'1 day'\s*\*\s*\$\{/g;
      const matches = countMatches(content, safeIntervalPattern);
      expect(matches).toBeGreaterThan(0);
    });
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
      const routeFiles = fs.readdirSync(SERVER_DIR).filter(
        (f) => f.startsWith('routes-') && f.endsWith('.ts'),
      );

      for (const file of routeFiles) {
        const content = readFile(file);
        const dangerousReplace = /\.replace\s*\(\s*['"]\$\d+['"]\s*,\s*`'?\$\{/g;
        const matches = countMatches(content, dangerousReplace);
        if (matches > 0) {
          throw new Error(
            `${file} contains ${matches} dangerous .replace() SQL substitution(s)`,
          );
        }
      }
    });
  });
});
