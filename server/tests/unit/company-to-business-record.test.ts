/**
 * COP-B00's reconciliation, which decides what moves and what a human decides.
 *
 * The property under test is not "the mapping is right" but "the classifier
 * never merges on a guess". COP-B10 and COP-B09 both record the cost of getting
 * that wrong from the other direction: a migration that quietly decides 'Xerox
 * Corp' and 'xerox' are the same thing, with the original text gone if it was
 * wrong. Here the same guess would fuse two customer accounts.
 */
import { describe, expect, it } from 'vitest';
import {
  buildRecordIndex,
  classify,
  mapCompanyRow,
  nameKey,
  type BusinessRecordKey,
  type CompanyRow,
} from '../../../shared/company-to-business-record';

const company = (over: Partial<CompanyRow> = {}): CompanyRow => ({
  id: 'c1',
  tenant_id: 't1',
  business_name: 'Brand New Dealer',
  business_record_type: 'Customer',
  created_by: 'u9',
  ...over,
});

const record = (over: Partial<BusinessRecordKey> = {}): BusinessRecordKey => ({
  id: 'r1',
  tenant_id: 't1',
  company_name: 'Something Else',
  ...over,
});

describe('the name key normalises noise and nothing else', () => {
  it('ignores case and surrounding and internal whitespace', () => {
    expect(nameKey('  ACME   CORPORATION ')).toBe('acme corporation');
  });

  it('does NOT strip a legal suffix, because that is a business decision', () => {
    // 'Acme Inc' and 'Acme LLC' can be two real companies with one parent.
    // Stripping suffixes is how a normalizer starts merging accounts.
    expect(nameKey('Acme Inc')).not.toBe(nameKey('Acme LLC'));
    expect(nameKey('Acme Inc')).not.toBe(nameKey('Acme'));
  });

  it('does not strip a distinguishing word', () => {
    // COP-B10's territory lesson: 'North' and 'North Region' may be two things.
    expect(nameKey('Acme North')).not.toBe(nameKey('Acme'));
  });
});

describe('the classifier merges only on proof', () => {
  it('an id present in both is already migrated', () => {
    const index = buildRecordIndex([record({ id: 'c1' })]);
    expect(classify(company(), index).verdict).toBe('already-migrated');
  });

  it('a customer_number collision is reported, never copied', () => {
    // UNIQUE on both tables, so the insert would be rejected anyway - but the
    // point is that two rows claim one account number and only a person knows
    // which is the account.
    const index = buildRecordIndex([record({ id: 'r9', customer_number: 'CN-777' })]);
    const verdict = classify(company({ customer_number: 'CN-777' }), index);
    expect(verdict.verdict).toBe('duplicate-customer-number');
    expect(verdict.matchedRecordId).toBe('r9');
  });

  it('a name match is a CANDIDATE and stops the copy', () => {
    const index = buildRecordIndex([record({ id: 'r5', company_name: 'Acme Corporation' })]);
    const verdict = classify(company({ business_name: '  ACME   CORPORATION ' }), index);
    expect(verdict.verdict).toBe('candidate-name-match');
    expect(verdict.matchedRecordId).toBe('r5');
    expect(verdict.detail).toContain('CANDIDATE');
  });

  it('the same name in ANOTHER tenant is not a match', () => {
    // The one thing worse than merging two accounts is merging two tenants'.
    const index = buildRecordIndex([
      record({ id: 'r7', tenant_id: 't2', company_name: 'Brand New Dealer' }),
    ]);
    expect(classify(company(), index).verdict).toBe('migratable');
  });

  it('a row with no created_by is refused, not given a sentinel owner', () => {
    const index = buildRecordIndex([]);
    const verdict = classify(company({ created_by: null }), index);
    expect(verdict.verdict).toBe('no-created-by');
  });

  it('proof beats absence: an already-migrated row is not also reported ownerless', () => {
    // Ordering property. Checking NOT NULL first would report every previously
    // migrated row with a null created_by as needing a human, forever.
    const index = buildRecordIndex([record({ id: 'c1' })]);
    expect(classify(company({ created_by: null }), index).verdict).toBe('already-migrated');
  });

  it('an exact key beats the fuzzy one', () => {
    const index = buildRecordIndex([
      record({ id: 'r1', customer_number: 'CN-1', company_name: 'Brand New Dealer' }),
    ]);
    expect(classify(company({ customer_number: 'CN-1' }), index).verdict).toBe(
      'duplicate-customer-number',
    );
  });

  it('the name index keeps the FIRST row, so repeated runs name the same twin', () => {
    const index = buildRecordIndex([
      record({ id: 'first', company_name: 'Acme' }),
      record({ id: 'second', company_name: 'acme' }),
    ]);
    expect(index.byName.get('t1\u0000acme')).toBe('first');
  });
});

