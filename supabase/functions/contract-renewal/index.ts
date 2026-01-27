// Contract Renewal Edge Function
// Handles contract renewal management and tracking
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
    const contractId = pathParts[2];

    // GET /contract-renewal/upcoming - Get upcoming renewals
    if (req.method === 'GET' && endpoint === 'upcoming') {
      const days = parseInt(url.searchParams.get('days') || '90');
      const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const { data: contracts, error } = await admin
        .from('contracts')
        .select(
          `
          *,
          customer:customer_id (
            id,
            company_name,
            primary_contact_name,
            primary_contact_email
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .lte('end_date', futureDate)
        .order('end_date', { ascending: true });

      if (error) {
        console.error('Error fetching upcoming renewals:', error);
        return createCorsResponse({ error: 'Failed to fetch renewals' }, 500, req);
      }

      return createCorsResponse(contracts || [], 200, req);
    }

    // GET /contract-renewal/expiring - Get expiring contracts
    if (req.method === 'GET' && endpoint === 'expiring') {
      const today = new Date().toISOString();
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: contracts } = await admin
        .from('contracts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .gte('end_date', today)
        .lte('end_date', thirtyDays)
        .order('end_date', { ascending: true });

      return createCorsResponse(
        {
          contracts: contracts || [],
          count: contracts?.length || 0,
          urgency: 'high',
        },
        200,
        req,
      );
    }

    // GET /contract-renewal/stats - Get renewal statistics
    if (req.method === 'GET' && endpoint === 'stats') {
      const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString());
      const yearStart = new Date(year, 0, 1).toISOString();
      const yearEnd = new Date(year, 11, 31, 23, 59, 59).toISOString();

      const { data: renewals } = await admin
        .from('contracts')
        .select('id, monthly_value, renewal_status')
        .eq('tenant_id', tenantId)
        .gte('end_date', yearStart)
        .lte('end_date', yearEnd);

      const renewed = renewals?.filter((c: any) => c.renewal_status === 'renewed') || [];
      const churned = renewals?.filter((c: any) => c.renewal_status === 'churned') || [];

      const renewedValue = renewed.reduce(
        (sum: number, c: any) => sum + (c.monthly_value || 0) * 12,
        0,
      );
      const churnedValue = churned.reduce(
        (sum: number, c: any) => sum + (c.monthly_value || 0) * 12,
        0,
      );

      return createCorsResponse(
        {
          year,
          totalUpForRenewal: renewals?.length || 0,
          renewed: renewed.length,
          churned: churned.length,
          pending: (renewals?.length || 0) - renewed.length - churned.length,
          renewalRate: renewals?.length ? (renewed.length / renewals.length) * 100 : 0,
          renewedValue,
          churnedValue,
        },
        200,
        req,
      );
    }

    // POST /contract-renewal/:contractId/renew - Process renewal
    if (
      (req.method === 'POST' && endpoint === 'renew') ||
      (contractId && pathParts[3] === 'renew')
    ) {
      const targetContractId =
        endpoint === 'renew' ? url.searchParams.get('contractId') : contractId;
      const body = await req.json();

      // Get current contract
      const { data: currentContract } = await admin
        .from('contracts')
        .select('*')
        .eq('id', targetContractId)
        .eq('tenant_id', tenantId)
        .single();

      if (!currentContract) {
        return createCorsResponse({ error: 'Contract not found' }, 404, req);
      }

      // Calculate new dates
      const newStartDate = new Date(currentContract.end_date);
      newStartDate.setDate(newStartDate.getDate() + 1);
      const termMonths = body.termMonths || 12;
      const newEndDate = new Date(newStartDate);
      newEndDate.setMonth(newEndDate.getMonth() + termMonths);

      // Create new contract
      const { data: newContract, error } = await admin
        .from('contracts')
        .insert({
          tenant_id: tenantId,
          customer_id: currentContract.customer_id,
          contract_number: `${currentContract.contract_number}-R`,
          contract_type: currentContract.contract_type,
          start_date: newStartDate.toISOString(),
          end_date: newEndDate.toISOString(),
          monthly_value: body.monthlyValue || currentContract.monthly_value,
          status: 'active',
          previous_contract_id: currentContract.id,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create renewal' }, 500, req);
      }

      // Update old contract
      await admin
        .from('contracts')
        .update({
          renewal_status: 'renewed',
          renewed_contract_id: newContract.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetContractId);

      return createCorsResponse({ previousContract: currentContract, newContract }, 201, req);
    }

    // POST /contract-renewal/:contractId/mark-churned - Mark as churned
    if (req.method === 'POST' && contractId && pathParts[3] === 'mark-churned') {
      const body = await req.json();

      const { data: contract, error } = await admin
        .from('contracts')
        .update({
          renewal_status: 'churned',
          churn_reason: body.reason,
          churn_notes: body.notes,
          churned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to mark as churned' }, 500, req);
      }

      return createCorsResponse(contract, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in contract-renewal function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
