// CR-010: resolve the caller's tenant from the VERIFIED JWT only.
//
// app_metadata is set server-side (admin API) and is trustworthy; user_metadata
// is editable by the user via the client SDK, and the x-tenant-id header is fully
// attacker-controlled. Edge functions that use the service role (which bypasses
// RLS) must therefore derive the tenant from app_metadata.tenantId ONLY — never
// from user_metadata or a request header — or a user can read/write another
// tenant's rows by spoofing them.
//
// `user` is the object returned by supabase.auth.getUser(jwt) (typed loosely to
// avoid pulling the Deno supabase-js types into the Node test harness).

// deno-lint-ignore no-explicit-any
type AuthUser = { app_metadata?: Record<string, any> } | null | undefined;

/**
 * Return the tenant id from the verified JWT's app_metadata, or null. Callers
 * using the service client should 400/403 when this is null rather than falling
 * back to any user-controlled source.
 */
export function tenantFromJwt(user: AuthUser): string | null {
  const meta = user?.app_metadata;
  if (!meta) return null;
  const id = meta.tenantId ?? meta.tenant_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
