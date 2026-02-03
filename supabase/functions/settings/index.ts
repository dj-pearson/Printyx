// Settings Edge Function
// Handles user and tenant settings/preferences
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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

    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
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

    // GET /settings/tenant - Get tenant settings
    if (req.method === 'GET' && settingType === 'tenant') {
      const { data: tenant, error } = await admin
        .from('tenants')
        .select('settings')
        .eq('id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching tenant settings:', error);
        return createCorsResponse({ error: 'Failed to fetch tenant settings' }, 500, req);
      }

      return createCorsResponse(tenant?.settings || {}, 200, req);
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

      const { data: tenant, error } = await admin
        .from('tenants')
        .update({
          settings: body.settings || body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId)
        .select('settings')
        .single();

      if (error) {
        console.error('Error updating tenant settings:', error);
        return createCorsResponse({ error: 'Failed to update tenant settings' }, 500, req);
      }

      return createCorsResponse(tenant?.settings || {}, 200, req);
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
