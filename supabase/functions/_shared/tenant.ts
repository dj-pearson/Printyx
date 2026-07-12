// Canonical tenant-id resolution for edge functions.
//
// The signup flow writes `app_metadata.tenantId` (camelCase), but older tokens
// and some code read `tenant_id` (snake_case). Depending on which spelling a
// function checked, tenant resolution silently returned undefined — scoping
// queries to nothing or returning "No tenant ID" (PA-002/PA-003).
//
// Every edge function that needs the caller's tenant should resolve it through
// this helper so the accepted claim key is consistent across the whole surface.

export interface MetadataUser {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Resolve the caller's tenant id from a Supabase auth user, accepting both the
 * canonical camelCase `tenantId` and the legacy snake_case `tenant_id`, in
 * both the app and user metadata bags. Returns undefined when absent.
 */
export function resolveTenantId(user: MetadataUser | null | undefined): string | undefined {
  const app = (user?.app_metadata ?? {}) as Record<string, unknown>;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const candidate = app.tenantId ?? app.tenant_id ?? meta.tenantId ?? meta.tenant_id;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
}
