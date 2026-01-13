// Contracts Edge Function
// Handles service contracts and tiered billing
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
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
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
        .select(
          `
          *,
          customer:business_records!contracts_customer_id_fkey(id, company_name, primary_contact_name)
        `,
          { count: 'exact' },
        )
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

      return createCorsResponse(
        {
          data: contracts || [],
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
      const { data: contract, error } = await admin
        .from('contracts')
        .select(
          `
          *,
          customer:business_records!contracts_customer_id_fkey(id, company_name, primary_contact_name, primary_contact_email, address_line1, city, state)
        `,
        )
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .single();

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

      // Fetch complete contract with rates
      const { data: completeContract } = await admin
        .from('contracts')
        .select(
          `
          *,
          tieredRates:contract_tiered_rates(*)
        `,
        )
        .eq('id', contract.id)
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(completeContract || contract, 201, req);
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

      // Fetch complete contract
      const { data: completeContract } = await admin
        .from('contracts')
        .select(
          `
          *,
          tieredRates:contract_tiered_rates(*)
        `,
        )
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(completeContract || contract, 200, req);
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
