// Settings Edge Function
// Handles user and tenant settings/preferences
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    // SEC-TENANT-003: user_metadata is writable by the session holder through
    // supabase.auth.updateUser, and this client uses the service role, which
    // bypasses RLS - so a tenant read from that bag is a tenant of the
    // caller's choosing. resolveTenantId takes app_metadata, then the
    // caller's users row, which neither the user nor the browser can write.
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Handle both path formats:
    // - If pathname includes function name: /settings/user → pathParts[1]
    // - If pathname is just the setting type (server.ts strips function name): /user → pathParts[0]
    const settingType = pathParts[0] === 'settings' ? pathParts[1] : pathParts[0];

    // GET /settings/user - Get user settings
    if (req.method === 'GET' && settingType === 'user') {
      const { data: settings, error } = await admin
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user settings:', error);
        return createCorsResponse({ error: 'Failed to fetch user settings' }, 500, req);
      }

      return createCorsResponse(
        settings || { user_id: user.id, tenant_id: tenantId, settings: {} },
        200,
        req,
      );
    }

    // PUT /settings/user - Update user settings
    if ((req.method === 'PUT' || req.method === 'PATCH') && settingType === 'user') {
      const body = await req.json();

      const settingsData = {
        user_id: user.id,
        tenant_id: tenantId,
        settings: body.settings || body,
        updated_at: new Date().toISOString(),
      };

      const { data: settings, error } = await admin
        .from('user_settings')
        .upsert(settingsData, { onConflict: 'user_id,tenant_id' })
        .select()
        .single();

      if (error) {
        console.error('Error updating user settings:', error);
        return createCorsResponse({ error: 'Failed to update user settings' }, 500, req);
      }

      return createCorsResponse(settings, 200, req);
    }

    /**
     * GET /settings/tenant - Get tenant settings.
     *
     * AUDIT-037: this read `tenants.settings`, which is not a column. The
     * jsonb blob a tenant's settings live in is `metadata` - it is where
     * auto-lead-routing already stores its configuration - so every read and
     * write on this branch was a 42703 and tenant settings have never been
     * readable or savable through it.
     */
    if (req.method === 'GET' && settingType === 'tenant') {
      const { data: tenant, error } = await admin
        .from('tenants')
        .select('metadata')
        .eq('id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching tenant settings:', error);
        return createCorsResponse({ error: 'Failed to fetch tenant settings' }, 500, req);
      }

      return createCorsResponse(tenant?.metadata || {}, 200, req);
    }

    // PUT /settings/tenant - Update tenant settings (admin only)
    if ((req.method === 'PUT' || req.method === 'PATCH') && settingType === 'tenant') {
      const body = await req.json();

      // Check if user has admin permissions
      const { data: userData } = await admin
        .from('users')
        .select('role_id')
        .eq('id', user.id)
        .eq('tenant_id', tenantId)
        .single();

      if (!userData?.role_id) {
        return createCorsResponse({ error: 'Insufficient permissions' }, 403, req);
      }

      /**
       * MERGED, NOT REPLACED, and that is the half that matters.
       *
       * Rebinding `settings` to `metadata` alone would turn a guaranteed
       * 42703 into silent data loss: `metadata` is a SHARED blob - auto-lead
       * routing keeps its configuration there, and anything else that lands
       * on a tenant row will too - so writing `body.settings` over the top
       * would erase every key this caller did not happen to send. That is the
       * WhiteLabelDashboard defect one table over, where a blind overwrite
       * wiped a tenant's branding on the first save.
       *
       * Read-then-merge is not atomic. Two admins saving different settings in
       * the same second would lose one of the two, which is worth knowing and
       * is a far smaller failure than the blanket overwrite it replaces.
       */
      const { data: existing } = await admin
        .from('tenants')
        .select('metadata')
        .eq('id', tenantId)
        .single();

      const incoming = (body.settings || body) as Record<string, unknown>;
      const merged = { ...((existing?.metadata as Record<string, unknown>) ?? {}), ...incoming };

      const { data: tenant, error } = await admin
        .from('tenants')
        .update({
          metadata: merged,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId)
        .select('metadata')
        .single();

      if (error) {
        console.error('Error updating tenant settings:', error);
        return createCorsResponse({ error: 'Failed to update tenant settings' }, 500, req);
      }

      return createCorsResponse(tenant?.metadata || {}, 200, req);
    }

    // GET /settings/dashboard - Get dashboard layout
    if (req.method === 'GET' && settingType === 'dashboard') {
      const { data: layout, error } = await admin
        .from('dashboard_layouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching dashboard layout:', error);
        return createCorsResponse({ error: 'Failed to fetch dashboard layout' }, 500, req);
      }

      return createCorsResponse(
        layout || { user_id: user.id, tenant_id: tenantId, layout: [] },
        200,
        req,
      );
    }

    // PUT /settings/dashboard - Update dashboard layout
    if ((req.method === 'PUT' || req.method === 'PATCH') && settingType === 'dashboard') {
      const body = await req.json();

      const layoutData = {
        user_id: user.id,
        tenant_id: tenantId,
        layout: body.layout || body,
        updated_at: new Date().toISOString(),
      };

      const { data: layout, error } = await admin
        .from('dashboard_layouts')
        .upsert(layoutData, { onConflict: 'user_id,tenant_id' })
        .select()
        .single();

      if (error) {
        console.error('Error updating dashboard layout:', error);
        return createCorsResponse({ error: 'Failed to update dashboard layout' }, 500, req);
      }

      return createCorsResponse(layout, 200, req);
    }

    return createCorsResponse({ error: 'Invalid settings type or method' }, 400, req);
  } catch (error) {
    console.error('Error in settings function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
