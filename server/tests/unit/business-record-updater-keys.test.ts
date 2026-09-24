/**
 * Round 249: the database-updater's lead generator wrote `source:` and
 * `estimatedDealValue:` into business_records. The drizzle properties are
 * leadSource and estimatedAmount, and drizzle drops a key it does not know,
 * so every generated lead took the 'website' source default and no deal value.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableColumns } from 'drizzle-orm';
import { businessRecords } from '../../../shared/schema';

const src = readFileSync('server/database-updater/updaters/BusinessRecordUpdater.ts', 'utf8')
  .replace(/(?<![:/])\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const start = src.indexOf('tx.insert(businessRecords).values({');
const payload = src.slice(start, src.indexOf('});', start));
const keys = [...payload.matchAll(/^\s+([a-zA-Z]+):/gm)].map((m) => m[1]);

describe('BusinessRecordUpdater insert', () => {
  it('reads the payload', () => {
    expect(keys.length).toBeGreaterThan(20);
  });

  it('names only drizzle properties of businessRecords', () => {
    const known = new Set(Object.keys(getTableColumns(businessRecords)));
    expect(keys.filter((k) => !known.has(k))).toEqual([]);
    expect(keys).toContain('leadSource');
    expect(keys).toContain('estimatedAmount');
  });
});
