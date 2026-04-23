// Territory matching — ported from server/services/territory-management-service.ts.
//
// Two flavors of matching exist in the codebase, historically in different
// services. Both are preserved here with different semantics:
//
//   - `territoryMatchesStrict()` (AND): every declared rule must match.
//     This is what the `/territories/match` endpoint uses when resolving a
//     lead's owning territory.
//
//   - `leadMatchesTerritory()` in `_engine.ts` (OR): any declared rule
//     matching is a signal for rep scoring — used as a *bonus* in scoring
//     rather than as gate.
//
// Keep both. The scoring-bonus version is intentionally looser so partial
// matches still help rank reps; the /territories/match contract is "did this
// lead land in this exact territory?".

import type { SalesTerritoryRow } from './_engine.ts';

export interface LeadLocationData {
  country?: string | null;
  state?: string | null;
  city?: string | null;
  zipCode?: string | null;
  industry?: string | null;
  companySize?: number | null;
  revenue?: number | null;
  productInterest?: string[] | null;
}

export function territoryMatchesStrict(
  lead: LeadLocationData,
  territory: SalesTerritoryRow & { product_focus?: string[] | null },
): boolean {
  const geo = territory.geographic_rules;
  if (geo) {
    if (geo.countries?.length && lead.country && !geo.countries.includes(lead.country))
      return false;
    if (geo.states?.length && lead.state && !geo.states.includes(lead.state)) return false;
    if (geo.cities?.length && lead.city && !geo.cities.includes(lead.city)) return false;
    if (geo.zipCodes?.length && lead.zipCode && !geo.zipCodes.includes(lead.zipCode)) return false;
  }

  const acct = territory.account_rules as
    | (SalesTerritoryRow['account_rules'] & {
        companySizeMin?: number;
        companySizeMax?: number;
        revenueMin?: number;
        revenueMax?: number;
      })
    | null;
  if (acct) {
    if (acct.industries?.length && lead.industry && !acct.industries.includes(lead.industry))
      return false;
    if (
      acct.companySizeMin !== undefined &&
      lead.companySize !== undefined &&
      lead.companySize !== null &&
      lead.companySize < acct.companySizeMin
    ) {
      return false;
    }
    if (
      acct.companySizeMax !== undefined &&
      lead.companySize !== undefined &&
      lead.companySize !== null &&
      lead.companySize > acct.companySizeMax
    ) {
      return false;
    }
    if (
      acct.revenueMin !== undefined &&
      lead.revenue !== undefined &&
      lead.revenue !== null &&
      lead.revenue < acct.revenueMin
    ) {
      return false;
    }
    if (
      acct.revenueMax !== undefined &&
      lead.revenue !== undefined &&
      lead.revenue !== null &&
      lead.revenue > acct.revenueMax
    ) {
      return false;
    }
  }

  // Product focus — if both declared, require at least one overlap.
  const focus = territory.product_focus;
  if (focus?.length && lead.productInterest?.length) {
    const hit = focus.some((p) => lead.productInterest!.includes(p));
    if (!hit) return false;
  }

  return true;
}

// deno-lint-ignore no-explicit-any
type DB = any;

export async function findMatchingTerritory(
  db: DB,
  tenantId: string,
  lead: LeadLocationData,
): Promise<(SalesTerritoryRow & { product_focus?: string[] | null }) | null> {
  const { data } = await db
    .from('sales_territories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  for (const t of (data ?? []) as Array<SalesTerritoryRow & { product_focus?: string[] | null }>) {
    if (territoryMatchesStrict(lead, t)) return t;
  }
  return null;
}
