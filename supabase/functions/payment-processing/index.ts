// Payment Processing Edge Function
// Handles payment processing operations
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
    const paymentId = pathParts[2];

    // GET /payment-processing/methods - Get available payment methods
    if (req.method === 'GET' && endpoint === 'methods') {
      const { data: methods } = await admin
        .from('payment_methods')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      return createCorsResponse(
        methods || [
          { id: 'credit_card', name: 'Credit Card', type: 'card' },
          { id: 'ach', name: 'Bank Transfer (ACH)', type: 'bank' },
          { id: 'check', name: 'Check', type: 'manual' },
          { id: 'cash', name: 'Cash', type: 'manual' },
        ],
        200,
        req,
      );
    }

    // GET /payment-processing/history - Get payment history
    if (req.method === 'GET' && endpoint === 'history') {
      const customerId = url.searchParams.get('customerId');
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('payments')
        .select(
          `
          *,
          customer:customer_id (
            id,
            company_name
          )
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (customerId) query = query.eq('customer_id', customerId);
      if (status) query = query.eq('status', status);

      const { data: payments, count, error } = await query;

      if (error) {
        console.error('Error fetching payment history:', error);
        return createCorsResponse({ error: 'Failed to fetch payments' }, 500, req);
      }

      return createCorsResponse(
        {
          payments: payments || [],
          pagination: { page, limit, total: count || 0 },
        },
        200,
        req,
      );
    }

    // GET /payment-processing/transactions/:id - Get single transaction
    if (req.method === 'GET' && endpoint === 'transactions' && paymentId) {
      const { data: payment, error } = await admin
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Payment not found' }, 404, req);
      }

      return createCorsResponse(payment, 200, req);
    }

    // POST /payment-processing/charge - Process a payment
    if (req.method === 'POST' && endpoint === 'charge') {
      const body = await req.json();

      // In production, this would integrate with Stripe or other payment processor
      const paymentData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        invoice_id: body.invoiceId || body.invoice_id,
        amount: body.amount,
        currency: body.currency || 'USD',
        payment_method: body.paymentMethod || body.payment_method,
        status: 'pending',
        reference_number: `PAY-${Date.now()}`,
        description: body.description,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: payment, error } = await admin
        .from('payments')
        .insert(paymentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating payment:', error);
        return createCorsResponse({ error: 'Failed to process payment' }, 500, req);
      }

      // Simulate successful payment (in production, this would be async after payment processor callback)
      const { data: completedPayment } = await admin
        .from('payments')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
        .select()
        .single();

      // Update invoice if specified
      if (body.invoiceId || body.invoice_id) {
        const invoiceId = body.invoiceId || body.invoice_id;
        const { data: invoice } = await admin
          .from('invoices')
          .select('amount_paid, total_amount')
          .eq('id', invoiceId)
          .single();

        const newAmountPaid = (invoice?.amount_paid || 0) + body.amount;
        const newStatus = newAmountPaid >= (invoice?.total_amount || 0) ? 'paid' : 'partial';

        await admin
          .from('invoices')
          .update({
            amount_paid: newAmountPaid,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);
      }

      return createCorsResponse(
        {
          success: true,
          payment: completedPayment,
          message: 'Payment processed successfully',
        },
        200,
        req,
      );
    }

    // POST /payment-processing/refund - Process a refund
    if (req.method === 'POST' && endpoint === 'refund') {
      const body = await req.json();

      const { data: originalPayment } = await admin
        .from('payments')
        .select('*')
        .eq('id', body.paymentId || body.payment_id)
        .eq('tenant_id', tenantId)
        .single();

      if (!originalPayment) {
        return createCorsResponse({ error: 'Original payment not found' }, 404, req);
      }

      const refundAmount = body.amount || originalPayment.amount;

      const { data: refund, error } = await admin
        .from('payments')
        .insert({
          tenant_id: tenantId,
          customer_id: originalPayment.customer_id,
          invoice_id: originalPayment.invoice_id,
          amount: -refundAmount,
          currency: originalPayment.currency,
          payment_method: originalPayment.payment_method,
          status: 'completed',
          reference_number: `REF-${Date.now()}`,
          original_payment_id: originalPayment.id,
          description: body.reason || 'Refund',
          created_by: user.id,
          created_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to process refund' }, 500, req);
      }

      // Update original payment status
      await admin
        .from('payments')
        .update({
          status: refundAmount >= originalPayment.amount ? 'refunded' : 'partial_refund',
          updated_at: new Date().toISOString(),
        })
        .eq('id', originalPayment.id);

      return createCorsResponse(
        {
          success: true,
          refund,
          message: 'Refund processed successfully',
        },
        200,
        req,
      );
    }

    // POST /payment-processing/void - Void a pending payment
    if (req.method === 'POST' && endpoint === 'void') {
      const body = await req.json();

      const { data: payment, error } = await admin
        .from('payments')
        .update({
          status: 'voided',
          voided_at: new Date().toISOString(),
          voided_by: user.id,
          void_reason: body.reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.paymentId || body.payment_id)
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .select()
        .single();

      if (error || !payment) {
        return createCorsResponse(
          { error: 'Failed to void payment or payment already processed' },
          400,
          req,
        );
      }

      return createCorsResponse(
        {
          success: true,
          payment,
          message: 'Payment voided',
        },
        200,
        req,
      );
    }

    // GET /payment-processing/summary - Get payment summary
    if (req.method === 'GET' && endpoint === 'summary') {
      const period = url.searchParams.get('period') || 'month';
      let startDate: Date;
      const now = new Date();

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'quarter':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const { data: payments } = await admin
        .from('payments')
        .select('amount, status, payment_method')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString());

      const completed = (payments || []).filter(
        (p: any) => p.status === 'completed' && p.amount > 0,
      );
      const refunds = (payments || []).filter((p: any) => p.amount < 0);

      const totalCollected = completed.reduce((sum: number, p: any) => sum + p.amount, 0);
      const totalRefunded = Math.abs(refunds.reduce((sum: number, p: any) => sum + p.amount, 0));

      // Group by payment method
      const byMethod = new Map<string, number>();
      completed.forEach((p: any) => {
        byMethod.set(p.payment_method, (byMethod.get(p.payment_method) || 0) + p.amount);
      });

      return createCorsResponse(
        {
          period,
          totalCollected,
          totalRefunded,
          netCollected: totalCollected - totalRefunded,
          transactionCount: completed.length,
          refundCount: refunds.length,
          byMethod: Array.from(byMethod.entries()).map(([method, amount]) => ({ method, amount })),
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in payment-processing function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
