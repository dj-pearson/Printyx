// Shared cross-tenant guard for edge functions that use the RLS-bypassing
// service client (CR-002). Because the service client ignores row-level
// security, every by-id read/update/delete MUST also constrain tenant_id;
// call this before touching a row identified only by a client-supplied id.
//
// `admin` is a Supabase service client (typed `any` to avoid pulling the Deno
// supabase-js types into the Node test harness). This module has no imports so
// it is importable from both Deno edge functions and vitest.

// deno-lint-ignore no-explicit-any
type Admin = any;

/**
 * Returns true iff a row with the given id exists in `table` AND belongs to
 * `tenantId`. Returns false for a missing tenant id, a missing row, or a row
 * owned by a different tenant — the caller should then respond 404/403.
 */
export async function rowBelongsToTenant(
  admin: Admin,
  table: string,
  id: string | undefined | null,
  tenantId: string | undefined | null,
): Promise<boolean> {
  if (!id || !tenantId) return false;
  const { data } = await admin
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return !!data;
}