describe('the mapping keeps the id and invents nothing', () => {
  it('preserves the id, so deals and quotes still resolve', () => {
    // The reason this matters: deals, proposals and quotes all carry an account
    // id. A fresh uuid orphans every one of them the moment readers switch.
    expect(mapCompanyRow(company({ id: 'keep-me' })).row.id).toBe('keep-me');
  });

  it('writes every NOT NULL column business_records has', () => {
    const { row } = mapCompanyRow(company());
    for (const column of [
      'id',
      'tenant_id',
      'company_name',
      'record_type',
      'status',
      'source',
      'created_by',
    ]) {
      expect(row[column], column).toBeTruthy();
    }
  });

  it("says 'migrated', not 'website'", () => {
    // source is NOT NULL defaulting to 'website'. Letting the default stand
    // would claim every migrated account came in through the web form.
    expect(mapCompanyRow(company()).row.source).toBe('migrated');
  });

  it('maps the record type down to the business_records vocabulary', () => {
    expect(mapCompanyRow(company({ business_record_type: 'Lead' })).row.record_type).toBe('lead');
    expect(mapCompanyRow(company({ business_record_type: 'Customer' })).row.record_type).toBe(
      'customer',
    );
    // companies.business_record_type is a free varchar; anything unrecognised
    // is an account, which is what the column defaults to there.
    expect(mapCompanyRow(company({ business_record_type: 'Vendor' })).row.record_type).toBe(
      'customer',
    );
  });

  it('keeps an activity that is already a status', () => {
    const { row, statusCoerced } = mapCompanyRow(company({ activity: 'on hold' }));
    expect(row.status).toBe('on_hold');
    expect(statusCoerced).toBe(false);
  });

  it('coerces an activity that is not, and SAYS it coerced', () => {
    // companies.activity is free text. A silent coercion is how a status column
    // stops meaning anything; the count is printed in the report.
    const { row, statusCoerced } = mapCompanyRow(company({ activity: 'Warm Prospect (hot)' }));
    expect(row.status).toBe('active');
    expect(statusCoerced).toBe(true);
  });

  it('defaults by record type, not to one value for both', () => {
    expect(mapCompanyRow(company({ business_record_type: 'Lead' })).row.status).toBe('new');
    expect(mapCompanyRow(company({ business_record_type: 'Customer' })).row.status).toBe('active');
  });

  it('a lead status on a customer row is not honoured', () => {
    // The two vocabularies overlap in neither direction, so 'qualified' on a
    // customer is a lead status on the wrong row, not a customer status.
    const { row, statusCoerced } = mapCompanyRow(
      company({ business_record_type: 'Customer', activity: 'qualified' }),
    );
    expect(row.status).toBe('active');
    expect(statusCoerced).toBe(true);
  });

  it('writes the one companies address to both address halves', () => {
    const { row } = mapCompanyRow(
      company({
        billing_address: '2100 Fleur Dr',
        billing_city: 'Des Moines',
        billing_zip: '50321',
      }),
    );
    expect(row.address_line1).toBe('2100 Fleur Dr');
    expect(row.billing_address_1).toBe('2100 Fleur Dr');
    expect(row.city).toBe('Des Moines');
    expect(row.billing_city).toBe('Des Moines');
    expect(row.postal_code).toBe('50321');
    expect(row.billing_zip_code).toBe('50321');
  });

  it('omits a column with no source rather than writing a blank', () => {
    // A sparse migrated row is honest. An empty string in industry reads as
    // "we asked and they have none".
    const { row } = mapCompanyRow(company({ industry: '', website: null }));
    expect('industry' in row).toBe(false);
    expect('website' in row).toBe(false);
    expect('latitude' in row).toBe(false);
  });

  it('carries the timestamps, so a migrated account keeps its age', () => {
    const { row } = mapCompanyRow(company({ created_at: '2019-04-01T00:00:00Z' }));
    expect(row.created_at).toBe('2019-04-01T00:00:00Z');
  });
});
