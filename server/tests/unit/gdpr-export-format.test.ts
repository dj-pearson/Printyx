/**
 * Round 240: GDPR export accepted any format string. 'pdf' and 'zip' are
 * export_format enum members that formatExportData does not implement, so the
 * record said PDF and the data came back as JSON; anything else failed the
 * enum insert as a 500.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { GDPR_EXPORT_FORMATS, parseExportFormat } from '../../lib/gdpr-export-format';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

describe('parseExportFormat', () => {
  it('defaults to json and accepts what the service implements', () => {
    expect(parseExportFormat(undefined)).toBe('json');
    expect(parseExportFormat('')).toBe('json');
    expect(parseExportFormat('CSV')).toBe('csv');
    expect(parseExportFormat(' xml ')).toBe('xml');
  });

  it('refuses formats the service would silently turn into JSON', () => {
    expect(parseExportFormat('pdf')).toBeNull();
    expect(parseExportFormat('zip')).toBeNull();
    expect(parseExportFormat('xlsx')).toBeNull();
    expect(parseExportFormat(['json'])).toBeNull();
  });

  it('matches the cases formatExportData actually handles', () => {
    const svc = strip(readFileSync('server/services/gdpr-data-export-service.ts', 'utf8'));
    const body = svc.slice(
      svc.indexOf('formatExportData('),
      svc.indexOf('default:', svc.indexOf('formatExportData(')),
    );
    const handled = [...body.matchAll(/case '([a-z]+)':/g)].map((m) => m[1]).sort();
    expect(handled).toEqual([...GDPR_EXPORT_FORMATS].sort());
  });
});

describe('both export routes validate the format before creating the request', () => {
  for (const file of ['server/routes-gdpr.ts', 'server/routes-gdpr-core.ts']) {
    it(file, () => {
      const src = strip(readFileSync(file, 'utf8'));
      const check = src.indexOf('parseExportFormat(');
      const create = src.indexOf('createExportRequest(');
      expect(check).toBeGreaterThan(-1);
      expect(check).toBeLessThan(create);
      expect(src).toMatch(/code: 'UNSUPPORTED_FORMAT'/);
    });
  }
});

describe('requested_by_type', () => {
  it('is NOT NULL, so both create paths set it after anything a caller sends', () => {
    const schema = readFileSync('shared/gdpr-core-schema.ts', 'utf8');
    expect(schema).toMatch(/requestedByType: varchar\('requested_by_type'[^)]*\)\.notNull\(\)/);
    const gdpr = strip(readFileSync('server/routes-gdpr.ts', 'utf8'));
    expect(gdpr).toMatch(
      /requestedByType: targetUserId === requestingUserId \? 'subject' : 'admin'/,
    );
    const core = strip(readFileSync('server/routes-gdpr-core.ts', 'utf8'));
    const spread = core.indexOf('...req.body,');
    const set = core.indexOf("requestedByType: 'admin'");
    expect(spread).toBeGreaterThan(-1);
    expect(set).toBeGreaterThan(spread);
  });
});
