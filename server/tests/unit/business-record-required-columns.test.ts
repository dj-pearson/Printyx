/**
 * QUALITY-002: business_records.company_name and .created_by are NOT NULL with
 * no default (migration 0000). Three services create leads and none of them
 * supplied both, so each insert threw and the lead was never created:
 *
 *   ticket-creation-service   an inbound email from an unrecognised sender
 *   web-form-processor        a web-form submission
 *   csv-import-service        a CSV row with no existing match
 *
 * The first was invisible because it wrote `name`/`email`/`source`, which are
 * not columns, and Drizzle drops unknown keys without complaint. The other two
 * were invisible because their values are cast `as $inferInsert`, which turns
 * the check off.
 *
 * These read the source rather than the database, which is weaker than running
 * the insert and is what this container allows. What they lock is that the two
 * required columns are named in each call site.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const CALL_SITES = [
  'server/services/ticket-creation-service.ts',
  'server/services/web-form-processor.ts',
  'server/services/csv-import-service.ts',
];

/** The `.values({...})` block of the insert into businessRecords. */
function businessRecordInsert(file: string): string {
  const source = fs.readFileSync(file, 'utf8');
  const at = source.indexOf('insert(businessRecords)');
  expect(at, `${file} no longer inserts into businessRecords`).toBeGreaterThan(-1);
  return source.slice(at, at + 1600);
}

describe('business_records inserts supply the NOT NULL columns', () => {
  it.each(CALL_SITES)('%s names companyName', (file) => {
    expect(businessRecordInsert(file)).toMatch(/companyName|\.\.\.data/);
  });

  it.each(CALL_SITES)('%s names createdBy', (file) => {
    expect(businessRecordInsert(file)).toMatch(/createdBy/);
  });

  it.each(CALL_SITES)('%s names tenantId', (file) => {
    expect(businessRecordInsert(file)).toMatch(/tenantId/);
  });

  // The specific keys that were being dropped. If any of them comes back it is
  // silently writing nothing again.
  it('ticket-creation-service does not write columns that do not exist', () => {
    const block = businessRecordInsert('server/services/ticket-creation-service.ts');
    for (const phantom of ['name:', 'email:', 'source:']) {
      expect(block, `${phantom} is not a business_records column`).not.toContain(
        `\n        ${phantom}`,
      );
    }
  });
});

describe('the schema still says these are required', () => {
  it('company_name and created_by are NOT NULL with no default', () => {
    const ddl = fs.readFileSync('drizzle/migrations/0000_fuzzy_blizzard.sql', 'utf8');
    const table = ddl.slice(
      ddl.indexOf('CREATE TABLE "business_records"'),
      ddl.indexOf(');', ddl.indexOf('CREATE TABLE "business_records"')),
    );
    expect(table).toMatch(/"company_name" varchar NOT NULL/);
    expect(table).toMatch(/"created_by" varchar NOT NULL/);
  });
});
