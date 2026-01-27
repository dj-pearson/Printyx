// Tenant Settings Edge Function
// Handles tenant configuration settings
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
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const settingCategory = pathParts[1];

    // GET /tenant-settings - Get all settings
    if (req.method === 'GET' && !settingCategory) {
      const { data: settings, error } = await admin
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching tenant settings:', error);
        return createCorsResponse({ error: 'Failed to fetch settings' }, 500, req);
      }

      // Return defaults if no settings exist
      return createCorsResponse(
        settings || {
          company_name: '',
          company_email: '',
          company_phone: '',
          address: '',
          city: '',
          state: '',
          zip_code: '',
          country: 'US',
          timezone: 'America/New_York',
          date_format: 'MM/DD/YYYY',
          currency: 'USD',
          logo_url: null,
        },
        200,
        req,
      );
    }

    // GET /tenant-settings/general - Get general settings
    if (req.method === 'GET' && settingCategory === 'general') {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select(
          'company_name, company_email, company_phone, address, city, state, zip_code, country, logo_url, website',
        )
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(settings || {}, 200, req);
    }

    // GET /tenant-settings/localization - Get localization settings
    if (req.method === 'GET' && settingCategory === 'localization') {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select('timezone, date_format, time_format, currency, language, number_format')
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(
        settings || {
          timezone: 'America/New_York',
          date_format: 'MM/DD/YYYY',
          time_format: '12h',
          currency: 'USD',
          language: 'en',
          number_format: '1,234.56',
        },
        200,
        req,
      );
    }

    // GET /tenant-settings/invoicing - Get invoicing settings
    if (req.method === 'GET' && settingCategory === 'invoicing') {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select(
          'invoice_prefix, invoice_sequence, invoice_terms, default_payment_terms, tax_rate, invoice_footer, invoice_notes',
        )
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(
        settings || {
          invoice_prefix: 'INV',
          invoice_sequence: 1000,
          invoice_terms: 'Net 30',
          default_payment_terms: 30,
          tax_rate: 0,
          invoice_footer: '',
          invoice_notes: '',
        },
        200,
        req,
      );
    }

    // GET /tenant-settings/notifications - Get notification settings
    if (req.method === 'GET' && settingCategory === 'notifications') {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select(
          'email_notifications_enabled, sms_notifications_enabled, notification_email, low_stock_alerts, contract_expiry_alerts, payment_due_alerts',
        )
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(
        settings || {
          email_notifications_enabled: true,
          sms_notifications_enabled: false,
          notification_email: '',
          low_stock_alerts: true,
          contract_expiry_alerts: true,
          payment_due_alerts: true,
        },
        200,
        req,
      );
    }

    // GET /tenant-settings/branding - Get branding settings
    if (req.method === 'GET' && settingCategory === 'branding') {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select('logo_url, favicon_url, primary_color, secondary_color, accent_color, custom_css')
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(
        settings || {
          logo_url: null,
          favicon_url: null,
          primary_color: '#3B82F6',
          secondary_color: '#6B7280',
          accent_color: '#10B981',
          custom_css: '',
        },
        200,
        req,
      );
    }

    // PUT /tenant-settings - Update all settings
    if (req.method === 'PUT' && !settingCategory) {
      const body = await req.json();

      const { data: settings, error } = await admin
        .from('tenant_settings')
        .upsert({
          tenant_id: tenantId,
          ...body,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating tenant settings:', error);
        return createCorsResponse({ error: 'Failed to update settings' }, 500, req);
      }

      return createCorsResponse(settings, 200, req);
    }

    // PUT /tenant-settings/:category - Update settings category
    if (req.method === 'PUT' && settingCategory) {
      const body = await req.json();

      // Get existing settings first
      const { data: existing } = await admin
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      const { data: settings, error } = await admin
        .from('tenant_settings')
        .upsert({
          ...existing,
          tenant_id: tenantId,
          ...body,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update settings' }, 500, req);
      }

      return createCorsResponse(settings, 200, req);
    }

    // GET /tenant-settings/features - Get enabled features
    if (req.method === 'GET' && settingCategory === 'features') {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select('enabled_features, feature_flags')
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(
        settings?.enabled_features || {
          crm: true,
          service: true,
          billing: true,
          inventory: true,
          reporting: true,
          api_access: false,
        },
        200,
        req,
      );
    }

    // PUT /tenant-settings/features - Update enabled features
    if (req.method === 'PUT' && settingCategory === 'features') {
      const body = await req.json();

      const { data: settings, error } = await admin
        .from('tenant_settings')
        .upsert({
          tenant_id: tenantId,
          enabled_features: body,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update features' }, 500, req);
      }

      return createCorsResponse(settings, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in tenant-settings function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
