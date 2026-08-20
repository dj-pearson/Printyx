// Contract Renewal Edge Function
// Handles contract renewal management and tracking
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { toNumber } from '../_shared/quote-math.ts';
import { normalizePath } from '../_shared/path.ts';

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
    const { parts } = normalizePath(url.pathname, 'contract-renewal');
    const endpoint = parts[0];
    const contractId = parts[1];

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

      // COP-M01: monthly_value and renewal_status are not columns. The
      // contracts table is minimal — monthly_base carries the recurring amount
      // and `status` carries the lifecycle — so this select 42703'd and every
      // figure below came out zero through `|| 0`.
      const { data: renewals } = await admin
        .from('contracts')
        .select('id, monthly_base, status')
        .eq('tenant_id', tenantId)
        .gte('end_date', yearStart)
        .lte('end_date', yearEnd);

      const renewed = renewals?.filter((c: any) => c.status === 'renewed') || [];
      const churned = renewals?.filter((c: any) => c.status === 'churned') || [];

      // monthly_base is numeric, which PostgREST returns as a string.
      const annualized = (rows: any[]) =>
        rows.reduce((sum: number, c: any) => sum + toNumber(c.monthly_base) * 12, 0);
      const renewedValue = annualized(renewed);
      const churnedValue = annualized(churned);

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
    if ((req.method === 'POST' && endpoint === 'renew') || (contractId && parts[2] === 'renew')) {
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
        // COP-M01: contract_type, previous_contract_id and created_by are not
        // columns on `contracts`, and the recurring amount is monthly_base.
        // Copying the rate columns keeps the renewal on the same pricing, which
        // is what a renewal means here.
        .insert({
          tenant_id: tenantId,
          customer_id: currentContract.customer_id,
          contract_number: `${currentContract.contract_number}-R`,
          start_date: newStartDate.toISOString(),
          end_date: newEndDate.toISOString(),
          monthly_base: body.monthlyValue ?? currentContract.monthly_base,
          black_rate: currentContract.black_rate,
          color_rate: currentContract.color_rate,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating renewal contract:', error);
        return createCorsResponse(
          { error: 'Failed to create renewal', details: error.message },
          500,
          req,
        );
      }

      // Update old contract. `status` is the only lifecycle column there is;
      // renewed_contract_id has no home, so the link between the two contracts
      // is NOT persisted and the caller is told so rather than left to assume.
      const { error: closeError } = await admin
        .from('contracts')
        .update({ status: 'renewed', updated_at: new Date().toISOString() })
        .eq('id', targetContractId)
        .eq('tenant_id', tenantId);

      if (closeError) {
        console.error('Error closing the renewed contract:', closeError);
      }

      return createCorsResponse(
        {
          previousContract: currentContract,
          newContract,
          unpersisted: [
            'renewedContractId: contracts has no column linking a renewal to its predecessor',
          ],
        },
        201,
        req,
      );
    }

    // POST /contract-renewal/:contractId/mark-churned - Mark as churned
    if (req.method === 'POST' && contractId && parts[2] === 'mark-churned') {
      const body = await req.json();

      const { data: contract, error } = await admin
        .from('contracts')
        // Only `status` exists; churn_reason, churn_notes and churned_at have no
        // columns, so they are reported back rather than silently dropped.
        .update({
          status: 'churned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error marking contract churned:', error);
        return createCorsResponse(
          { error: 'Failed to mark as churned', details: error.message },
          500,
          req,
        );
      }

      const unpersisted: string[] = [];
      if (body.reason) unpersisted.push('reason: contracts has no churn_reason column');
      if (body.notes) unpersisted.push('notes: contracts has no churn_notes column');

      return createCorsResponse({ ...contract, unpersisted }, 200, req);
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
