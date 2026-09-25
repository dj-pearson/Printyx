import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { neutraliseFormula } from '../../../client/src/lib/export-utils';

/**
 * UI-DEAD-BUTTONS-001, round 184. Four Export buttons had no handler: a
 * company's contacts, a device's meter readings, a rep's commission statement
 * and the platform signups list. Each now builds a CSV through exportToCSV.
 *
 * The CSV writer also neutralises spreadsheet formulas. These exports carry
 * text a customer or a prospect typed (a contact name, a company name), and a
 * cell starting with = + - @ is executed by Excel and Sheets on open.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const read = (p: string) => strip(readFileSync(join(root, p), 'utf8'));

describe('neutraliseFormula', () => {
  it('prefixes a cell a spreadsheet would execute', () => {
    for (const bad of ['=HYPERLINK("x")', '+1+1', '-2+cmd', '@SUM(A1)', '\t=1', '\r=1']) {
      expect(neutraliseFormula(bad)).toBe(`'${bad}`);
    }
  });

  it('leaves numbers alone, negative ones included', () => {
    for (const n of ['42', '-42', '-3.50', '0.25']) expect(neutraliseFormula(n)).toBe(n);
  });

  it('leaves ordinary text alone', () => {
    for (const t of ['Acme', 'a=b', 'john@acme.com', '']) expect(neutraliseFormula(t)).toBe(t);
  });

  it('is applied by exportToCSV to every cell', () => {
    const src = read('client/src/lib/export-utils.ts');
    const body = src.slice(src.indexOf('export function exportToCSV'));
    expect(body.slice(0, body.indexOf('\n}\n'))).toMatch(/neutraliseFormula\(String\(value\)\)/);
  });
});

describe('each Export button calls exportToCSV', () => {
  const cases: Array<[string, RegExp]> = [
    [
      'client/src/components/ContactManager.tsx',
      /exportToCSV\(filteredContacts, CONTACT_EXPORT_COLUMNS/,
    ],
    [
      'client/src/components/customer/CustomerMeterReadings.tsx',
      /exportToCSV\(filteredReadings, METER_EXPORT_COLUMNS/,
    ],
    [
      'client/src/pages/CommissionManagement.tsx',
      /exportToCSV\(commissionStatementRows\(calc\), STATEMENT_COLUMNS/,
    ],
    ['client/src/pages/RootAdminSignupsCRM.tsx', /exportToCSV\(\s*signups, SIGNUP_EXPORT_COLUMNS/],
    ['client/src/components/customer/CustomerInvoices.tsx', /exportInvoices\(filteredInvoices\)/],
    [
      'client/src/components/customer/CustomerInvoices.tsx',
      /exportInvoices\(filteredInvoices\.filter\(\(i\) => selectedInvoices\.includes\(i\.id\)\)\)/,
    ],
    [
      'client/src/pages/DeviceMonitoring.tsx',
      /exportToCSV\(filteredDevices, DEVICE_EXPORT_COLUMNS/,
    ],
  ];
  for (const [file, call] of cases) {
    it(`${file.split('/').pop()} ${call.source.slice(0, 30)}`, () => {
      const src = read(file);
      const m = call.exec(src);
      expect(m).not.toBeNull();
      // The call sits inside an onClick, not at module scope or in a render.
      const before = src.slice(Math.max(0, m!.index - 200), m!.index);
      expect(before).toMatch(/onClick=\{\(\) =>/);
    });
  }

  it('the paginated signups list says it exports a page, not the base', () => {
    const src = read('client/src/pages/RootAdminSignupsCRM.tsx');
    expect(src).toContain('Export this page');
    expect(src).not.toMatch(/>\s*Export Data\s*</);
  });
});
