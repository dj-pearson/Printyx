// Payment Processing Edge Function
// Handles payment processing operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /payment-processing, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'payment-processing');
    const endpoint = parts[0];
    const paymentId = parts[1];

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
    //
    // 501, deliberately. What used to be here inserted a payments row, set it
    // to 'completed' one statement later, and answered "Payment processed
    // successfully" - with no processor anywhere in the call. A fabricated
    // settlement in the ledger is worse than no endpoint: it is indistinguishable
    // from a real one downstream, and /summary and /history read the same table.
    //
    // It also wrote to invoices using an invoice id taken straight from the
    // request body, with no tenant filter on either the read or the update, via
    // the service-role client. Any authenticated user could set another tenant's
    // invoice to paid, with amount_paid raised by a number they chose. Two
    // further faults in the same six lines: it wrote `status`, the LEGACY column,
    // while every read path uses `invoice_status`, so a payment that "succeeded"
    // left the invoice showing open; and balance_due was never recomputed.
    //
    // Real card capture lives in StripeService (/api/subscriptions, and the
    // webhook receiver at /api/webhooks/stripe). Settling an invoice from a
    // captured payment belongs there, not in a simulator.
    if (req.method === 'POST' && endpoint === 'charge') {
      return createCorsResponse(
        {
          error: 'Payment capture is not implemented in this function',
          detail:
            'Card capture runs through StripeService; this endpoint never contacted a processor.',
        },
        501,
        req,
      );
    }

    // POST /payment-processing/refund - Process a refund
    //
    // 501 for the same reason as /charge: it inserted a negative payment already
    // marked 'completed' and reported "Refund processed successfully" without
    // contacting a processor. Its tenant scoping was correct - the defect is that
    // the money never moved.
    if (req.method === 'POST' && endpoint === 'refund') {
      return createCorsResponse(
        {
          error: 'Refunds are not implemented in this function',
          detail: 'No payment processor is called here; a refund recorded now would be fiction.',
        },
        501,
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
