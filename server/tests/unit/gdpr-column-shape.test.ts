// COP-M01 / LEGAL: the GDPR edge function addressed four tables by names they do
// not have, and none of its writes checked their errors. The visible effect was
// the opposite of an error:
//
//   - recording consent wrote a `consented` boolean (the column is a `status`
//     enum) and dropped subject_type, subject_id and source, all NOT NULL — so
//     nothing was recorded while the cookie banner told the visitor it had been;
//   - a data-subject ERASURE wrote primary_contact_* under the wrong names and
//     filtered on an absent `email` column, matched nothing, and answered
//     "User data has been anonymized";
//   - a subject access EXPORT read a `contacts` table that is in no schema and
//     filtered business_records the same wrong way, so it exported an empty file
//     and reported success.
//
// Reporting a completed erasure that did not happen is the failure mode worth
// pinning, so this asserts the column names AND that the handler now refuses to
// claim success when a write fails.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';

import { businessRecords, companyContacts } from '@shared/schema';
import { consentRecords } from '@shared/gdpr-core-schema';
import { gdprRequests } from '@shared/security-schema';

const source = readFileSync(join(process.cwd(), 'supabase/functions/gdpr/index.ts'), 'utf-8');

const columnsOf = (table: any) =>
  new Set(Object.values(getTableColumns(table) as any).map((c: any) => c.name));

describe('consent_records', () => {
  const columns = columnsOf(consentRecords);

  it('has no `consented` column — consent is a status enum', () => {
    expect(columns.has('consented')).toBe(false);
    expect(columns.has('status')).toBe(true);
    expect(columns.has('given_at')).toBe(true);
    expect(columns.has('withdrawn_at')).toBe(true);
  });

  it('requires the fields the handler used to drop', () => {
    for (const column of ['subject_type', 'subject_id', 'source']) {
      expect(columns.has(column)).toBe(true);
    }
  });

  it('the handler no longer writes `consented`', () => {
    expect(source).not.toMatch(/^\s+consented:/m);
  });

  it('the handler enforces the same self-only rule as the Express route', () => {
    expect(source).toContain('You can only manage your own consent');
  });
});

describe('gdpr_requests', () => {
  const columns = columnsOf(gdprRequests);

  it.each([
    'request_type',
    'subject_name',
    'submitted_by',
    'notes',
    'completed_at',
    'completed_by',
  ])('%s is not a column', (column) => {
    expect(columns.has(column)).toBe(false);
  });

  it.each(['type', 'requestor_id', 'processing_notes', 'completion_date', 'approved_by'])(
    '%s is the real column',
    (column) => {
      expect(columns.has(column)).toBe(true);
    },
  );
});

describe('the tables the erasure and export paths touch', () => {
  const recordColumns = columnsOf(businessRecords);
  const contactColumns = columnsOf(companyContacts);

  it('business_records identifies a person by primary_contact_*, not email/contact_name', () => {
    expect(recordColumns.has('email')).toBe(false);
    expect(recordColumns.has('contact_name')).toBe(false);
    expect(recordColumns.has('primary_contact_email')).toBe(true);
    expect(recordColumns.has('primary_contact_name')).toBe(true);
    expect(recordColumns.has('primary_contact_phone')).toBe(true);
  });

  it('company_contacts is the canonical contact table and has the columns used', () => {
    for (const column of ['email', 'first_name', 'last_name', 'phone', 'mobile']) {
      expect(contactColumns.has(column)).toBe(true);
    }
  });

  it('the handler no longer reads the uncanonical contacts table', () => {
    expect(source).not.toMatch(/from\('contacts'\)/);
    expect(source).toMatch(/from\('company_contacts'\)/);
  });
});

describe('neither path may report success it did not achieve', () => {
  it('erasure refuses when a write fails', () => {
    expect(source).toContain('ERASURE_INCOMPLETE');
    expect(source).toContain('no success may be reported to the data subject');
  });

  it('export refuses when a source could not be read', () => {
    expect(source).toContain('EXPORT_INCOMPLETE');
  });

  it('erasure reports what it actually anonymized', () => {
    expect(source).toMatch(/companyContacts: anonymizedContacts\?\.length/);
    expect(source).toMatch(/businessRecords: anonymizedRecords\?\.length/);
  });
});

describe('the consent enums the handler guards', () => {
  // consent_type and consent_source are pg enums, so an unlisted value is a 500
  // from the database — and an unrecorded consent. The handler keeps its own
  // copy of both; these assert the copies match the schema.
  function enumValues(name: string): string[] {
    const src = readFileSync(join(process.cwd(), 'shared/gdpr-core-schema.ts'), 'utf-8');
    const at = src.indexOf(`pgEnum('${name}', [`);
    if (at === -1) return [];
    const start = src.indexOf('[', at);
    const end = src.indexOf(']', start);
    return [...src.slice(start, end).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  }

  function handlerSet(constName: string): string[] {
    const at = source.indexOf(`const ${constName} = new Set([`);
    const start = source.indexOf('[', at);
    const end = source.indexOf(']', start);
    return [...source.slice(start, end).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  }

  it('CONSENT_TYPES matches the consent_type enum', () => {
    expect(handlerSet('CONSENT_TYPES').sort()).toEqual(enumValues('consent_type').sort());
  });

  it('CONSENT_SOURCES matches the consent_source enum', () => {
    expect(handlerSet('CONSENT_SOURCES').sort()).toEqual(enumValues('consent_source').sort());
  });

  it('rejects an unsupported consent type by name instead of failing at the database', () => {
    expect(source).toContain('UNSUPPORTED_CONSENT_TYPE');
  });

  it('records the caller own source label even when it coerces the enum', () => {
    expect(source).toMatch(/source_details:.*body\.source/);
  });

  it('the cookie banner sends a type this enum does not carry, which is the open question', () => {
    // Named here so the gap is visible rather than folded into a guess.
    expect(enumValues('consent_type')).not.toContain('cookie_analytics');
    expect(enumValues('consent_type')).not.toContain('cookie_marketing');
    expect(enumValues('consent_type')).not.toContain('cookie_preferences');
  });
});
