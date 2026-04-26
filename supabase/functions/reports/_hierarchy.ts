// Accessible-user-IDs resolver for hierarchical reports.
//
// Ported from server/middleware/hierarchical-query-builder.ts::334-383. The
// rule set, parameterized by the caller's `territoryScope`:
//
//   platform | company → all users in tenant
//   regional | location → users in accessible locations (TODO: location lookup
//                          requires the org-unit table; falls back to team
//                          scope when not yet wired)
//   team               → self + direct reports (users.manager_id = self)
//   own | (default)    → self only
//
// The territoryScope is read from JWT app_metadata.territoryScope when
// present, otherwise defaults to 'team' — the sensible middle ground when
// older JWTs lack the claim. The Express version pulled this from
// EnhancedUserContext built by RBAC middleware; we don't have that here, so
// we lean on the JWT and tolerate the loss of fidelity.

import type { AuthContext } from '../_shared/auth.ts';
import type { SupabaseClient } from '../_shared/db.ts';

export type TerritoryScope = 'platform' | 'company' | 'regional' | 'location' | 'team' | 'own';

const SCOPES: ReadonlySet<string> = new Set([
  'platform',
  'company',
  'regional',
  'location',
  'team',
  'own',
]);

export function getTerritoryScope(auth: AuthContext): TerritoryScope {
  const claim =
    (auth.supabaseUser.app_metadata?.territoryScope as string | undefined) ??
    (auth.supabaseUser.app_metadata?.territory_scope as string | undefined);
  if (claim && SCOPES.has(claim)) return claim as TerritoryScope;
  return 'team';
}

export async function getAccessibleUserIds(
  db: SupabaseClient,
  auth: AuthContext,
  scope: TerritoryScope = getTerritoryScope(auth),
): Promise<string[]> {
  switch (scope) {
    case 'platform':
    case 'company': {
      const { data } = await db.from('users').select('id').eq('tenant_id', auth.tenantId);
      return (data ?? []).map((u) => u.id as string);
    }

    case 'regional':
    case 'location': {
      // Pending: org-unit / location tree lookup. Until that lands we
      // degrade to team scope rather than failing closed (would hide all
      // data) or open (would leak cross-team data).
      return getAccessibleUserIds(db, auth, 'team');
    }

    case 'team': {
      const { data } = await db
        .from('users')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .or(`manager_id.eq.${auth.userId},id.eq.${auth.userId}`);
      return (data ?? []).map((u) => u.id as string);
    }

    case 'own':
    default:
      return [auth.userId];
  }
}
