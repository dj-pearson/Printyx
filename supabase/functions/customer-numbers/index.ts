// Customer Numbers Edge Function
// Manages customer numbering configurations + generation history.
//
// Replaces server/routes-customer-numbers.ts. The previous edge-function
// implementation queried `tenant_settings` (wrong table) and exposed
// /next, /settings, /reserve, /validate — none of which the frontend
// (CustomerNumberSettings.tsx) actually calls. Frontend uses:
//   GET  /customer-numbers/config            — list configs
//   POST /customer-numbers/config            — create (deactivates others if active)
//   PUT  /customer-numbers/config/:id        — update
//   POST /customer-numbers/generate          — generate next number using active config
//   POST /customer-numbers/assign            — assign number to record
//   POST /customer-numbers/convert-lead/:id  — convert lead to customer + assign
//   GET  /customer-numbers/history           — list generated numbers
//   POST /customer-numbers/preview           — preview format from input
//
// Tables: customer_number_config + customer_number_history (shared/schema.ts).
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

interface NumberConfig {
  id: string;
  tenant_id: string;
  prefix: string;
  current_sequence: number;
  sequence_length: number;
  separator_char: string | null;
  is_active: boolean;
}

async function generateCustomerNumber(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
): Promise<{ customerNumber: string; configId: string }> {
  // Get active config
  let { data: config } = await admin
    .from('customer_number_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();

  // Create default config if none exists
  if (!config) {
    const { data: newConfig, error } = await admin
      .from('customer_number_config')
      .insert({
        tenant_id: tenantId,
        prefix: 'CUST',
        current_sequence: 1000,
        sequence_length: 4,
        separator_char: '-',
        is_active: true,
      })
      .select()
      .single();
    if (error || !newConfig) {
      throw new Error(error?.message || 'Failed to create default config');
    }
    config = newConfig as NumberConfig;
  }

  const c = config as NumberConfig;
  const padded = String(c.current_sequence).padStart(c.sequence_length, '0');
  const customerNumber = `${c.prefix}${c.separator_char ?? ''}${padded}`;

  // Bump the sequence for next call
  await admin
    .from('customer_number_config')
    .update({ current_sequence: c.current_sequence + 1, updated_at: new Date().toISOString() })
    .eq('id', c.id);

  return { customerNumber, configId: c.id };
}

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
    const { parts } = normalizePath(url.pathname, 'customer-numbers');
    const endpoint = parts[0];
    const param = parts[1]; // /config/:id, /convert-lead/:leadId

    // ─── /config ────────────────────────────────────────────────────────────

    if (req.method === 'GET' && endpoint === 'config') {
      const { data, error } = await admin
        .from('customer_number_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching configs:', error);
        return createCorsResponse({ error: 'Failed to fetch configuration' }, 500, req);
      }
      return createCorsResponse(data ?? [], 200, req);
    }

    if (req.method === 'POST' && endpoint === 'config' && !param) {
      const body = await req.json();
      const isActive = body.isActive ?? body.is_active ?? true;

      // Deactivate existing configs if this one is being set as active
      if (isActive) {
        await admin
          .from('customer_number_config')
          .update({ is_active: false })
          .eq('tenant_id', tenantId);
      }

      const { data: config, error } = await admin
        .from('customer_number_config')
        .insert({
          tenant_id: tenantId,
          prefix: body.prefix ?? 'CUST',
          current_sequence: body.currentSequence ?? body.current_sequence ?? 1000,
          sequence_length: body.sequenceLength ?? body.sequence_length ?? 4,
          separator_char: body.separatorChar ?? body.separator_char ?? '-',
          is_active: isActive,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating config:', error);
        return createCorsResponse({ error: 'Failed to create configuration' }, 500, req);
      }
      return createCorsResponse(config, 201, req);
    }

    if (req.method === 'PUT' && endpoint === 'config' && param) {
      const body = await req.json();

      const { data: existing } = await admin
        .from('customer_number_config')
        .select('id')
        .eq('id', param)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!existing) {
        return createCorsResponse({ error: 'Configuration not found' }, 404, req);
      }

      // If activating this config, deactivate others
      if (body.isActive ?? body.is_active) {
        await admin
          .from('customer_number_config')
          .update({ is_active: false })
          .eq('tenant_id', tenantId)
          .neq('id', param);
      }

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.prefix !== undefined) update.prefix = body.prefix;
      if (body.currentSequence !== undefined) update.current_sequence = body.currentSequence;
      if (body.current_sequence !== undefined) update.current_sequence = body.current_sequence;
      if (body.sequenceLength !== undefined) update.sequence_length = body.sequenceLength;
      if (body.sequence_length !== undefined) update.sequence_length = body.sequence_length;
      if (body.separatorChar !== undefined) update.separator_char = body.separatorChar;
      if (body.separator_char !== undefined) update.separator_char = body.separator_char;
      if (body.isActive !== undefined) update.is_active = body.isActive;
      if (body.is_active !== undefined) update.is_active = body.is_active;

      const { data: updated, error } = await admin
        .from('customer_number_config')
        .update(update)
        .eq('id', param)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating config:', error);
        return createCorsResponse({ error: 'Failed to update configuration' }, 500, req);
      }
      return createCorsResponse(updated, 200, req);
    }

    // ─── /generate ──────────────────────────────────────────────────────────

    if (req.method === 'POST' && endpoint === 'generate') {
      try {
        const { customerNumber } = await generateCustomerNumber(admin, tenantId);
        return createCorsResponse({ customerNumber }, 200, req);
      } catch (err) {
        console.error('Error generating customer number:', err);
        return createCorsResponse({ error: 'Failed to generate customer number' }, 500, req);
      }
    }

    // ─── /assign ────────────────────────────────────────────────────────────

    if (req.method === 'POST' && endpoint === 'assign') {
      const body = await req.json();
      const customerId = body.customerId ?? body.customer_id;
      if (!customerId) {
        return createCorsResponse({ error: 'customerId is required' }, 400, req);
      }

      try {
        const { customerNumber, configId } = await generateCustomerNumber(admin, tenantId);

        await admin.from('customer_number_history').insert({
          tenant_id: tenantId,
          customer_id: customerId,
          customer_number: customerNumber,
          config_id: configId,
          generated_by: user.id,
        });

        await admin
          .from('business_records')
          .update({ customer_number: customerNumber, updated_at: new Date().toISOString() })
          .eq('id', customerId)
          .eq('tenant_id', tenantId);

        return createCorsResponse({ customerNumber, customerId }, 200, req);
      } catch (err) {
        console.error('Error assigning customer number:', err);
        return createCorsResponse({ error: 'Failed to assign customer number' }, 500, req);
      }
    }

    // ─── /convert-lead/:leadId ──────────────────────────────────────────────

    if (req.method === 'POST' && endpoint === 'convert-lead' && param) {
      const leadId = param;
      try {
        const { customerNumber, configId } = await generateCustomerNumber(admin, tenantId);

        await admin
          .from('business_records')
          .update({
            record_type: 'customer',
            status: 'active',
            customer_number: customerNumber,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId)
          .eq('tenant_id', tenantId);

        await admin.from('customer_number_history').insert({
          tenant_id: tenantId,
          customer_id: leadId,
          customer_number: customerNumber,
          config_id: configId,
          generated_by: user.id,
        });

        return createCorsResponse({ customerNumber, customerId: leadId }, 200, req);
      } catch (err) {
        console.error('Error converting lead to customer:', err);
        return createCorsResponse({ error: 'Failed to convert lead to customer' }, 500, req);
      }
    }

    // ─── /history ───────────────────────────────────────────────────────────

    if (req.method === 'GET' && endpoint === 'history') {
      const { data, error } = await admin
        .from('customer_number_history')
        .select('id, customer_number, generated_at, generated_by, customer_id, config_id')
        .eq('tenant_id', tenantId)
        .order('generated_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching history:', error);
        return createCorsResponse({ error: 'Failed to fetch history' }, 500, req);
      }
      return createCorsResponse(data ?? [], 200, req);
    }

    // ─── /preview ───────────────────────────────────────────────────────────

    if (req.method === 'POST' && endpoint === 'preview') {
      const body = await req.json();
      const prefix = body.prefix ?? 'CUST';
      const separator = body.separatorChar ?? body.separator_char ?? '-';
      const length = body.sequenceLength ?? body.sequence_length ?? 4;
      const seq = body.currentSequence ?? body.current_sequence ?? 1000;

      const fmt = (n: number) => `${prefix}${separator}${String(n).padStart(length, '0')}`;
      return createCorsResponse(
        {
          preview: fmt(seq),
          nextNumbers: [fmt(seq), fmt(seq + 1), fmt(seq + 2)],
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
