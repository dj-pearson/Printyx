// /billing/configurations — billing configuration presets (EDGE-002a).
//
// Ported from server/routes-billing-core.ts (raw SQL against the
// `billing_configurations` DRIFT table — see _context.ts schema audit).
// Frontend contract (AdvancedBillingEngine.tsx): both endpoints return/accept
// snake_case fields and the list is a BARE ARRAY.
//
//   GET  /billing/configurations?type=  → row[]      ([] when table missing)
//   POST /billing/configurations        → 201 row    (503 when table missing)

import { createCorsResponse } from '../../_shared/cors.ts';
import { type BillingCtx, isMissingTableError } from './_context.ts';

const TABLE = 'billing_configurations';

export async function handleConfigurations(ctx: BillingCtx): Promise<Response | null> {
  const { req, admin, tenantId, url } = ctx;

  if (req.method === 'GET') {
    const type = url.searchParams.get('type');

    let query = admin
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('is_default', { ascending: false })
      .order('configuration_name', { ascending: true });

    if (type && type !== 'all') {
      query = query.eq('billing_type', type);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        console.error(`${TABLE} table missing — returning empty list (drift table)`);
        return createCorsResponse([], 200, req);
      }
      console.error('Error fetching billing configurations:', error);
      return createCorsResponse({ error: 'Failed to fetch billing configurations' }, 500, req);
    }
    return createCorsResponse(data || [], 200, req);
  }

  if (req.method === 'POST') {
    const body = await req.json();

    if (!body.configuration_name || !body.billing_type) {
      return createCorsResponse(
        { error: 'configuration_name and billing_type are required' },
        400,
        req,
      );
    }

    // Default-row uniqueness: clear other defaults in the same call.
    if (body.is_default) {
      const { error: clearError } = await admin
        .from(TABLE)
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .eq('is_default', true);
      if (clearError && !isMissingTableError(clearError)) {
        console.error('Error clearing default configurations:', clearError);
      }
    }

    const row = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      configuration_name: body.configuration_name,
      billing_type: body.billing_type,
      billing_frequency: body.billing_frequency ?? null,
      billing_day: body.billing_day ?? null,
      base_rate: body.base_rate ?? null,
      minimum_charge: body.minimum_charge ?? null,
      maximum_charge: body.maximum_charge ?? null,
      overage_rate: body.overage_rate ?? null,
      setup_fee: body.setup_fee ?? null,
      maintenance_fee: body.maintenance_fee ?? null,
      tax_rate: body.tax_rate ?? null,
      tax_inclusive: body.tax_inclusive ?? false,
      contract_length_months: body.contract_length_months ?? null,
      early_termination_fee: body.early_termination_fee ?? null,
      is_default: body.is_default ?? false,
    };

    const { data, error } = await admin.from(TABLE).insert(row).select().single();
    if (error) {
      if (isMissingTableError(error)) {
        return createCorsResponse(
          {
            error: 'Billing configurations storage is not provisioned',
            degraded: { reason: `${TABLE} table missing in this environment` },
          },
          503,
          req,
        );
      }
      console.error('Error creating billing configuration:', error);
      return createCorsResponse({ error: 'Failed to create billing configuration' }, 500, req);
    }
    return createCorsResponse(data, 201, req);
  }

  return null;
}
