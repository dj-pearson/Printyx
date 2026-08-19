/**
 * Mapping a provider's contact payload onto enriched_contacts (COP-M01).
 *
 * The ZoomInfo and Apollo importers wrote source, external_id, phone, title,
 * status and raw_data. None of those are columns. The table names the provider
 * ids explicitly (zoominfo_contact_id, apollo_contact_id), calls the source
 * enrichment_source, splits phone into direct_phone and mobile_phone, and uses
 * job_title and prospecting_status. So every insert failed — and since the
 * importers never checked the error, they reported "imported 0 of N" and moved
 * on.
 *
 * Both the enrichment and data-enrichment functions carry byte-identical copies
 * of these two loops (one is an alias of the other), which is why the mapping
 * lives here rather than being fixed twice and drifting once.
 */

export type EnrichmentProvider = 'zoominfo' | 'apollo';

/** enriched_contacts has no generic payload column, so the raw provider record
 *  cannot be kept. The provider id is stored instead, which is what a re-fetch
 *  needs. Callers report this rather than dropping it silently. */
export const UNPERSISTED_ENRICHMENT_FIELDS = [
  'rawData: enriched_contacts has no column for the raw provider payload; the provider id is stored instead',
];

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function joinName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter(Boolean).join(' ').trim();
  return name || null;
}

/**
 * One provider contact -> one enriched_contacts row.
 *
 * Accepts either provider's field spelling (ZoomInfo sends firstName/title,
 * Apollo sends first_name/phone_numbers[]), so the two importers differ only in
 * which id column they fill.
 */
export function toEnrichedContactRow(
  provider: EnrichmentProvider,
  contact: Record<string, any>,
  tenantId: string,
  now: string,
): Record<string, unknown> {
  const firstName = firstString(contact.firstName, contact.first_name);
  const lastName = firstString(contact.lastName, contact.last_name);
  const externalId = firstString(contact.id, contact.contactId, contact.contact_id);

  return {
    tenant_id: tenantId,
    enrichment_source: provider,
    zoominfo_contact_id: provider === 'zoominfo' ? externalId : null,
    apollo_contact_id: provider === 'apollo' ? externalId : null,
    first_name: firstName,
    last_name: lastName,
    full_name: firstString(contact.fullName, contact.full_name) ?? joinName(firstName, lastName),
    email: firstString(contact.email),
    direct_phone: firstString(
      contact.phone,
      contact.direct_phone,
      Array.isArray(contact.phone_numbers) ? contact.phone_numbers[0]?.sanitized_number : null,
      Array.isArray(contact.phone_numbers) ? contact.phone_numbers[0] : null,
    ),
    mobile_phone: firstString(contact.mobilePhone, contact.mobile_phone),
    job_title: firstString(contact.title, contact.job_title),
    company_name: firstString(contact.company, contact.company_name, contact.organization?.name),
    company_domain: firstString(contact.companyDomain, contact.organization?.website_url),
    linkedin_url: firstString(contact.linkedinUrl, contact.linkedin_url),
    prospecting_status: 'imported',
    last_enriched_date: now,
    created_at: now,
    updated_at: now,
  };
}
