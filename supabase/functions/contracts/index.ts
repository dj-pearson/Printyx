// Contracts Edge Function
// Handles service contracts and tiered billing
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// Helper: Batch-enrich records with customer names from business_records
async function enrichWithCustomerNames(admin: any, records: any[]) {
  if (!records || records.length === 0) return records;
  const customerIds = [...new Set(records.map((r: any) => r.customer_id).filter(Boolean))];
  if (customerIds.length === 0) return records;

  const { data: customers } = await admin
    .from('business_records')
    .select('id, company_name, primary_contact_name')
    .in('id', customerIds);

  const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));
  return records.map((r: any) => ({
    ...r,
    customer_name: customerMap.get(r.customer_id)?.company_name || null,
    customer: customerMap.get(r.customer_id) || null,
  }));
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
    const contractId = pathParts[1];
    const subResource = pathParts[2]; // 'tiered-rates'

    // GET /contracts - List contracts
    if (req.method === 'GET' && !contractId) {
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('contracts')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data: contracts, error, count } = await query;

      if (error) {
        console.error('Error fetching contracts:', error);
        return createCorsResponse({ error: 'Failed to fetch contracts' }, 500, req);
      }

      // Enrich with customer names
      const enriched = await enrichWithCustomerNames(admin, contracts || []);
      return createCorsResponse(
        {
          data: enriched,
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /contracts/:id/tiered-rates - Get contract tiered rates
    if (req.method === 'GET' && contractId && subResource === 'tiered-rates') {
      const { data: rates, error } = await admin
        .from('contract_tiered_rates')
        .select('*')
        .eq('contract_id', contractId)
        .eq('tenant_id', tenantId)
        .order('minimum_volume', { ascending: true });

      if (error) {
        console.error('Error fetching tiered rates:', error);
        return createCorsResponse({ error: 'Failed to fetch tiered rates' }, 500, req);
      }

      return createCorsResponse(rates || [], 200, req);
    }

    // GET /contracts/:id - Get single contract
    if (req.method === 'GET' && contractId) {
      const { data: contractData, error } = await admin
        .from('contracts')
        .select('*')
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .single();

      // Enrich with customer info
      let contract = contractData;
      if (contractData?.customer_id) {
        const { data: customer } = await admin
          .from('business_records')
          .select('id, company_name, primary_contact_name, primary_contact_email, address_line1, city, state')
          .eq('id', contractData.customer_id)
          .single();
        contract = { ...contractData, customer: customer || null };
      }

      if (error) {
        console.error('Error fetching contract:', error);
        return createCorsResponse({ error: 'Contract not found' }, 404, req);
      }

      // Get tiered rates
      const { data: tieredRates } = await admin
        .from('contract_tiered_rates')
        .select('*')
        .eq('contract_id', contractId)
        .eq('tenant_id', tenantId)
        .order('minimum_volume', { ascending: true });

      return createCorsResponse({ ...contract, tieredRates: tieredRates || [] }, 200, req);
    }

    // POST /contracts - Create contract
    if (req.method === 'POST' && !contractId) {
      const body = await req.json();

      const contractNumber = body.contractNumber || body.contract_number || `CON-${Date.now()}`;

      const contractData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        contract_number: contractNumber,
        start_date: body.startDate || body.start_date,
        end_date: body.endDate || body.end_date,
        black_rate: body.blackRate || body.black_rate || null,
        color_rate: body.colorRate || body.color_rate || null,
        monthly_base: body.monthlyBase || body.monthly_base || null,
        status: body.status || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: contract, error } = await admin
        .from('contracts')
        .insert(contractData)
        .select()
        .single();

      if (error) {
        console.error('Error creating contract:', error);
        return createCorsResponse({ error: 'Failed to create contract', details: error }, 500, req);
      }

      // Insert tiered rates if provided
      const tieredRates = body.tieredRates || body.tiered_rates;
      if (tieredRates && Array.isArray(tieredRates) && tieredRates.length > 0) {
        const ratesData = tieredRates.map((rate: any) => ({
          tenant_id: tenantId,
          contract_id: contract.id,
          tier_name: rate.tierName || rate.tier_name,
          color_type: rate.colorType || rate.color_type,
          minimum_volume: rate.minimumVolume || rate.minimum_volume || 0,
          maximum_volume: rate.maximumVolume || rate.maximum_volume || null,
          rate: rate.rate,
          created_at: new Date().toISOString(),
        }));

        await admin.from('contract_tiered_rates').insert(ratesData);
      }

      // Fetch tiered rates separately
      const { data: rates } = await admin
        .from('contract_tiered_rates')
        .select('*')
        .eq('contract_id', contract.id)
        .eq('tenant_id', tenantId)
        .order('minimum_volume', { ascending: true });

      return createCorsResponse({ ...contract, tieredRates: rates || [] }, 201, req);
    }

    // PATCH /contracts/:id - Update contract
    if ((req.method === 'PATCH' || req.method === 'PUT') && contractId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.startDate || body.start_date)
        updateData.start_date = body.startDate || body.start_date;
      if (body.endDate || body.end_date) updateData.end_date = body.endDate || body.end_date;
      if (body.blackRate !== undefined || body.black_rate !== undefined)
        updateData.black_rate = body.blackRate || body.black_rate;
      if (body.colorRate !== undefined || body.color_rate !== undefined)
        updateData.color_rate = body.colorRate || body.color_rate;
      if (body.monthlyBase !== undefined || body.monthly_base !== undefined)
        updateData.monthly_base = body.monthlyBase || body.monthly_base;
      if (body.status) updateData.status = body.status;

      const { data: contract, error } = await admin
        .from('contracts')
        .update(updateData)
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating contract:', error);
        return createCorsResponse({ error: 'Failed to update contract' }, 500, req);
      }

      // Update tiered rates if provided
      const tieredRates = body.tieredRates || body.tiered_rates;
      if (tieredRates && Array.isArray(tieredRates)) {
        // Delete existing rates
        await admin
          .from('contract_tiered_rates')
          .delete()
          .eq('contract_id', contractId)
          .eq('tenant_id', tenantId);

        // Insert new rates
        if (tieredRates.length > 0) {
          const ratesData = tieredRates.map((rate: any) => ({
            tenant_id: tenantId,
            contract_id: contractId,
            tier_name: rate.tierName || rate.tier_name,
            color_type: rate.colorType || rate.color_type,
            minimum_volume: rate.minimumVolume || rate.minimum_volume || 0,
            maximum_volume: rate.maximumVolume || rate.maximum_volume || null,
            rate: rate.rate,
            created_at: new Date().toISOString(),
          }));

          await admin.from('contract_tiered_rates').insert(ratesData);
        }
      }

      // Fetch tiered rates separately
      const { data: updatedRates } = await admin
        .from('contract_tiered_rates')
        .select('*')
        .eq('contract_id', contractId)
        .eq('tenant_id', tenantId)
        .order('minimum_volume', { ascending: true });

      return createCorsResponse({ ...contract, tieredRates: updatedRates || [] }, 200, req);
    }

    // DELETE /contracts/:id - Delete contract
    if (req.method === 'DELETE' && contractId) {
      // Delete tiered rates first
      await admin
        .from('contract_tiered_rates')
        .delete()
        .eq('contract_id', contractId)
        .eq('tenant_id', tenantId);

      // Delete contract
      const { error } = await admin
        .from('contracts')
        .delete()
        .eq('id', contractId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting contract:', error);
        return createCorsResponse({ error: 'Failed to delete contract' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Contract deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in contracts function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
