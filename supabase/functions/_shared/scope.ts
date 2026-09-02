/**
 * Row-visibility scope for edge-function list endpoints (WF-R-04).
 *
 * THE PROBLEM. Every list endpoint in the tree filters on `tenant_id` and nothing
 * else, so a level-1 sales rep gets every record in the tenant - every deal, every
 * invoice, every customer. The two purpose-built engines
 * (server/middleware/hierarchical-query-builder.ts and scope-middleware.ts) are
 * Express-only and have no live callers, and production serves all of these from
 * edge functions, so neither has ever run against a real request.
 *
 * THE TIERS, from docs/rbac-decision.md: L1-2 own work, L3-4 team and location,
 * L5-6 region, L7-8 company and platform. The level comes from the WF-R-03 claim.
 *
 * DEGRADATION IS DELIBERATE AND IT NARROWS. Location and region scope need
 * `users.primary_location_id` / `users.region_id` / `locations.region_id`, and
 * NOTHING IN THE TREE WRITES ANY OF THEM - the admin invite sets `role_id` and
 * `team_id` only, and the one file that assigned a manager
 * (server/auth-setup.ts) is an orphan. WF-R-08 is the story that fills the org
 * structure. Until it lands, a tier that cannot be answered falls back to the next
 * NARROWER one and says so in `degradedFrom`, because the failure mode of guessing
 * wide is a cross-territory leak and the failure mode of guessing narrow is a
 * manager who sees less than they should. `supabase/functions/reports/_hierarchy.ts`
 * made the same call for reports; this is the same rule applied everywhere else.
 *
 * WHAT THIS IS NOT. It is not tenant isolation - `tenant_id` filtering stays on
 * every query and this narrows WITHIN a tenant. It is not a permission check
 * either: a user who cannot reach an endpoint at all is stopped by
 * `requireRoleLevel`, before any of this runs.
 */

/** Widest last. Comparing indexes is how a claim is prevented from widening a tier. */
export const SCOPE_TIERS = ['own', 'team', 'location', 'regional', 'company', 'platform'] as const;

export type ScopeTier = (typeof SCOPE_TIERS)[number];

/** The subset of the Supabase client this module uses. */
export interface ScopeClient {
  from(table: string): any;
}

export interface ScopeInput {
  userId: string;
  tenantId: string;
  appMetadata?: Record<string, unknown> | null;
}

export interface ResolvedScope {
  tier: ScopeTier;
  roleLevel: number;
  /** Users whose rows the caller may see. null means "no user filter". */
  userIds: string[] | null;
  /** Locations the caller may see. null means "no location filter". */
  locationIds: string[] | null;
  /** True only for a platform admin with can_access_all_tenants. */
  crossTenant: boolean;
  /** The tier that was asked for, when the org structure could not answer it. */
  degradedFrom: ScopeTier | null;
}

function tierIndex(tier: ScopeTier): number {
  return SCOPE_TIERS.indexOf(tier);
}

/** Read the WF-R-03 level claim. Absent reads as 1, the same default the gates use. */
export function scopeRoleLevel(appMetadata: Record<string, unknown> | null | undefined): number {
  const bag = appMetadata ?? {};
  const level = bag.roleLevel ?? bag.role_level;
  return typeof level === 'number' && Number.isFinite(level) ? level : 1;
}

/** The widest tier a role level is entitled to. */
export function tierForLevel(level: number): ScopeTier {
  if (level >= 8) return 'platform';
  if (level >= 7) return 'company';
  if (level >= 5) return 'regional';
  if (level >= 3) return 'team';
  return 'own';
}

/**
 * The tier to resolve for this caller.
 *
 * An explicit `accessScope` / `territoryScope` claim may NARROW what the level
 * allows - a company admin deliberately scoped to one location is a real
 * configuration - but never widen it, or the claim becomes a privilege escalation
 * anyone who can write their own metadata could use.
 */
export function requestedTier(appMetadata: Record<string, unknown> | null | undefined): ScopeTier {
  const bag = appMetadata ?? {};
  const fromLevel = tierForLevel(scopeRoleLevel(bag));
  const raw = String(
    bag.territoryScope ?? bag.territory_scope ?? bag.accessScope ?? bag.access_scope ?? '',
  )
    .toLowerCase()
    .trim();
  const claimed = (SCOPE_TIERS as readonly string[]).includes(raw) ? (raw as ScopeTier) : null;
  if (!claimed) return fromLevel;
  return tierIndex(claimed) < tierIndex(fromLevel) ? claimed : fromLevel;
}

