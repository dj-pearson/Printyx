// Service Contracts Edge Function
// Handles service contract management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
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
    const { parts } = normalizePath(url.pathname, 'service-contracts');
    const contractId = parts[0];
    const subResource = parts[1];

    // GET /service-contracts - List contracts
    if (req.method === 'GET' && !contractId) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');
      const expiringWithin = url.searchParams.get('expiringWithin'); // days

      let query = admin
        .from('service_contracts')
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
        .order('end_date', { ascending: true });

      // contract_status, not status.
      if (status) query = query.eq('contract_status', status);
      if (customerId) query = query.eq('customer_id', customerId);
      if (expiringWithin) {
        const expiryDate = new Date(Date.now() + parseInt(expiringWithin) * 24 * 60 * 60 * 1000);
        query = query.lte('end_date', expiryDate.toISOString());
      }

      const { data: contracts, error } = await query;

      if (error) {
        console.error('Error fetching service contracts:', error);
        return createCorsResponse({ error: 'Failed to fetch contracts' }, 500, req);
      }

      return createCorsResponse(contracts || [], 200, req);
    }

    // GET /service-contracts/expiring - Get expiring contracts
    if (req.method === 'GET' && contractId === 'expiring') {
      const days = parseInt(url.searchParams.get('days') || '30');
      const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const { data: contracts } = await admin
        .from('service_contracts')
        .select(
          `
          *,
          customer:customer_id (
            id,
            company_name,
            email
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('contract_status', 'active')
        .lte('end_date', expiryDate.toISOString())
        .gte('end_date', new Date().toISOString())
        .order('end_date', { ascending: true });

      return createCorsResponse(contracts || [], 200, req);
    }

    // GET /service-contracts/:id - Get single contract
    if (req.method === 'GET' && contractId && !subResource) {
      const { data: contract, error } = await admin
        .from('service_contracts')
        .select('*')
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Contract not found' }, 404, req);
      }

      // Get covered equipment
      const { data: equipment } = await admin
        .from('contract_equipment')
        .select(
          `
          *,
          equipment:equipment_id (*)
        `,
        )
        .eq('contract_id', contractId);

      // Get service history
      const { data: services } = await admin
        .from('work_orders')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false })
        .limit(20);

      return createCorsResponse(
        {
          ...contract,
          coveredEquipment: equipment || [],
          serviceHistory: services || [],
        },
        200,
        req,
      );
    }

    // POST /service-contracts - Create contract
    if (req.method === 'POST' && !contractId) {
      const body = await req.json();

      // COP-M01: status, base_fee, sla_level, auto_renew, terms_and_conditions
      // and created_by are none of them columns. service_contracts uses
      // contract_status, monthly_base_rate, auto_renewal and contract_notes, and
      // expresses the SLA as response_time_hours rather than a level name. There
      // is no created_by. (terms_and_conditions and created_by sit in a
      // named-variable payload, so check:phantom-cols did not flag them —
      // reading did.)
      const contractData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        contract_number: body.contractNumber || body.contract_number || `SC-${Date.now()}`,
        contract_type: body.contractType || body.contract_type || 'full_service',
        contract_status: body.status || 'draft',
        start_date: body.startDate || body.start_date,
        end_date: body.endDate || body.end_date,
        billing_frequency: body.billingFrequency || body.billing_frequency || 'monthly',
        monthly_base_rate: body.baseFee ?? body.base_fee ?? 0,
        response_time_hours: body.responseTimeHours || body.response_time_hours || 24,
        auto_renewal: body.autoRenew ?? body.auto_renew ?? false,
        contract_notes: body.termsAndConditions || body.terms_and_conditions || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: contract, error } = await admin
        .from('service_contracts')
        .insert(contractData)
        .select()
        .single();

      if (error) {
        console.error('Error creating service contract:', error);
        return createCorsResponse({ error: 'Failed to create contract' }, 500, req);
      }

      return createCorsResponse(contract, 201, req);
    }

    // PUT /service-contracts/:id - Update contract
    if (req.method === 'PUT' && contractId && !subResource) {
      const body = await req.json();

      const { data: contract, error } = await admin
        .from('service_contracts')
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

    // POST /service-contracts/:id/equipment - Add equipment to contract
    if (req.method === 'POST' && contractId && subResource === 'equipment') {
      const body = await req.json();
      const equipmentIds = body.equipmentIds ||
        body.equipment_ids || [body.equipmentId || body.equipment_id];

      const records = equipmentIds.map((eqId: string) => ({
        contract_id: contractId,
        equipment_id: eqId,
        coverage_type: body.coverageType || body.coverage_type || 'full',
        added_at: new Date().toISOString(),
      }));

      const { error } = await admin
        .from('contract_equipment')
        .upsert(records, { onConflict: 'contract_id,equipment_id' });

      if (error) {
        return createCorsResponse({ error: 'Failed to add equipment' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          addedCount: equipmentIds.length,
        },
        200,
        req,
      );
    }

    // DELETE /service-contracts/:id/equipment/:equipmentId - Remove equipment
    if (req.method === 'DELETE' && contractId && subResource === 'equipment') {
      const equipmentId = parts[2];

      const { error } = await admin
        .from('contract_equipment')
        .delete()
        .eq('contract_id', contractId)
        .eq('equipment_id', equipmentId);

      if (error) {
        return createCorsResponse({ error: 'Failed to remove equipment' }, 500, req);
      }

      return createCorsResponse({ success: true }, 200, req);
    }

    // POST /service-contracts/:id/renew - Renew contract
    if (req.method === 'POST' && contractId && subResource === 'renew') {
      const body = await req.json();

      const { data: original } = await admin
        .from('service_contracts')
        .select('*')
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .single();

      if (!original) {
        return createCorsResponse({ error: 'Contract not found' }, 404, req);
      }

      const newEndDate =
        body.endDate ||
        body.end_date ||
        new Date(new Date(original.end_date).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const { data: renewed, error } = await admin
        .from('service_contracts')
        .insert({
          tenant_id: tenantId,
          customer_id: original.customer_id,
          contract_number: `${original.contract_number}-R`,
          contract_type: original.contract_type,
          contract_status: 'active',
          start_date: original.end_date,
          end_date: newEndDate,
          billing_frequency: original.billing_frequency,
          monthly_base_rate: body.baseFee ?? body.base_fee ?? original.monthly_base_rate,
          bw_overage_rate: original.bw_overage_rate,
          color_overage_rate: original.color_overage_rate,
          response_time_hours: original.response_time_hours,
          auto_renewal: original.auto_renewal,
          contract_notes: original.contract_notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to renew contract' }, 500, req);
      }

      // Update original contract status. There is no column linking a contract
      // to its renewal, so the two are related only by the -R contract_number.
      await admin
        .from('service_contracts')
        .update({ contract_status: 'renewed', updated_at: new Date().toISOString() })
        .eq('id', contractId)
        .eq('tenant_id', tenantId);

      // Copy equipment coverage
      const { data: equipment } = await admin
        .from('contract_equipment')
        .select('equipment_id, coverage_type')
        .eq('contract_id', contractId);

      if (equipment && equipment.length > 0) {
        const newEquipment = equipment.map((eq: any) => ({
          contract_id: renewed.id,
          equipment_id: eq.equipment_id,
          coverage_type: eq.coverage_type,
          added_at: new Date().toISOString(),
        }));
        await admin.from('contract_equipment').insert(newEquipment);
      }

      return createCorsResponse(
        {
          ...renewed,
          unpersisted: [
            'previousContractId: service_contracts has no column linking a renewal to its predecessor',
          ],
        },
        201,
        req,
      );
    }

    // POST /service-contracts/:id/cancel - Cancel contract
    if (req.method === 'POST' && contractId && subResource === 'cancel') {
      const body = await req.json();

      const { data: contract, error } = await admin
        .from('service_contracts')
        // Only contract_status exists; there is no cancellation_reason,
        // cancelled_at or cancelled_by, so those are reported back rather than
        // dropped.
        .update({
          contract_status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contractId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error cancelling service contract:', error);
        return createCorsResponse(
          { error: 'Failed to cancel contract', details: error.message },
          500,
          req,
        );
      }

      const unpersisted = ['cancelledBy: service_contracts has no cancelled_by column'];
      if (body.reason) {
        unpersisted.push('reason: service_contracts has no cancellation_reason column');
      }

      return createCorsResponse({ ...contract, unpersisted }, 200, req);
    }

    // DELETE /service-contracts/:id - Delete contract
    if (req.method === 'DELETE' && contractId) {
      // Delete equipment associations first
      await admin.from('contract_equipment').delete().eq('contract_id', contractId);

      const { error } = await admin
        .from('service_contracts')
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
    console.error('Unexpected error in service-contracts function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
