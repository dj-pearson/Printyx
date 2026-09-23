/**
 * Who may hand out which role.
 *
 * The admin function let any caller who passed its admin gate (role level 6,
 * or `can_manage_users`) invite a user with ANY `roleId`, and edit any user to
 * any role. `roles` is a global catalogue that includes the platform tiers, so
 * a company admin could invite a colleague - or edit themselves - into a role
 * above their own, including one with `can_access_all_tenants`, which is a
 * cross-tenant grant. The only check in that code refused self-DEMOTION.
 *
 * Two rules, both needed:
 *  1. A role above the granter's own level cannot be granted.
 *  2. A role that reaches every tenant cannot be granted by someone whose own
 *     role does not, whatever the levels say: level alone does not encode
 *     cross-tenant reach.
 *
 * An unknown role is refused rather than passed through, because a role id
 * that resolves to nothing is exactly what a probe looks like.
 */

export interface RoleForGrant {
  level: number | null;
  canAccessAllTenants?: boolean | null;
}

export type GrantDecision =
  | { ok: true }
  | {
      ok: false;
      code: 'UNKNOWN_ROLE' | 'ROLE_ABOVE_GRANTER' | 'CROSS_TENANT_ROLE';
      reason: string;
    };

export function decideRoleGrant(
  granter: RoleForGrant | null | undefined,
  target: RoleForGrant | null | undefined,
): GrantDecision {
  if (!target) {
    return { ok: false, code: 'UNKNOWN_ROLE', reason: 'That role does not exist.' };
  }
  const granterLevel = granter?.level ?? 0;
  const targetLevel = target.level ?? Number.POSITIVE_INFINITY;
  if (targetLevel > granterLevel) {
    return {
      ok: false,
      code: 'ROLE_ABOVE_GRANTER',
      reason: 'You cannot grant a role above your own.',
    };
  }
  if (target.canAccessAllTenants === true && granter?.canAccessAllTenants !== true) {
    return {
      ok: false,
      code: 'CROSS_TENANT_ROLE',
      reason: 'That role reaches every tenant and can only be granted by a role that does.',
    };
  }
  return { ok: true };
}
