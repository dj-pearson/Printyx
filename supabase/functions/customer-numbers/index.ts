// Customer Numbers Edge Function
// Handles customer number generation and management
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
    const endpoint = pathParts[1];

    // GET /customer-numbers/next - Get next customer number
    if (req.method === 'GET' && endpoint === 'next') {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select('customer_number_prefix, customer_number_sequence')
        .eq('tenant_id', tenantId)
        .single();

      const prefix = settings?.customer_number_prefix || 'CUST';
      const sequence = (settings?.customer_number_sequence || 0) + 1;
      const paddedSequence = sequence.toString().padStart(6, '0');

      return createCorsResponse(
        {
          nextNumber: `${prefix}-${paddedSequence}`,
          prefix,
          sequence,
        },
        200,
        req,
      );
    }

    // GET /customer-numbers/settings - Get numbering settings
    if (req.method === 'GET' && endpoint === 'settings') {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select('customer_number_prefix, customer_number_sequence, customer_number_format')
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(
        settings || {
          customer_number_prefix: 'CUST',
          customer_number_sequence: 0,
          customer_number_format: '{prefix}-{sequence:6}',
        },
        200,
        req,
      );
    }

    // PUT /customer-numbers/settings - Update numbering settings
    if (req.method === 'PUT' && endpoint === 'settings') {
      const body = await req.json();

      const { data: settings, error } = await admin
        .from('tenant_settings')
        .upsert({
          tenant_id: tenantId,
          customer_number_prefix: body.prefix || body.customer_number_prefix,
          customer_number_sequence: body.sequence || body.customer_number_sequence,
          customer_number_format: body.format || body.customer_number_format,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update settings' }, 500, req);
      }

      return createCorsResponse(settings, 200, req);
    }

    // POST /customer-numbers/reserve - Reserve next customer number
    if (req.method === 'POST' && endpoint === 'reserve') {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select('customer_number_prefix, customer_number_sequence')
        .eq('tenant_id', tenantId)
        .single();

      const prefix = settings?.customer_number_prefix || 'CUST';
      const sequence = (settings?.customer_number_sequence || 0) + 1;

      // Update sequence
      await admin.from('tenant_settings').upsert({
        tenant_id: tenantId,
        customer_number_sequence: sequence,
        updated_at: new Date().toISOString(),
      });

      const paddedSequence = sequence.toString().padStart(6, '0');

      return createCorsResponse(
        {
          reservedNumber: `${prefix}-${paddedSequence}`,
          sequence,
        },
        200,
        req,
      );
    }

    // GET /customer-numbers/validate/:number - Validate customer number
    if (req.method === 'GET' && endpoint === 'validate') {
      const numberToValidate = pathParts[2];

      const { data: existing } = await admin
        .from('business_records')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('customer_number', numberToValidate)
        .single();

      return createCorsResponse(
        {
          number: numberToValidate,
          isValid: !existing,
          isAvailable: !existing,
          existingId: existing?.id,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in customer-numbers function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