/**
 * User ids in the tenant matching one equality, or one `in` over a list.
 *
 * Written as two explicit `.from('users')` chains rather than a callback that
 * decorates a shared query: check:phantom-cols resolves a column literal against
 * the table of the nearest preceding .from(), so a callback taking the query as an
 * argument makes every column in it look like a column of whatever table the
 * CALLER was querying - here `locations`, which reported three false positives.
 */
async function usersMatching(
  db: ScopeClient,
  tenantId: string,
  column: string,
  value: string | string[],
): Promise<string[]> {
  const base = db.from('users').select('id').eq('tenant_id', tenantId);
  const { data, error } = await (Array.isArray(value)
    ? base.in(column, value)
    : base.eq(column, value));
  if (error || !data) return [];
  return (data as { id: string }[]).map((u) => u.id);
}

/**
 * Resolve the row-visibility scope for one caller.
 *
 * Never throws: a lookup that fails degrades to `own`, which shows the caller
 * their own records rather than either hiding everything or leaking the tenant.
 */
export async function resolveScope(db: ScopeClient, input: ScopeInput): Promise<ResolvedScope> {
  const roleLevel = scopeRoleLevel(input.appMetadata);
  const asked = requestedTier(input.appMetadata);
  const base: ResolvedScope = {
    tier: asked,
    roleLevel,
    userIds: null,
    locationIds: null,
    crossTenant: false,
    degradedFrom: null,
  };

  try {
    if (asked === 'platform') {
      const meta = input.appMetadata ?? {};
      return {
        ...base,
        crossTenant: meta.isPlatformAdmin === true || meta.canAccessAllTenants === true,
      };
    }

    if (asked === 'company') return base;

    // The caller's own row carries everything the narrower tiers need.
    const { data: me } = await db
      .from('users')
      .select('id, team_id, manager_id, primary_location_id, region_id')
      .eq('id', input.userId)
      .eq('tenant_id', input.tenantId)
      .limit(1)
      .maybeSingle();

    const self = [input.userId];

    if (asked === 'regional') {
      const regionId = me?.region_id as string | undefined;
      if (regionId) {
        const { data: locs } = await db
          .from('locations')
          .select('id')
          .eq('tenant_id', input.tenantId)
          .eq('region_id', regionId);
        const locationIds = ((locs ?? []) as { id: string }[]).map((l) => l.id);
        if (locationIds.length > 0) {
          const userIds = await usersMatching(
            db,
            input.tenantId,
            'primary_location_id',
            locationIds,
          );
          return {
            ...base,
            tier: 'regional',
            locationIds,
            userIds: Array.from(new Set([...userIds, ...self])),
          };
        }
      }
      // No region on the caller, or no locations in it: nothing to resolve.
      const narrower = await resolveScope(db, {
        ...input,
        appMetadata: { ...(input.appMetadata ?? {}), territoryScope: 'location' },
      });
      // The tier that was ASKED for is the useful fact, so a two-step degrade
      // (regional -> location -> team) reports 'regional', not the intermediate.
      return { ...narrower, degradedFrom: 'regional' };
    }

    if (asked === 'location') {
      const locationId = me?.primary_location_id as string | undefined;
      if (locationId) {
        const userIds = await usersMatching(db, input.tenantId, 'primary_location_id', locationId);
        return {
          ...base,
          tier: 'location',
          locationIds: [locationId],
          userIds: Array.from(new Set([...userIds, ...self])),
        };
      }
      const narrower = await resolveScope(db, {
        ...input,
        appMetadata: { ...(input.appMetadata ?? {}), territoryScope: 'team' },
      });
      return { ...narrower, degradedFrom: 'location' };
    }

    if (asked === 'team') {
      const teamId = me?.team_id as string | undefined;
      const reports = await usersMatching(db, input.tenantId, 'manager_id', input.userId);
      const teammates = teamId ? await usersMatching(db, input.tenantId, 'team_id', teamId) : [];
      const userIds = Array.from(new Set([...self, ...reports, ...teammates]));
      // Self-only means neither a team nor a direct report exists for this user,
      // which is what an unpopulated org structure looks like.
      return {
        ...base,
        tier: 'team',
        userIds,
        degradedFrom: userIds.length === 1 ? 'team' : null,
      };
    }

    return { ...base, tier: 'own', userIds: self };
  } catch {
    return { ...base, tier: 'own', userIds: [input.userId], degradedFrom: asked };
  }
}

/** True when the scope imposes no row filter at all. */
export function isUnscoped(scope: ResolvedScope): boolean {
  return scope.userIds === null;
}

