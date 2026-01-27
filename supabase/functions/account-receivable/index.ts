// Account Receivable Edge Function
// Handles accounts receivable management and collections
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

    // GET /account-receivable/summary - Get AR summary
    if (req.method === 'GET' && endpoint === 'summary') {
      const { data: invoices } = await admin
        .from('invoices')
        .select('total_amount, amount_paid, due_date, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'sent');

      const now = new Date();
      let current = 0;
      let overdue30 = 0;
      let overdue60 = 0;
      let overdue90 = 0;
      let overdue90Plus = 0;

      (invoices || []).forEach((inv: any) => {
        const balance = (inv.total_amount || 0) - (inv.amount_paid || 0);
        const dueDate = new Date(inv.due_date);
        const daysPast = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysPast <= 0) {
          current += balance;
        } else if (daysPast <= 30) {
          overdue30 += balance;
        } else if (daysPast <= 60) {
          overdue60 += balance;
        } else if (daysPast <= 90) {
          overdue90 += balance;
        } else {
          overdue90Plus += balance;
        }
      });

      return createCorsResponse(
        {
          totalReceivables: current + overdue30 + overdue60 + overdue90 + overdue90Plus,
          current,
          overdue30,
          overdue60,
          overdue90,
          overdue90Plus,
          invoiceCount: invoices?.length || 0,
        },
        200,
        req,
      );
    }

    // GET /account-receivable/aging - Get aging report
    if (req.method === 'GET' && endpoint === 'aging') {
      const { data: invoices } = await admin
        .from('invoices')
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
        .in('status', ['sent', 'overdue'])
        .order('due_date', { ascending: true });

      const now = new Date();
      const agingReport = (invoices || []).map((inv: any) => {
        const balance = (inv.total_amount || 0) - (inv.amount_paid || 0);
        const dueDate = new Date(inv.due_date);
        const daysPast = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        let bucket;
        if (daysPast <= 0) bucket = 'current';
        else if (daysPast <= 30) bucket = '1-30';
        else if (daysPast <= 60) bucket = '31-60';
        else if (daysPast <= 90) bucket = '61-90';
        else bucket = '90+';

        return {
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          customerId: inv.customer_id,
          customerName: inv.customer?.company_name,
          invoiceDate: inv.invoice_date,
          dueDate: inv.due_date,
          totalAmount: inv.total_amount,
          amountPaid: inv.amount_paid,
          balance,
          daysPastDue: Math.max(0, daysPast),
          bucket,
        };
      });

      return createCorsResponse(agingReport, 200, req);
    }

    // GET /account-receivable/customers - Get customer AR balances
    if (req.method === 'GET' && endpoint === 'customers') {
      const { data: invoices } = await admin
        .from('invoices')
        .select(
          `
          customer_id,
          total_amount,
          amount_paid,
          customer:customer_id (
            id,
            company_name,
            email
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .in('status', ['sent', 'overdue']);

      // Aggregate by customer
      const customerBalances = new Map<
        string,
        { name: string; email: string; balance: number; invoiceCount: number }
      >();
      (invoices || []).forEach((inv: any) => {
        const balance = (inv.total_amount || 0) - (inv.amount_paid || 0);
        const current = customerBalances.get(inv.customer_id) || {
          name: inv.customer?.company_name || 'Unknown',
          email: inv.customer?.email || '',
          balance: 0,
          invoiceCount: 0,
        };
        customerBalances.set(inv.customer_id, {
          ...current,
          balance: current.balance + balance,
          invoiceCount: current.invoiceCount + 1,
        });
      });

      const result = Array.from(customerBalances.entries())
        .map(([customerId, data]) => ({ customerId, ...data }))
        .sort((a, b) => b.balance - a.balance);

      return createCorsResponse(result, 200, req);
    }

    // POST /account-receivable/payment - Record payment
    if (req.method === 'POST' && endpoint === 'payment') {
      const body = await req.json();

      const { data: payment, error } = await admin
        .from('payments')
        .insert({
          tenant_id: tenantId,
          invoice_id: body.invoiceId || body.invoice_id,
          customer_id: body.customerId || body.customer_id,
          amount: body.amount,
          payment_date: body.paymentDate || body.payment_date || new Date().toISOString(),
          payment_method: body.paymentMethod || body.payment_method,
          reference_number: body.referenceNumber || body.reference_number,
          notes: body.notes,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to record payment' }, 500, req);
      }

      // Update invoice amount_paid
      if (body.invoiceId || body.invoice_id) {
        const invoiceId = body.invoiceId || body.invoice_id;
        const { data: invoice } = await admin
          .from('invoices')
          .select('amount_paid, total_amount')
          .eq('id', invoiceId)
          .single();

        const newAmountPaid = (invoice?.amount_paid || 0) + body.amount;
        const newStatus = newAmountPaid >= (invoice?.total_amount || 0) ? 'paid' : 'sent';

        await admin
          .from('invoices')
          .update({
            amount_paid: newAmountPaid,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);
      }

      return createCorsResponse(payment, 201, req);
    }

    // POST /account-receivable/send-reminder - Send payment reminder
    if (req.method === 'POST' && endpoint === 'send-reminder') {
      const body = await req.json();

      // Log the reminder
      const { data: reminder, error } = await admin
        .from('ar_reminders')
        .insert({
          tenant_id: tenantId,
          invoice_id: body.invoiceId || body.invoice_id,
          customer_id: body.customerId || body.customer_id,
          reminder_type: body.reminderType || body.reminder_type || 'email',
          sent_at: new Date().toISOString(),
          sent_by: user.id,
          message: body.message,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to log reminder' }, 500, req);
      }

      // In production, this would send an actual email/notification
      return createCorsResponse(
        {
          success: true,
          reminderId: reminder?.id,
          message: 'Payment reminder sent',
        },
        200,
        req,
      );
    }

    // GET /account-receivable/collection-queue - Get collection queue
    if (req.method === 'GET' && endpoint === 'collection-queue') {
      const { data: invoices } = await admin
        .from('invoices')
        .select(
          `
          *,
          customer:customer_id (
            id,
            company_name,
            email,
            phone
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'overdue')
        .order('due_date', { ascending: true });

      return createCorsResponse(invoices || [], 200, req);
    }

    // POST /account-receivable/write-off - Write off bad debt
    if (req.method === 'POST' && endpoint === 'write-off') {
      const body = await req.json();

      const { data: writeOff, error } = await admin
        .from('ar_write_offs')
        .insert({
          tenant_id: tenantId,
          invoice_id: body.invoiceId || body.invoice_id,
          customer_id: body.customerId || body.customer_id,
          amount: body.amount,
          reason: body.reason,
          approved_by: body.approvedBy || body.approved_by,
          write_off_date: new Date().toISOString(),
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create write-off' }, 500, req);
      }

      // Update invoice status
      await admin
        .from('invoices')
        .update({
          status: 'written_off',
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.invoiceId || body.invoice_id);

      return createCorsResponse(writeOff, 201, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in account-receivable function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
