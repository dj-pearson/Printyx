// Managed Services Edge Function
// Handles managed print services contracts and monitoring
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
    // Server strips function name, so /managed-services/contracts becomes /contracts
    const endpoint = pathParts[0];
    const contractId = pathParts[1];

    // GET /managed-services/contracts - List MPS contracts
    if (req.method === 'GET' && endpoint === 'contracts' && !contractId) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');

      let query = admin
        .from('managed_services_contracts')
        .select(
          `
          *,
          customer:customer_id (
            id,
            company_name
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data: contracts, error } = await query;

      if (error) {
        console.error('Error fetching managed services contracts:', error);
        return createCorsResponse({ error: 'Failed to fetch contracts' }, 500, req);
      }

      return createCorsResponse(contracts || [], 200, req);
    }

    // GET /managed-services/contracts/:id - Get single contract
    if (req.method === 'GET' && endpoint === 'contracts' && contractId) {
      const { data: contract, error } = await admin
        .from('managed_services_contracts')
        .select('*')
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Contract not found' }, 404, req);
      }

      // Get covered devices
      const { data: devices } = await admin
        .from('mps_covered_devices')
        .select(
          `
          *,
          equipment:equipment_id (*)
        `,
        )
        .eq('contract_id', contractId);

      // Get billing history
      const { data: billing } = await admin
        .from('mps_billing_records')
        .select('*')
        .eq('contract_id', contractId)
        .order('billing_date', { ascending: false })
        .limit(12);

      return createCorsResponse(
        {
          ...contract,
          devices: devices || [],
          billingHistory: billing || [],
        },
        200,
        req,
      );
    }

    // POST /managed-services/contracts - Create contract
    if (req.method === 'POST' && endpoint === 'contracts') {
      const body = await req.json();

      const contractData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        contract_number: body.contractNumber || body.contract_number || `MPS-${Date.now()}`,
        contract_type: body.contractType || body.contract_type || 'cost_per_page',
        status: body.status || 'draft',
        start_date: body.startDate || body.start_date,
        end_date: body.endDate || body.end_date,
        billing_frequency: body.billingFrequency || body.billing_frequency || 'monthly',
        base_fee: body.baseFee || body.base_fee || 0,
        mono_rate: body.monoRate || body.mono_rate,
        color_rate: body.colorRate || body.color_rate,
        included_mono_pages: body.includedMonoPages || body.included_mono_pages || 0,
        included_color_pages: body.includedColorPages || body.included_color_pages || 0,
        overage_mono_rate: body.overageMonoRate || body.overage_mono_rate,
        overage_color_rate: body.overageColorRate || body.overage_color_rate,
        supplies_included: body.suppliesIncluded !== false,
        service_included: body.serviceIncluded !== false,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: contract, error } = await admin
        .from('managed_services_contracts')
        .insert(contractData)
        .select()
        .single();

      if (error) {
        console.error('Error creating MPS contract:', error);
        return createCorsResponse({ error: 'Failed to create contract' }, 500, req);
      }

      return createCorsResponse(contract, 201, req);
    }

    // PUT /managed-services/contracts/:id - Update contract
    if (req.method === 'PUT' && endpoint === 'contracts' && contractId) {
      const body = await req.json();

      const { data: contract, error } = await admin
        .from('managed_services_contracts')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update contract' }, 500, req);
      }

      return createCorsResponse(contract, 200, req);
    }

    // GET /managed-services/usage - Get usage statistics
    if (req.method === 'GET' && endpoint === 'usage') {
      const contractIdParam = url.searchParams.get('contractId');
      const month = url.searchParams.get('month');

      let query = admin
        .from('mps_meter_readings')
        .select(
          `
          *,
          device:device_id (
            id,
            serial_number,
            model
          )
        `,
        )
        .eq('tenant_id', tenantId);

      if (contractIdParam) query = query.eq('contract_id', contractIdParam);

      const { data: readings } = await query.order('reading_date', { ascending: false }).limit(100);

      return createCorsResponse(readings || [], 200, req);
    }

    // POST /managed-services/meter-reading - Record meter reading
    if (req.method === 'POST' && endpoint === 'meter-reading') {
      const body = await req.json();

      const { data: reading, error } = await admin
        .from('mps_meter_readings')
        .insert({
          tenant_id: tenantId,
          contract_id: body.contractId || body.contract_id,
          device_id: body.deviceId || body.device_id,
          mono_count: body.monoCount || body.mono_count || 0,
          color_count: body.colorCount || body.color_count || 0,
          reading_date: body.readingDate || body.reading_date || new Date().toISOString(),
          reading_source: body.readingSource || body.reading_source || 'manual',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to record meter reading' }, 500, req);
      }

      return createCorsResponse(reading, 201, req);
    }

    // GET /managed-services/dashboard - Get MPS dashboard data
    if (req.method === 'GET' && endpoint === 'dashboard') {
      const { count: totalContracts } = await admin
        .from('managed_services_contracts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      const { count: totalDevices } = await admin
        .from('mps_covered_devices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      const { data: recentBilling } = await admin
        .from('mps_billing_records')
        .select('total_amount')
        .eq('tenant_id', tenantId)
        .gte('billing_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const monthlyRevenue = (recentBilling || []).reduce(
        (sum: number, r: any) => sum + (r.total_amount || 0),
        0,
      );

      return createCorsResponse(
        {
          totalContracts: totalContracts || 0,
          totalDevices: totalDevices || 0,
          monthlyRevenue,
          alertCount: 0,
        },
        200,
        req,
      );
    }

    // POST /managed-services/billing/generate - Generate billing
    if (req.method === 'POST' && endpoint === 'billing' && pathParts[2] === 'generate') {
      const body = await req.json();

      // In production, this would calculate actual billing based on meter readings
      const { data: billing, error } = await admin
        .from('mps_billing_records')
        .insert({
          tenant_id: tenantId,
          contract_id: body.contractId || body.contract_id,
          billing_date: new Date().toISOString(),
          billing_period_start: body.periodStart || body.billing_period_start,
          billing_period_end: body.periodEnd || body.billing_period_end,
          mono_pages: body.monoPages || 0,
          color_pages: body.colorPages || 0,
          base_fee: body.baseFee || 0,
          page_charges: body.pageCharges || 0,
          overage_charges: body.overageCharges || 0,
          total_amount: body.totalAmount || 0,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to generate billing' }, 500, req);
      }

      return createCorsResponse(billing, 201, req);
    }

    // DELETE /managed-services/contracts/:id - Delete contract
    if (req.method === 'DELETE' && endpoint === 'contracts' && contractId) {
      const { error } = await admin
        .from('managed_services_contracts')
        .delete()
        .eq('id', contractId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete contract' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Contract deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in managed-services function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
