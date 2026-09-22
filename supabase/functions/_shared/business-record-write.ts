/**
 * Whitelisting a `business_records` write (COP-M01).
 *
 * `PUT /leads/:id` used to do `.update({ ...body, updated_at })`, handing the
 * request body straight to PostgREST. Two things came out of that, and the
 * second is the one that matters:
 *
 * 1. NOBODY COULD EDIT A LEAD IN PRODUCTION. The page sends camelCase
 *    (`companyName`, `primaryContactEmail`, ...), PostgREST wants column names,
 *    so every save was a PGRST204 reported as "Failed to update lead". It
 *    worked in dev because `/api/leads` is not proxied and Express goes through
 *    Drizzle, which maps field names to columns - the exact dev/prod shape
 *    CLAUDE.md keeps recording.
 *
 * 2. THE BODY COULD SET `tenant_id`. The `.eq('tenant_id', tenantId)` filter
 *    decides WHICH row is written, not what is written to it, so a body
 *    carrying `tenant_id` moved the record into another tenant - and `id`,
 *    `created_by` and the conversion audit columns were writable the same way.
 *
 * So a write is mapped and whitelisted, and what it drops it SAYS. A fallback
 * that quietly narrows what it writes turns schema drift into invisible data
 * loss, which is the lesson COP-B06 paid for in the proposals function.
 */

/** Every column on `business_records`. Locked against Drizzle by a unit test. */
export const BUSINESS_RECORD_COLUMNS = [
  'account_manager_id',
  'account_notes',
  'account_number',
  'account_type',
  'address_line1',
  'address_line2',
  'annual_revenue',
  'assigned_sales_rep',
  'billing_address_1',
  'billing_address_2',
  'billing_city',
  'billing_contact_email',
  'billing_contact_name',
  'billing_contact_phone',
  'billing_state',
  'billing_terms',
  'billing_zip_code',
  'churned_date',
  'city',
  'close_date',
  'company_display_id',
  'company_name',
  'company_size',
  'competitor_name',
  'converted_by',
  'country',
  'created_at',
  'created_by',
  'credit_limit',
  'current_balance',
  'custom_fields',
  'customer_number',
  'customer_priority',
  'customer_rating',
  'customer_since',
  'customer_tier',
  'customer_until',
  'deactivated_by',
  'deactivation_reason',
  'employee_count',
  'estimated_deal_value',
  'external_customer_id',
  'external_data',
  'external_lead_id',
  'external_salesforce_id',
  'external_system_id',
  'fax',
  'id',
  'industry',
  'interest_level',
  'is_active',
  'last_contact_date',
  'last_invoice_date',
  'last_meter_reading_date',
  'last_payment_date',
  'last_service_date',
  'last_sync_date',
  'latitude',
  'lead_score',
  'longitude',
  'migration_status',
  'next_follow_up_date',
  'next_meter_reading_date',
  'next_scheduled_service',
  'notes',
  'owner_id',
  'parent_account_id',
  'payment_terms',
  'phone',
  'postal_code',
  'preferred_contact_method',
  'preferred_technician',
  'primary_contact_email',
  'primary_contact_name',
  'primary_contact_phone',
  'primary_contact_title',
  'priority',
  'probability',
  'reactivation_date',
  'record_type',
  'sales_stage',
  'sla_level',
  'source',
  'state',
  'status',
  'tax_exempt',
  'tax_id',
  'tenant_id',
  'territory',
  'updated_at',
  'upsell_opportunity',
  'url_slug',
  'website',
] as const;

/**
 * Columns a request body may never set, whatever it calls them.
 *
 * `tenant_id` and `id` are the row's identity - writing either is a move, not
 * an edit. `created_by` and `created_at` are its provenance. The three
 * conversion/deactivation audit columns record WHO did something and are set by
 * the endpoints that do it, never by the caller claiming it happened.
 *
 * `updated_at` is here because the handler sets it; a caller supplying one
 * would be backdating the edit.
 */
export const UNWRITABLE_COLUMNS = new Set<string>([
  'id',
  'tenant_id',
  'created_by',
  'created_at',
  'updated_at',
  'converted_by',
  'deactivated_by',
]);

/**
 * Field names the app uses that are NOT their column's camelCase form.
 *
 * Four of them, and each one is a real trap: a body key that camelises to
 * nothing would be dropped in silence and the field would simply never save.
 */
const FIELD_ALIASES: Record<string, string> = {
  // Drizzle calls it estimatedAmount; the page calls it estimatedDealValue.
  estimatedamount: 'estimated_deal_value',
  estimateddealvalue: 'estimated_deal_value',
  // leadSource -> source
  leadsource: 'source',
  // churnReason -> deactivation_reason
  churnreason: 'deactivation_reason',
  // The billing address halves drop the "line".
  billingaddressline1: 'billing_address_1',
  billingaddressline2: 'billing_address_2',
  billingpostalcode: 'billing_zip_code',
};

/**
 * One rule, deliberately. A second pass for runs of capitals (`SLALevel` ->
 * `sla_level`) was written and then removed: no field on this table camelises
 * that way, so it survived every mutation as dead code dressed as care.
 */
function camelToSnake(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

export interface WritePlan {
  /** Column -> value, ready for PostgREST. */
  update: Record<string, unknown>;
  /** Keys that match no column. Reported, not swallowed. */
  ignoredFields: string[];
  /** Keys that match a column the caller may not set. Reported louder. */
  refusedFields: string[];
}

/**
 * Resolve a request body to a column-keyed update.
 *
 * Accepts both spellings of every field, because the tree sends both: the
 * detail page posts camelCase and several importers post snake_case.
 */
export function planBusinessRecordWrite(body: Record<string, unknown>): WritePlan {
  const columns = new Set<string>(BUSINESS_RECORD_COLUMNS);
  const update: Record<string, unknown> = {};
  const ignoredFields: string[] = [];
  const refusedFields: string[] = [];

  for (const [key, value] of Object.entries(body ?? {})) {
    if (value === undefined) continue;
    const alias = FIELD_ALIASES[key.toLowerCase().replace(/_/g, '')];
    const column = alias ?? (columns.has(key) ? key : camelToSnake(key));

    if (UNWRITABLE_COLUMNS.has(column)) {
      refusedFields.push(key);
      continue;
    }
    if (!columns.has(column)) {
      ignoredFields.push(key);
      continue;
    }
    update[column] = value;
  }

  return { update, ignoredFields, refusedFields };
}
