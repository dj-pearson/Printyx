// One place for the integration vocabularies the System Integrations page reads.
//
// PA-053: there were THREE spellings of a status in play. platform_integrations
// documents configured | active | error | paused; system_integrations documents
// active | inactive | error | pending while DEFAULTING to 'disconnected'; and
// the page's own union was connected | disconnected | error | pending. The page
// rendered a badge by indexing a map with whatever came back, so two of the four
// spellings fell through to an undefined variant.
//
// The page is backed by platform_integrations (the connector catalogue - it is
// the only one of the two with a `category` column, it is what production has
// always served this prefix from, and it is what the integration hub dashboard
// reads). system_integrations remains the OAuth CONNECTION store for the
// calendar and ERP flows; PA-056 covers converging that.

export type IntegrationStatus = 'active' | 'configured' | 'error' | 'paused' | 'disconnected';

/** Every spelling either backend can produce, mapped to one vocabulary. */
const STATUS_ALIASES: Record<string, IntegrationStatus> = {
  active: 'active',
  connected: 'active',
  configured: 'configured',
  pending: 'configured',
  error: 'error',
  failed: 'error',
  paused: 'paused',
  inactive: 'paused',
  disconnected: 'disconnected',
};

export function normalizeStatus(raw: string | null | undefined): IntegrationStatus {
  if (!raw) return 'disconnected';
  return STATUS_ALIASES[String(raw).toLowerCase()] ?? 'disconnected';
}

export const STATUS_LABEL: Record<IntegrationStatus, string> = {
  active: 'Active',
  configured: 'Configured',
  error: 'Error',
  paused: 'Paused',
  disconnected: 'Not connected',
};

/** An integration is usable when credentials are stored and syncing is not stopped. */
export function isLiveStatus(status: IntegrationStatus): boolean {
  return status === 'active' || status === 'configured';
}

// platform_integrations.category, from the column's own comment. `other` is not
// a stored value - it is where the page puts a row whose category is absent or
// unrecognised, so an integration is never silently dropped from every group.
export const INTEGRATION_CATEGORIES = [
  { value: 'erp', label: 'ERP' },
  { value: 'crm', label: 'CRM' },
  { value: 'ai', label: 'AI' },
  { value: 'data-enrichment', label: 'Data Enrichment' },
  { value: 'other', label: 'Other' },
] as const;

const KNOWN_CATEGORIES = new Set(INTEGRATION_CATEGORIES.map((c) => c.value));

export function normalizeCategory(raw: string | null | undefined): string {
  const value = String(raw ?? '').toLowerCase();
  return KNOWN_CATEGORIES.has(value) && value !== 'other' ? value : 'other';
}