function quoteInValue(value: string): string {
  // PostgREST splits an in-list on commas and treats parentheses structurally, so
  // a value carrying either has to be quoted. Ids here are uuids, but a caller
  // could pass anything and a broken filter is worse than a slow one.
  return `"${value.replace(/["\\]/g, (c) => '\\' + c)}"`;
}

/**
 * Apply a resolved scope to a PostgREST query over one or more owner columns.
 *
 * With several columns a row is visible when ANY of them names an accessible
 * user - `business_records` has both `owner_id` and `assigned_sales_rep`, and a
 * rep who is assigned to an account they do not own must still see it.
 *
 * Rows whose owner column is NULL are INCLUDED for every tier above `own`.
 * Unassigned work is not private work: a lead nobody owns yet has to remain
 * visible to the team that is meant to pick it up, and hiding it is how a queue
 * silently empties.
 */
export function applyUserScope<Q>(query: Q, columns: string | string[], scope: ResolvedScope): Q {
  if (scope.userIds === null) return query;
  const cols = Array.isArray(columns) ? columns : [columns];
  if (cols.length === 0) return query;

  const list = scope.userIds.map(quoteInValue).join(',');
  const clauses = cols.map((c) => `${c}.in.(${list})`);
  if (scope.tier !== 'own') {
    for (const c of cols) clauses.push(`${c}.is.null`);
  }

  // A single clause still goes through `.or(...)`: PostgREST treats a one-element
  // or() identically to eq/in, and one code path is one thing to get wrong.
  return (query as any).or(clauses.join(','));
}

/**
 * The largest accessible-customer set that can be expressed as one PostgREST
 * `in()` filter. Roughly 500 uuids is 19KB of URL, already past what most
 * proxies allow in front of PostgREST, so this is a ceiling on the FILTER, not a
 * page size.
 */
export const CUSTOMER_SCOPE_CAP = 500;

export interface CustomerScope {
  /** Customer ids the caller may see. null means "no customer filter". */
  ids: string[] | null;
  /** True when the caller owns more customers than one filter can name. */
  overflow: boolean;
}

/**
 * Resolve the customers a caller may see, for tables that carry no user-id owner
 * column of their own.
 *
 * `invoices` and `equipment` are the two: an invoice's `sales_rep` is an
 * E-Automate NAME string rather than a user id, and `equipment` has no owner
 * column at all - both belong to a CUSTOMER, and the customer is what carries an
 * owner. PostgREST cannot join, so the ownership has to be resolved to an id list
 * first and applied as a filter.
 *
 * On overflow the caller must NARROW rather than widen - see applyCustomerScope.
 */
export async function accessibleCustomerIds(
  db: ScopeClient,
  tenantId: string,
  scope: ResolvedScope,
): Promise<CustomerScope> {
  if (scope.userIds === null) return { ids: null, overflow: false };

  const list = scope.userIds.map(quoteInValue).join(',');
  const clauses = [`owner_id.in.(${list})`, `assigned_sales_rep.in.(${list})`];
  if (scope.tier !== 'own') clauses.push('owner_id.is.null', 'assigned_sales_rep.is.null');

  const { data, error } = await db
    .from('companies')
    .select('id')
    .eq('tenant_id', tenantId)
    .or(clauses.join(','))
    .limit(CUSTOMER_SCOPE_CAP + 1);

  if (error || !data) return { ids: [], overflow: false };
  const ids = (data as { id: string }[]).map((c) => c.id);
  if (ids.length > CUSTOMER_SCOPE_CAP) return { ids: null, overflow: true };
  return { ids, overflow: false };
}

/**
 * Apply a customer-derived scope to a query.
 *
 * On overflow it falls back to `fallbackColumn` - a user-id column on the row
 * itself, which is strictly NARROWER than the customer set that overflowed. The
 * rule the module keeps everywhere: when a filter cannot be expressed, tighten.
 * `equipment` has no such column (it is a customer's asset and nothing else), so
 * it passes null and the overflow case matches nothing rather than everything.
 */
export function applyCustomerScope<Q>(
  query: Q,
  customerColumn: string,
  customers: CustomerScope,
  scope: ResolvedScope,
  fallbackColumn: string | null,
): Q {
  if (customers.ids === null && !customers.overflow) return query;
  if (customers.overflow) {
    if (fallbackColumn) return applyUserScope(query, fallbackColumn, scope);
    return (query as any).in(customerColumn, []);
  }
  return (query as any).in(customerColumn, customers.ids);
}
