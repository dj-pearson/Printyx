/**
 * What a territory change actually did - COP-B09 AC6.
 *
 * "Territory changes reassign cleanly without orphaning records, and the change
 * is auditable." The first half holds by construction and always did: territory
 * membership is resolved AT READ TIME by matching a territory's name or code
 * against the free-text `business_records.territory` column (COP-B10), so
 * nothing is rewritten and nothing can be orphaned. The second half was simply
 * absent - the three write branches created, updated and deleted territories
 * with no record of any of it.
 *
 * READ-TIME MATCHING IS WHAT MAKES THE AUDIT NECESSARY, not what makes it
 * unnecessary. Because nothing is rewritten, a rename takes effect instantly and
 * silently: renaming "North" to "North Region" releases every account whose
 * territory column says "North" and claims every one that says "North Region",
 * with no migration, no diff and nothing on any screen saying a boundary moved.
 * Deleting a territory is worse - its accounts land in the coverage report's
 * UNASSIGNED bucket, which reads as "nobody has assigned these yet" rather than
 * "somebody removed the territory they were in".
 *
 * WHAT IS DELIBERATELY NOT RECORDED: how many accounts moved. Answering that
 * means the coverage scan - every business_record in the tenant, matched through
 * the normalizer - which is far too expensive on a write path, and an
 * approximation (an exact-name count, say) would MISS the case-insensitive and
 * code matches the real resolver makes. A number in an audit record that is
 * close but not right is worse than no number, because the auditor cannot tell
 * which they have. The territory's name and code ARE recorded, so anyone can run
 * the coverage report and get the exact answer.
 */

/** The territory fields worth recording. Matches TERRITORY_COLUMNS' subset. */
export const AUDITED_TERRITORY_FIELDS = [
  'territory_name',
  'territory_code',
  'territory_type',
  'description',
  'geographic_rules',
  'account_rules',
  'is_active',
  'priority',
  'owner_id',
  'manager_id',
  'team_members',
  'monthly_quota',
] as const;

/**
 * Fields whose change silently moves accounts between territories, because the
 * resolver matches on them. A rename is the one that catches people out.
 */
export const MATCH_KEY_FIELDS = ['territory_name', 'territory_code'] as const;

/**
 * Fields whose change moves a REP'S BOOK rather than the accounts: the radar and
 * the forecast filter a rep's default view through owner_id and team_members
 * (shared/territory-membership.ts). manager_id is NOT here - it is who the
 * territory reports to, and conflating the two is the defect COP-B09 AC3
 * records.
 */
export const OWNERSHIP_FIELDS = ['owner_id', 'team_members'] as const;

export interface TerritoryChange {
  /** Only the fields that actually differ, old and new. */
  changed: Record<string, { from: unknown; to: unknown }>;
  /** Changed fields the account resolver matches on. */
  matchKeysChanged: string[];
  /** Changed fields that decide whose book a territory is in. */
  ownershipChanged: string[];
  /**
   * True when this change silently reassigns something. The reason an auditor
   * searches the log at all.
   */
  reassigns: boolean;
}

/** Deep-ish equality for the scalar and jsonb values these columns hold. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // null and undefined both mean "not set" on these columns; a PATCH that omits
  // a field and one that sends null must not read as a change from each other.
  if ((a ?? null) === null && (b ?? null) === null) return true;
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  // monthly_quota is numeric, which PostgREST returns as a STRING, so a caller
  // sending 5000 against a stored "5000.00" is not a change.
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  }
  return false;
}

/**
 * The difference between a stored territory and what it became.
 *
 * `after` may be a partial patch (the PUT builds one field by field), so only
 * the keys it carries are compared - a field the caller did not send has not
 * changed, and reporting it as a change to null is the blanket-object defect
 * COP-M01 records one table over.
 */
export function territoryChange(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): TerritoryChange {
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  const b = before ?? {};
  const a = after ?? {};

  for (const field of AUDITED_TERRITORY_FIELDS) {
    if (!(field in a)) continue;
    if (same(b[field], a[field])) continue;
    changed[field] = { from: b[field] ?? null, to: a[field] ?? null };
  }

  const matchKeysChanged = MATCH_KEY_FIELDS.filter((f) => f in changed);
  const ownershipChanged = OWNERSHIP_FIELDS.filter((f) => f in changed);
  return {
    changed,
    matchKeysChanged: [...matchKeysChanged],
    ownershipChanged: [...ownershipChanged],
    reassigns: matchKeysChanged.length > 0 || ownershipChanged.length > 0,
  };
}

/** The audited subset of a stored row, for old_values / new_values. */
export function territorySnapshot(
  row: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const field of AUDITED_TERRITORY_FIELDS) out[field] = row[field] ?? null;
  return out;
}
