/**
 * Read a permission code off the WF-R-03 claim (WF-P-05).
 *
 * Deliberately NOT `_shared/rbac.ts`'s requirePermission: that one falls back to a
 * DB lookup through a `setPermissionLookup` hook no function registers, so on a
 * cache miss it returns an empty set and denies. This is the claim-only question,
 * which is the one an edge function can actually answer.
 *
 * A caller with NO permissions claim at all is DENIED, not admitted. A token issued
 * before WF-R-03 has no list, and reading "no list" as "everything" is how a gate
 * comes to pass for the people it exists to stop; requireAuth backfills the claim on
 * the first request, so the state is brief and self-correcting.
 */

export function permissionClaims(
  appMetadata: Record<string, unknown> | null | undefined,
): string[] {
  const raw = (appMetadata ?? {}).permissions;
  return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string') : [];
}

/** True when the claim carries this exact code, or the platform-admin flag. */
export function hasPermissionClaim(
  appMetadata: Record<string, unknown> | null | undefined,
  code: string,
): boolean {
  const meta = appMetadata ?? {};
  // A platform admin bypasses, the same rule _shared/rbac.ts applies.
  if (meta.isPlatformAdmin === true) return true;
  const level = meta.roleLevel ?? meta.role_level;
  if (typeof level === 'number' && level >= 8) return true;

  return permissionClaims(meta).includes(code);
}
