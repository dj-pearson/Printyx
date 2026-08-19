// COP-M01: the ZoomInfo and Apollo importers wrote source, external_id, phone,
// title, status and raw_data onto enriched_contacts. None are columns — the
// table names the provider ids explicitly (zoominfo_contact_id /
// apollo_contact_id), calls the source enrichment_source, splits phone into
// direct_phone and mobile_phone, and uses job_title and prospecting_status.
//
// Every insert failed, and neither loop checked its error — data-enrichment's
// even read a DIFFERENT `error` variable from an outer scope — so both
// endpoints reported a clean "imported 0 of N".
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';

import { enrichedContacts } from '@shared/schema';
import {
  toEnrichedContactRow,
  UNPERSISTED_ENRICHMENT_FIELDS,
} from '../../../supabase/functions/_shared/enriched-contact';

const columns = new Set(
  Object.values(getTableColumns(enrichedContacts) as any).map((c: any) => c.name),
);
const NOW = '2026-08-19T12:00:00.000Z';

const ZOOMINFO = {
  id: 'zi-123',
  firstName: 'Rosa',
  lastName: 'Alvarez',
  email: 'rosa@northgate.example',
  phone: '515-555-0134',
  title: 'Service Manager',
  company: 'Northgate Dental',
};

const APOLLO = {
  id: 'ap-987',
  first_name: 'Dan',
  last_name: 'Okafor',
  email: 'dan@ridgeline.example',
  phone_numbers: [{ sanitized_number: '515-555-0199' }],
  title: 'Owner',
  organization: { name: 'Ridgeline Print', website_url: 'ridgeline.example' },
};

describe('every key it emits is a real column', () => {
  it.each([
    ['zoominfo', ZOOMINFO],
    ['apollo', APOLLO],
  ] as const)('%s', (provider, contact) => {
    const row = toEnrichedContactRow(provider, contact, 't-1', NOW);
    expect(Object.keys(row).length).toBeGreaterThan(5);
    for (const key of Object.keys(row)) expect(columns.has(key)).toBe(true);
  });

  it.each(['source', 'external_id', 'phone', 'title', 'status', 'raw_data'])(
    '%s is not a column, so nothing may emit it',
    (phantom) => {
      expect(columns.has(phantom)).toBe(false);
      expect(toEnrichedContactRow('zoominfo', ZOOMINFO, 't-1', NOW)).not.toHaveProperty(phantom);
      expect(toEnrichedContactRow('apollo', APOLLO, 't-1', NOW)).not.toHaveProperty(phantom);
    },
  );
});

describe('the provider id goes in the provider column', () => {
  it('zoominfo fills zoominfo_contact_id and leaves apollo null', () => {
    const row = toEnrichedContactRow('zoominfo', ZOOMINFO, 't-1', NOW);
    expect(row.zoominfo_contact_id).toBe('zi-123');
    expect(row.apollo_contact_id).toBeNull();
    expect(row.enrichment_source).toBe('zoominfo');
  });

  it('apollo fills apollo_contact_id and leaves zoominfo null', () => {
    const row = toEnrichedContactRow('apollo', APOLLO, 't-1', NOW);
    expect(row.apollo_contact_id).toBe('ap-987');
    expect(row.zoominfo_contact_id).toBeNull();
    expect(row.enrichment_source).toBe('apollo');
  });
});

describe('it reads either provider spelling', () => {
  it('takes the name from camelCase or snake_case', () => {
    expect(toEnrichedContactRow('zoominfo', ZOOMINFO, 't-1', NOW).first_name).toBe('Rosa');
    expect(toEnrichedContactRow('apollo', APOLLO, 't-1', NOW).first_name).toBe('Dan');
  });

  it('composes full_name when the provider does not send one', () => {
    expect(toEnrichedContactRow('zoominfo', ZOOMINFO, 't-1', NOW).full_name).toBe('Rosa Alvarez');
  });

  it('prefers a full name the provider did send', () => {
    const row = toEnrichedContactRow(
      'zoominfo',
      { ...ZOOMINFO, fullName: 'R. Alvarez' },
      't-1',
      NOW,
    );
    expect(row.full_name).toBe('R. Alvarez');
  });

  it('reads a flat phone or the first of an Apollo phone_numbers array', () => {
    expect(toEnrichedContactRow('zoominfo', ZOOMINFO, 't-1', NOW).direct_phone).toBe(
      '515-555-0134',
    );
    expect(toEnrichedContactRow('apollo', APOLLO, 't-1', NOW).direct_phone).toBe('515-555-0199');
  });

  it('reads the company from either shape', () => {
    expect(toEnrichedContactRow('zoominfo', ZOOMINFO, 't-1', NOW).company_name).toBe(
      'Northgate Dental',
    );
    expect(toEnrichedContactRow('apollo', APOLLO, 't-1', NOW).company_name).toBe('Ridgeline Print');
  });

  it('maps the job title to job_title', () => {
    expect(toEnrichedContactRow('apollo', APOLLO, 't-1', NOW).job_title).toBe('Owner');
  });
});

describe('empty and missing input', () => {
  it('never emits an empty string where a null belongs', () => {
    const row = toEnrichedContactRow('zoominfo', {}, 't-1', NOW);
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') expect(value.length).toBeGreaterThan(0);
      expect(value === '').toBe(false);
      expect(key).toBeTruthy();
    }
  });

  it('has a null full_name rather than a stray space', () => {
    expect(toEnrichedContactRow('apollo', {}, 't-1', NOW).full_name).toBeNull();
  });

  it('always carries the tenant and the timestamps', () => {
    const row = toEnrichedContactRow('apollo', {}, 't-9', NOW);
    expect(row.tenant_id).toBe('t-9');
    expect(row.created_at).toBe(NOW);
    expect(row.updated_at).toBe(NOW);
    expect(row.last_enriched_date).toBe(NOW);
  });

  it('marks the row imported using the real status column', () => {
    expect(toEnrichedContactRow('apollo', {}, 't-1', NOW).prospecting_status).toBe('imported');
  });
});

describe('what cannot be stored is stated', () => {
  it('names the raw payload, since enriched_contacts has no column for it', () => {
    expect(columns.has('raw_data')).toBe(false);
    expect(UNPERSISTED_ENRICHMENT_FIELDS.join(' ')).toContain('rawData');
  });
});
