/**
 * Mapping `companies` rows onto `business_records` (COP-B00).
 *
 * THE SHAPE OF THE PROBLEM, because the story's title understates it. The
 * canonical-table decision was made - `business_records` wins, recorded in
 * docs/crm-canonical-model.md - and never carried out. What that leaves is not
 * a dev/prod disagreement: 53 edge functions read `business_records` and 7 read
 * `companies`, and THREE of those seven WRITE it (`business-records`,
 * `companies`, `import`). So an account created through the production CRM list
 * lands in a table the opportunity radar, churn risk, QBR, contracts, invoices,
 * service, search and the forecast never look at.
 *
 * WHY A MAPPER AND A CLASSIFIER RATHER THAN A MIGRATION. COP-B10 and COP-B09
 * both hit the same trap from the other side: a migration that decides,
 * unreviewed, that two spellings are one thing, and destroys the evidence when
 * it decides wrong. The same applies to a row in each table. So this module
 * SEPARATES two questions that a single `INSERT ... SELECT` would fuse:
 *
 *   1. Does this companies row already exist in business_records?  (classify)
 *   2. What would it look like there?                              (map)
 *
 * and answers the first with EXACT keys only. An id match is proof. A
 * customer_number match is proof, because the column is UNIQUE on both tables.
 * A NAME match is a candidate and nothing more - it is reported and skipped, so
 * a human resolves 'ACME Corp' against 'Acme Corporation' rather than a script
 * doing it silently at 3am.
 *
 * THE ID IS PRESERVED, and that is the most consequential decision here. `deals`,
 * `proposals` and `quotes` all carry an account id; copying a row under a fresh
 * uuid would orphan every one of those references the moment the readers switch
 * tables. Keeping it also makes the copy idempotent for nothing: re-running is
 * an `id` conflict, which is case 1 above.
 *
 * NOTHING IS INVENTED TO SATISFY A NOT NULL. `business_records.created_by` is
 * NOT NULL and `companies.created_by` is nullable, so a row without one is
 * REFUSED and counted, not given a sentinel owner. `source` is NOT NULL with a
 * default of 'website', which would be a false claim about where the record came
 * from, so migrated rows carry 'migrated' instead.
 */

/** The `companies` columns this mapper reads. Snake case, as PostgREST returns them. */
export interface CompanyRow {
  id: string;
  tenant_id: string;
  business_name: string;
  business_record_type?: string | null;
  customer_number?: string | null;
  activity?: string | null;
  industry?: string | null;
  website?: string | null;
  description?: string | null;
  phone?: string | null;
  fax?: string | null;
  billing_address?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  employees?: number | null;
  annual_revenue?: string | number | null;
  customer_since?: string | Date | null;
  next_call_back?: string | Date | null;
  created_by?: string | null;
  business_owner?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}

/** The subset of `business_records` a comparison needs. */
export interface BusinessRecordKey {
  id: string;
  tenant_id: string;
  company_name: string;
  customer_number?: string | null;
}

/**
 * `business_records.status` vocabulary, split by record type. `companies.activity`
 * is free text, so anything outside these lists is coerced to the type's default
 * AND counted - a coercion nobody can see is how a status column stops meaning
 * anything.
 */
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;

export const CUSTOMER_STATUSES = [
  'active',
  'inactive',
  'on_hold',
  'churned',
  'competitor_switch',
  'non_payment',
  'expired',
] as const;

export type MigrationVerdict =
  | 'already-migrated'
  | 'duplicate-customer-number'
  | 'candidate-name-match'
  | 'no-created-by'
  | 'migratable';

export interface Classification {
  verdict: MigrationVerdict;
  /** The business_records id this row collides with, when one was found. */
  matchedRecordId?: string;
  /** Human-readable reason, printed in the report. */
  detail?: string;
}

/**
 * Name key for the CANDIDATE check only - never for a merge.
 *
 * Deliberately conservative, per COP-B10: case and surrounding whitespace are
 * noise, and nothing else is. A normalizer that stripped 'Inc', 'Corp' or
 * 'North' would decide that two real businesses are one, which is the failure
 * this whole module exists to avoid. Internal spacing collapses because
 * 'Acme  Corp' and 'Acme Corp' are a typo, not two companies.
 */
export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Index of existing business_records for the classifier. */
export interface RecordIndex {
  byId: Set<string>;
  /** tenant_id + '\u0000' + customer_number -> record id */
  byCustomerNumber: Map<string, string>;
  /** tenant_id + '\u0000' + nameKey -> record id */
  byName: Map<string, string>;
}

export function buildRecordIndex(records: BusinessRecordKey[]): RecordIndex {
  const byId = new Set<string>();
  const byCustomerNumber = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const r of records) {
    byId.add(r.id);
    if (r.customer_number) {
      byCustomerNumber.set(`${r.tenant_id}\u0000${r.customer_number}`, r.id);
    }
    if (r.company_name) {
      // First writer wins: the report prints the collision either way, and a
      // later row overwriting the pointer would name a different twin on each
      // run over the same data.
      const key = `${r.tenant_id}\u0000${nameKey(r.company_name)}`;
      if (!byName.has(key)) byName.set(key, r.id);
    }
  }
  return { byId, byCustomerNumber, byName };
}

/**
 * Decide what to do with one companies row. Order matters: the exact keys are
 * checked before the fuzzy one, and the NOT NULL refusal comes last so a row
 * that is already migrated is not also reported as unmigratable.
 */
