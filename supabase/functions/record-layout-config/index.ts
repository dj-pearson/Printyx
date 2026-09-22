// Record page layout config (CRM-008).
//
// Endpoints (the dispatcher strips the function-name segment first):
//   GET    /?objectType=deals    the layout this user should see
//   PUT    /                     save a layout (manager and above)
//   DELETE /?objectType=deals    restore the shipped layout
//
// THIS REPLACES server/routes-record-layout.ts, WHICH COULD NEVER RUN IN
// PRODUCTION. `/api/record-layout-config` was Express-only and unproxied, so
// under the getApiUrl architecture every call 404'd on the functions host -
// and nothing called it anyway, because the component it exists for
// (RecordPageLayout) had never been written. `check:uncalled-express` is the
// guard that found it.
//
// A GET NEVER 404s AND NEVER RETURNS NULL. A record page whose layout request
// fails has nothing to render, so the absence of a stored row answers with the
// SHIPPED layout and says `isDefault: true`. That also means nothing has to be
// seeded for the feature to work, and a tenant that has never opened the
// settings screen still gets a complete page.
//
// ROLE IS RESOLVED, NOT TAKEN FROM THE QUERY STRING. The Express version read
// ?roleId= and trusted it, which lets any caller ask for any role's layout.
// The caller's role comes off their own users row here.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
import {
  DEFAULT_LAYOUTS,
  isValidSection,
  mergeLayout,
  type LayoutSection,
  type RecordObjectType,
} from '../../../shared/record-layout.ts';

type Row = Record<string, any>;

const OBJECT_TYPES = Object.keys(DEFAULT_LAYOUTS) as RecordObjectType[];

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    const url = new URL(req.url);
    // Flat resource: everything hangs off the prefix itself.
    normalizePath(url.pathname, 'record-layout-config');

    const objectType = String(url.searchParams.get('objectType') ?? '') as RecordObjectType;
    if (!OBJECT_TYPES.includes(objectType)) {
      return createCorsResponse(
        { error: `objectType must be one of ${OBJECT_TYPES.join(', ')}`, code: 'BAD_OBJECT_TYPE' },
        400,
        req,
      );
    }

    /** The caller's own role, read from their user row - never from the query. */
    const callerRoleId = async (): Promise<string | null> => {
      const { data } = await admin
        .from('users')
        .select('role_id')
        .eq('id', user.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return (data as Row)?.role_id ?? null;
    };

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('record_layout_configs')
        .select('id, role_id, layout_sections, updated_at')
        .eq('tenant_id', tenantId)
        .eq('object_type', objectType);
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as Row[];
      const roleId = await callerRoleId();
      // A layout for the caller's role beats the tenant default; the tenant
      // default beats the shipped one.
      const row =
        (roleId ? rows.find((r) => r.role_id === roleId) : undefined) ??
        rows.find((r) => !r.role_id) ??
        null;

      const stored = (row?.layout_sections ?? null) as LayoutSection[] | null;
      return createCorsResponse(
        {
          objectType,
          sections: mergeLayout(stored, objectType),
          isDefault: !row,
          appliedRoleId: row?.role_id ?? null,
          configId: row?.id ?? null,
          updatedAt: row?.updated_at ?? null,
        },
        200,
        req,
      );
    }

    // Saving or resetting a layout reshapes the record page for everyone it
    // applies to, so both are management acts. A LEVEL check, not a permission
    // code (SEC-EDGE-002).
    const authCtx: AuthContext = {
      userId: user.id,
      tenantId,
      email: user.email,
      jwt: jwt ?? '',
      supabaseUser: user,
    };
    try {
      requireRoleLevel(authCtx, ROLE_LEVEL.MANAGER);
    } catch (err) {
      if (err instanceof RbacError) {
        return createCorsResponse(
          {
            error: 'Changing a record page layout requires a manager role',
            code: 'INSUFFICIENT_ROLE',
            details: err.details,
          },
          403,
          req,
        );
      }
      throw err;
    }

    if (req.method === 'PUT') {
      const body = (await req.json().catch(() => ({}))) as Row;
      const sections = body.sections ?? body.layoutSections;
      if (!Array.isArray(sections) || sections.length === 0) {
        return createCorsResponse(
          { error: 'sections must be a non-empty array', code: 'BAD_SECTIONS' },
          400,
          req,
        );
      }
      const bad = sections.findIndex((s: unknown) => !isValidSection(s));
      if (bad >= 0) {
        // Naming the index beats "invalid layout" when a section list is long.
        return createCorsResponse(
          { error: `sections[${bad}] is not a valid layout section`, code: 'BAD_SECTIONS' },
          400,
          req,
        );
      }
      const roleId = body.roleId ? String(body.roleId) : null;

      // No unique index covers (tenant_id, object_type, role_id), so an upsert
      // would need one and a blind insert would duplicate. Read, then write.
      const { data: existing } = await admin
        .from('record_layout_configs')
        .select('id, role_id')
        .eq('tenant_id', tenantId)
        .eq('object_type', objectType);
      const match = ((existing ?? []) as Row[]).find((r) => (r.role_id ?? null) === roleId);

      const nowIso = new Date().toISOString();
      if (match) {
        const { error } = await admin
          .from('record_layout_configs')
          .update({ layout_sections: sections, updated_at: nowIso })
          .eq('id', match.id)
          .eq('tenant_id', tenantId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await admin.from('record_layout_configs').insert({
          tenant_id: tenantId,
          object_type: objectType,
          role_id: roleId,
          layout_sections: sections,
          updated_at: nowIso,
        });
        if (error) throw new Error(error.message);
      }

      return createCorsResponse(
        { objectType, sections: mergeLayout(sections as LayoutSection[], objectType), roleId },
        200,
        req,
      );
    }

    if (req.method === 'DELETE') {
      const roleId = url.searchParams.get('roleId');
      let query = admin
        .from('record_layout_configs')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('object_type', objectType);
      // PostgREST cannot express "is null" through .eq, so the two cases split.
      query = roleId ? query.eq('role_id', roleId) : query.is('role_id', null);
      const { error } = await query;
      if (error) throw new Error(error.message);
      return createCorsResponse(
        { objectType, sections: mergeLayout(null, objectType), isDefault: true },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('[RECORD-LAYOUT-CONFIG] error:', error);
    return createCorsResponse(
      { error: 'Request failed', message: (error as Error).message },
      500,
      req,
    );
  }
}
