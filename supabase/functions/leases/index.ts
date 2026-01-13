// Leases Edge Function
// Handles equipment leasing, payments, renewals, and dispositions
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
    const leaseId = pathParts[1];
    const subResource = pathParts[2]; // 'payments', 'renewals', 'dispositions'

    // GET /leases - List leases
    if (req.method === 'GET' && !leaseId) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const equipmentId =
        url.searchParams.get('equipmentId') || url.searchParams.get('equipment_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('leases')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('lease_start_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('lease_status', status);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (equipmentId) {
        query = query.eq('equipment_id', equipmentId);
      }

      const { data: leases, error, count } = await query;

      if (error) {
        console.error('Error fetching leases:', error);
        return createCorsResponse({ error: 'Failed to fetch leases' }, 500, req);
      }

      return createCorsResponse(
        {
          data: leases || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /leases/:id - Get single lease
    if (req.method === 'GET' && leaseId && !subResource) {
      const { data: lease, error } = await admin
        .from('leases')
        .select('*')
        .eq('id', leaseId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching lease:', error);
        return createCorsResponse({ error: 'Lease not found' }, 404, req);
      }

      return createCorsResponse(lease, 200, req);
    }

    // GET /leases/:id/payments - Get lease payments
    if (req.method === 'GET' && leaseId && subResource === 'payments') {
      const { data: payments, error } = await admin
        .from('lease_payments')
        .select('*')
        .eq('lease_id', leaseId)
        .eq('tenant_id', tenantId)
        .order('payment_due_date', { ascending: true });

      if (error) {
        console.error('Error fetching lease payments:', error);
        return createCorsResponse({ error: 'Failed to fetch payments' }, 500, req);
      }

      return createCorsResponse(payments || [], 200, req);
    }

    // GET /leases/:id/renewals - Get lease renewals
    if (req.method === 'GET' && leaseId && subResource === 'renewals') {
      const { data: renewals, error } = await admin
        .from('lease_renewals')
        .select('*')
        .eq('lease_id', leaseId)
        .eq('tenant_id', tenantId)
        .order('renewal_date', { ascending: false });

      if (error) {
        console.error('Error fetching lease renewals:', error);
        return createCorsResponse({ error: 'Failed to fetch renewals' }, 500, req);
      }

      return createCorsResponse(renewals || [], 200, req);
    }

    // GET /leases/:id/dispositions - Get lease dispositions
    if (req.method === 'GET' && leaseId && subResource === 'dispositions') {
      const { data: dispositions, error } = await admin
        .from('lease_dispositions')
        .select('*')
        .eq('lease_id', leaseId)
        .eq('tenant_id', tenantId)
        .order('disposition_date', { ascending: false });

      if (error) {
        console.error('Error fetching lease dispositions:', error);
        return createCorsResponse({ error: 'Failed to fetch dispositions' }, 500, req);
      }

      return createCorsResponse(dispositions || [], 200, req);
    }

    // POST /leases - Create lease
    if (req.method === 'POST' && !leaseId) {
      const body = await req.json();

      // Generate lease number if not provided
      const leaseNumber =
        body.leaseNumber ||
        body.lease_number ||
        `LSE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const leaseData = {
        tenant_id: tenantId,
        lease_number: leaseNumber,
        customer_id: body.customerId || body.customer_id,
        equipment_id: body.equipmentId || body.equipment_id || null,
        lease_type: body.leaseType || body.lease_type || 'operating',
        lease_status: body.leaseStatus || body.lease_status || 'active',
        lease_start_date: body.leaseStartDate || body.lease_start_date,
        lease_end_date: body.leaseEndDate || body.lease_end_date,
        monthly_rate: body.monthlyRate || body.monthly_rate || 0,
        lease_term_months: body.leaseTermMonths || body.lease_term_months || 36,
        payment_frequency: body.paymentFrequency || body.payment_frequency || 'monthly',
        auto_renewal:
          body.autoRenewal !== undefined
            ? body.autoRenewal
            : body.auto_renewal !== undefined
              ? body.auto_renewal
              : false,
        renewal_notice_days: body.renewalNoticeDays || body.renewal_notice_days || 90,
        security_deposit: body.securityDeposit || body.security_deposit || 0,
        total_lease_value: body.totalLeaseValue || body.total_lease_value || 0,
        billing_day: body.billingDay || body.billing_day || 1,
        notes: body.notes || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: lease, error } = await admin.from('leases').insert(leaseData).select().single();

      if (error) {
        console.error('Error creating lease:', error);
        return createCorsResponse({ error: 'Failed to create lease', details: error }, 500, req);
      }

      return createCorsResponse(lease, 201, req);
    }

    // POST /leases/:id/payments - Add lease payment
    if (req.method === 'POST' && leaseId && subResource === 'payments') {
      const body = await req.json();

      const paymentData = {
        tenant_id: tenantId,
        lease_id: leaseId,
        payment_number: body.paymentNumber || body.payment_number || 1,
        payment_due_date: body.paymentDueDate || body.payment_due_date,
        payment_amount: body.paymentAmount || body.payment_amount || 0,
        payment_status: body.paymentStatus || body.payment_status || 'pending',
        payment_date: body.paymentDate || body.payment_date || null,
        payment_method: body.paymentMethod || body.payment_method || null,
        invoice_id: body.invoiceId || body.invoice_id || null,
        late_fee: body.lateFee || body.late_fee || 0,
        notes: body.notes || null,
      };

      const { data: payment, error } = await admin
        .from('lease_payments')
        .insert(paymentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating lease payment:', error);
        return createCorsResponse({ error: 'Failed to create payment' }, 500, req);
      }

      return createCorsResponse(payment, 201, req);
    }

    // POST /leases/:id/renewals - Add lease renewal
    if (req.method === 'POST' && leaseId && subResource === 'renewals') {
      const body = await req.json();

      const renewalData = {
        tenant_id: tenantId,
        lease_id: leaseId,
        renewal_date: body.renewalDate || body.renewal_date || new Date().toISOString(),
        new_term_months: body.newTermMonths || body.new_term_months || 36,
        new_monthly_rate: body.newMonthlyRate || body.new_monthly_rate || 0,
        new_end_date: body.newEndDate || body.new_end_date,
        approval_status: body.approvalStatus || body.approval_status || 'pending',
        notes: body.notes || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      const { data: renewal, error } = await admin
        .from('lease_renewals')
        .insert(renewalData)
        .select()
        .single();

      if (error) {
        console.error('Error creating lease renewal:', error);
        return createCorsResponse({ error: 'Failed to create renewal' }, 500, req);
      }

      return createCorsResponse(renewal, 201, req);
    }

    // POST /leases/:id/dispositions - Add lease disposition
    if (req.method === 'POST' && leaseId && subResource === 'dispositions') {
      const body = await req.json();

      const dispositionData = {
        tenant_id: tenantId,
        lease_id: leaseId,
        disposition_date: body.dispositionDate || body.disposition_date || new Date().toISOString(),
        disposition_type: body.dispositionType || body.disposition_type,
        buyout_amount: body.buyoutAmount || body.buyout_amount || 0,
        return_condition: body.returnCondition || body.return_condition || null,
        disposal_fee: body.disposalFee || body.disposal_fee || 0,
        notes: body.notes || null,
        processed_by: user.id,
        processed_at: new Date().toISOString(),
      };

      const { data: disposition, error } = await admin
        .from('lease_dispositions')
        .insert(dispositionData)
        .select()
        .single();

      if (error) {
        console.error('Error creating lease disposition:', error);
        return createCorsResponse({ error: 'Failed to create disposition' }, 500, req);
      }

      return createCorsResponse(disposition, 201, req);
    }

    // PATCH /leases/:id - Update lease
    if ((req.method === 'PATCH' || req.method === 'PUT') && leaseId && !subResource) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        leaseStatus: 'lease_status',
        leaseEndDate: 'lease_end_date',
        monthlyRate: 'monthly_rate',
        autoRenewal: 'auto_renewal',
        renewalNoticeDays: 'renewal_notice_days',
        notes: 'notes',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: lease, error } = await admin
        .from('leases')
        .update(updateData)
        .eq('id', leaseId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating lease:', error);
        return createCorsResponse({ error: 'Failed to update lease' }, 500, req);
      }

      return createCorsResponse(lease, 200, req);
    }

    // DELETE /leases/:id - Delete lease
    if (req.method === 'DELETE' && leaseId && !subResource) {
      const { error } = await admin
        .from('leases')
        .delete()
        .eq('id', leaseId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting lease:', error);
        return createCorsResponse({ error: 'Failed to delete lease' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Lease deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Invalid lease endpoint' }, 400, req);
  } catch (error) {
    console.error('Error in leases function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