export function classify(company: CompanyRow, index: RecordIndex): Classification {
  if (index.byId.has(company.id)) {
    return {
      verdict: 'already-migrated',
      matchedRecordId: company.id,
      detail: 'A business_records row already carries this id.',
    };
  }

  if (company.customer_number) {
    const matched = index.byCustomerNumber.get(
      `${company.tenant_id}\u0000${company.customer_number}`,
    );
    if (matched) {
      return {
        verdict: 'duplicate-customer-number',
        matchedRecordId: matched,
        detail:
          `customer_number ${company.customer_number} is already held by business_records ` +
          `${matched} under a different id. Inserting would violate the unique index; ` +
          'which row is the real account is a human call.',
      };
    }
  }

  const matchedByName = index.byName.get(
    `${company.tenant_id}\u0000${nameKey(company.business_name)}`,
  );
  if (matchedByName) {
    return {
      verdict: 'candidate-name-match',
      matchedRecordId: matchedByName,
      detail:
        `A business_records row in this tenant has the same normalised name. That is a ` +
        'CANDIDATE, not proof - resolve it by hand rather than letting a copy decide.',
    };
  }

  if (!company.created_by) {
    return {
      verdict: 'no-created-by',
      detail:
        'business_records.created_by is NOT NULL and this row has none. Refused rather ' +
        'than given a sentinel owner.',
    };
  }

  return { verdict: 'migratable' };
}

export interface MappedRecord {
  [column: string]: unknown;
}

export interface MapResult {
  row: MappedRecord;
  /** True when companies.activity was outside the vocabulary and a default was used. */
  statusCoerced: boolean;
}

function normalizeStatus(
  activity: string | null | undefined,
  recordType: 'lead' | 'customer',
): { status: string; coerced: boolean } {
  const fallback = recordType === 'customer' ? 'active' : 'new';
  if (!activity) return { status: fallback, coerced: false };
  const candidate = activity
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const vocabulary: readonly string[] =
    recordType === 'customer' ? CUSTOMER_STATUSES : LEAD_STATUSES;
  if (vocabulary.includes(candidate)) return { status: candidate, coerced: false };
  return { status: fallback, coerced: true };
}

/**
 * `companies.business_record_type` has FOUR live values, not two.
 *
 * The canonical list is in `supabase/functions/business-records/index.ts`'s own
 * typeMap - Lead, Customer, Prospect, Former Customer - and the mapper tested
 * only for 'lead', sending everything else to 'customer'. That is correct for
 * Customer and Former Customer and WRONG FOR PROSPECT, which is the one a live
 * surface produces: `LeadsPage.tsx`'s "Convert to Prospect" action writes
 * exactly `{ business_record_type: 'Prospect', activity: 'qualified' }`, and
 * `ProspectsPage` is a routed board over that value.
 *
 * A prospect has not bought anything. Migrated as a customer it arrives with
 * `status: 'active'` - because 'qualified' is a LEAD status, so it fails the
 * customer vocabulary and coerces to the customer fallback - and then appears
 * in churn risk, QBR, contract renewal and every customer count in the
 * product. The coercion counter DID fire, which is worse than silence in one
 * respect: it reports "an activity outside the vocabulary", which reads as a
 * data-quality note rather than as a lifecycle stage being destroyed.
 *
 * Mapped to 'lead', the same row keeps `status: 'qualified'` with no coercion
 * at all, because the value was always a valid lead status on a row whose type
 * was being read wrong.
 */
export function normalizeRecordType(value: string | null | undefined): 'lead' | 'customer' {
  const v = (value || 'Customer').trim().toLowerCase();
  // A prospect is a qualified lead, not a customer: the product converts
  // Lead -> Prospect -> Customer, and only the last of those has bought.
  if (v === 'lead' || v === 'prospect') return 'lead';
  // 'Former Customer' stays a customer: it HAS bought, and 'churned' and
  // 'inactive' are both real customer statuses.
  return 'customer';
}

/**
 * Build the business_records insert payload for one companies row.
 *
 * Only columns with a real source are written. A column business_records has and
 * companies does not is LEFT ALONE rather than defaulted, so the migrated row is
 * honestly sparse instead of confidently wrong.
 */
export function mapCompanyRow(company: CompanyRow): MapResult {
  const recordType = normalizeRecordType(company.business_record_type);
  const { status, coerced } = normalizeStatus(company.activity, recordType);

  const row: MappedRecord = {
    // Preserved, not regenerated - see the header.
    id: company.id,
    tenant_id: company.tenant_id,
    company_name: company.business_name,
    record_type: recordType,
    status,
    // NOT NULL with a default of 'website', which would be a claim this record
    // came from the web form. It did not.
    source: 'migrated',
    created_by: company.created_by,
  };

  const optional: Array<[string, unknown]> = [
    ['customer_number', company.customer_number],
    ['industry', company.industry],
    ['website', company.website],
    ['account_notes', company.description],
    ['phone', company.phone],
    ['fax', company.fax],
    ['address_line1', company.billing_address],
    ['city', company.billing_city],
    ['state', company.billing_state],
    ['postal_code', company.billing_zip],
    // companies has ONE address; business_records splits site from billing. The
    // same values go to both, because the alternative is a billing address that
    // is silently empty on every migrated account.
    ['billing_address_1', company.billing_address],
    ['billing_city', company.billing_city],
    ['billing_state', company.billing_state],
    ['billing_zip_code', company.billing_zip],
    ['employee_count', company.employees],
    ['annual_revenue', company.annual_revenue],
    ['customer_since', company.customer_since],
    ['next_follow_up_date', company.next_call_back],
    ['owner_id', company.business_owner],
    ['created_at', company.created_at],
    ['updated_at', company.updated_at],
  ];

  for (const [column, value] of optional) {
    if (value !== null && value !== undefined && value !== '') row[column] = value;
  }

  return { row, statusCoerced: coerced };
}
