/**
 * The company pricing policy row: what it is called on each side, and what a
 * save is allowed to write.
 *
 * THE ONLY WRITER PRODUCTION HAS WROTE FIVE COLUMNS THE TABLE DOES NOT HAVE
 * (round 125). `supabase/functions/pricing` upserted
 * default_company_markup_percentage, default_minimum_margin_percentage,
 * require_approval_below_minimum, auto_calculate_prices and pricing_currency
 * into `company_pricing_settings`, whose real columns are
 * default_markup_percentage, min_margin_percentage,
 * require_approval_for_price_edit, max_discount_percentage and eleven more.
 * Every save was a PGRST204, and four of the five names undefined on top of
 * that, so the request that reached PostgREST carried `tenant_id`,
 * `pricing_currency` and `updated_at` - one phantom column being enough.
 *
 * THE CONSEQUENCE IS NOT A BROKEN SETTINGS PAGE, IT IS AN UNENFORCED
 * GUARDRAIL. `supabase/functions/proposals` reads
 * `company_pricing_settings.max_discount_percentage` for the QUOTE-016
 * discount ceiling, and its own rule is that 0 or absent means not enforced.
 * Production could not write that column and did not create the row at all,
 * so there was no ceiling on any quote, on any tenant - while
 * `/pricing/settings` displayed 20% as though there were one.
 *
 * FOUR RULES.
 *
 * 1. ONLY THE FIELDS THE CALLER SENT ARE WRITTEN (COP-B03). A blanket object
 *    nulls every column a partial form omits, and this row holds the discount
 *    ceiling and the margin floor.
 *
 * 2. WHAT CANNOT BE STORED IS NAMED, NOT DROPPED (COP-B06), and `tenant_id`,
 *    `id` and `created_at` are REFUSED - a settings PUT must not move the row
 *    to another tenant (COP-M01's payload half).
 *
 * 3. AN EMPTY PLAN IS A 400. A 200 that bumps `updated_at` and reports success
 *    while storing nothing is the fabricated write outcome three guards here
 *    watch for on the read side and none watches on this one.
 *
 * 4. THE COLUMN DEFAULTS ARE THE DEFAULTS. The bootstrap insert supplies
 *    `tenant_id` and nothing else, so Postgres applies the declared defaults
 *    and there is no second copy of the discount ceiling to drift. The Express
 *    half restates all eleven, which is a live duplicate, so a test asserts it
 *    still agrees with the declaration.
 */

/** camelCase field -> column. Every writable field on the policy row. */
export const COMPANY_PRICING_SETTINGS_FIELDS: Record<string, string> = {
  defaultMarkupType: 'default_markup_type',
  defaultMarkupPercentage: 'default_markup_percentage',
  defaultMarkupAmount: 'default_markup_amount',
  categoryMarkupOverrides: 'category_markup_overrides',
  allowRepPriceEdit: 'allow_rep_price_edit',
  requireApprovalForPriceEdit: 'require_approval_for_price_edit',
  requireApprovalAboveThreshold: 'require_approval_above_threshold',
  maxDiscountPercentage: 'max_discount_percentage',
  minMarginPercentage: 'min_margin_percentage',
  autoApprovalThreshold: 'auto_approval_threshold',
  showDealerCostToReps: 'show_dealer_cost_to_reps',
  showMarginToReps: 'show_margin_to_reps',
  notifyOnPriceChange: 'notify_on_price_change',
  notifyManagersOnApproval: 'notify_managers_on_approval',
};

/** Read-only fields the response carries and a write may never set. */
export const COMPANY_PRICING_SETTINGS_READONLY_FIELDS: Record<string, string> = {
  id: 'id',
  tenantId: 'tenant_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

export const COMPANY_PRICING_SETTINGS_REFUSED = new Set([
  'id',
  'tenantId',
  'tenant_id',
  'createdAt',
  'created_at',
]);

type Row = Record<string, unknown> | null | undefined;

/**
 * The row as every page here reads it.
 *
 * SHALLOW, NEVER DEEP (CRM-008 round 65): `category_markup_overrides` is jsonb
 * keyed by the dealer's own category names - "MFP", "Production" - and a deep
 * camel convert would rewrite them.
 */
export function toCompanyPricingSettings(row: Row): Record<string, unknown> | null {
  if (!row || typeof row !== 'object') return null;
  const out: Record<string, unknown> = {};
  const all = { ...COMPANY_PRICING_SETTINGS_READONLY_FIELDS, ...COMPANY_PRICING_SETTINGS_FIELDS };
  for (const [field, column] of Object.entries(all)) {
    const value = column in row ? row[column] : field in row ? row[field] : undefined;
    if (value !== undefined) out[field] = value;
  }
  return out;
}

export type PricingSettingsUpdatePlan = {
  set: Record<string, unknown>;
  ignoredFields: string[];
  refusedFields: string[];
};

/**
 * Build the column map a save writes, from the fields the caller actually sent.
 *
 * Either spelling is accepted, because the pages send camelCase and an
 * integration may send columns.
 */
export function buildCompanyPricingSettingsUpdate(
  body: Record<string, unknown> | null | undefined,
): PricingSettingsUpdatePlan {
  const set: Record<string, unknown> = {};
  const ignoredFields: string[] = [];
  const refusedFields: string[] = [];
  if (!body || typeof body !== 'object') return { set, ignoredFields, refusedFields };

  const byColumn = new Map(
    Object.entries(COMPANY_PRICING_SETTINGS_FIELDS).map(([field, column]) => [column, field]),
  );

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (COMPANY_PRICING_SETTINGS_REFUSED.has(key)) {
      refusedFields.push(key);
      continue;
    }
    const column = COMPANY_PRICING_SETTINGS_FIELDS[key] ?? (byColumn.has(key) ? key : undefined);
    if (!column) {
      ignoredFields.push(key);
      continue;
    }
    set[column] = value;
  }

  return { set, ignoredFields, refusedFields };
}
