// Account Payable Edge Function
// Handles accounts payable management
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
    const billId = pathParts[2];

    // GET /account-payable/bills - List bills
    if (req.method === 'GET' && endpoint === 'bills' && !billId) {
      const status = url.searchParams.get('status');
      const vendorId = url.searchParams.get('vendorId');

      let query = admin
        .from('bills')
        .select(
          `
          *,
          vendor:vendor_id (
            id,
            company_name
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true });

      if (status) query = query.eq('status', status);
      if (vendorId) query = query.eq('vendor_id', vendorId);

      const { data: bills, error } = await query;

      if (error) {
        console.error('Error fetching bills:', error);
        return createCorsResponse({ error: 'Failed to fetch bills' }, 500, req);
      }

      return createCorsResponse(bills || [], 200, req);
    }

    // GET /account-payable/bills/:id - Get single bill
    if (req.method === 'GET' && endpoint === 'bills' && billId) {
      const { data: bill, error } = await admin
        .from('bills')
        .select('*')
        .eq('id', billId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Bill not found' }, 404, req);
      }

      // Get line items
      const { data: lineItems } = await admin
        .from('bill_line_items')
        .select('*')
        .eq('bill_id', billId);

      // Get payment history
      const { data: payments } = await admin
        .from('bill_payments')
        .select('*')
        .eq('bill_id', billId)
        .order('payment_date', { ascending: false });

      return createCorsResponse(
        {
          ...bill,
          lineItems: lineItems || [],
          payments: payments || [],
        },
        200,
        req,
      );
    }

    // POST /account-payable/bills - Create bill
    if (req.method === 'POST' && endpoint === 'bills') {
      const body = await req.json();
      const { lineItems, ...billData } = body;

      const { data: bill, error } = await admin
        .from('bills')
        .insert({
          tenant_id: tenantId,
          vendor_id: billData.vendorId || billData.vendor_id,
          bill_number: billData.billNumber || billData.bill_number,
          bill_date: billData.billDate || billData.bill_date || new Date().toISOString(),
          due_date: billData.dueDate || billData.due_date,
          total_amount: billData.totalAmount || billData.total_amount || 0,
          amount_paid: 0,
          status: 'pending',
          description: billData.description,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating bill:', error);
        return createCorsResponse({ error: 'Failed to create bill' }, 500, req);
      }

      // Create line items
      if (lineItems && lineItems.length > 0) {
        const lines = lineItems.map((line: any, index: number) => ({
          bill_id: bill.id,
          line_number: index + 1,
          description: line.description,
          quantity: line.quantity || 1,
          unit_price: line.unitPrice || line.unit_price || 0,
          amount: line.amount || (line.quantity || 1) * (line.unitPrice || line.unit_price || 0),
          account_id: line.accountId || line.account_id,
          created_at: new Date().toISOString(),
        }));

        await admin.from('bill_line_items').insert(lines);
      }

      return createCorsResponse(bill, 201, req);
    }

    // PUT /account-payable/bills/:id - Update bill
    if (req.method === 'PUT' && endpoint === 'bills' && billId) {
      const body = await req.json();

      const { data: bill, error } = await admin
        .from('bills')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', billId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update bill' }, 500, req);
      }

      return createCorsResponse(bill, 200, req);
    }

    // GET /account-payable/summary - AP summary
    if (req.method === 'GET' && endpoint === 'summary') {
      const { data: bills } = await admin
        .from('bills')
        .select('total_amount, amount_paid, due_date, status')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'approved', 'overdue']);

      const now = new Date();
      let current = 0;
      let overdue = 0;
      let dueThisWeek = 0;

      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      (bills || []).forEach((bill: any) => {
        const balance = (bill.total_amount || 0) - (bill.amount_paid || 0);
        const dueDate = new Date(bill.due_date);

        if (dueDate < now) {
          overdue += balance;
        } else if (dueDate <= weekFromNow) {
          dueThisWeek += balance;
        } else {
          current += balance;
        }
      });

      return createCorsResponse(
        {
          totalPayables: current + overdue + dueThisWeek,
          current,
          dueThisWeek,
          overdue,
          billCount: bills?.length || 0,
        },
        200,
        req,
      );
    }

    // POST /account-payable/pay - Pay a bill
    if (req.method === 'POST' && endpoint === 'pay') {
      const body = await req.json();

      const { data: payment, error } = await admin
        .from('bill_payments')
        .insert({
          tenant_id: tenantId,
          bill_id: body.billId || body.bill_id,
          vendor_id: body.vendorId || body.vendor_id,
          amount: body.amount,
          payment_date: body.paymentDate || body.payment_date || new Date().toISOString(),
          payment_method: body.paymentMethod || body.payment_method,
          check_number: body.checkNumber || body.check_number,
          reference_number: body.referenceNumber || body.reference_number,
          bank_account_id: body.bankAccountId || body.bank_account_id,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to record payment' }, 500, req);
      }

      // Update bill
      const billIdValue = body.billId || body.bill_id;
      const { data: bill } = await admin
        .from('bills')
        .select('amount_paid, total_amount')
        .eq('id', billIdValue)
        .single();

      const newAmountPaid = (bill?.amount_paid || 0) + body.amount;
      const newStatus = newAmountPaid >= (bill?.total_amount || 0) ? 'paid' : 'partial';

      await admin
        .from('bills')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', billIdValue);

      return createCorsResponse(payment, 201, req);
    }

    // POST /account-payable/approve - Approve bill for payment
    if (req.method === 'POST' && endpoint === 'approve') {
      const body = await req.json();

      const { data: bill, error } = await admin
        .from('bills')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.billId || body.bill_id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to approve bill' }, 500, req);
      }

      return createCorsResponse(bill, 200, req);
    }

    // GET /account-payable/vendors - Get vendor balances
    if (req.method === 'GET' && endpoint === 'vendors') {
      const { data: bills } = await admin
        .from('bills')
        .select(
          `
          vendor_id,
          total_amount,
          amount_paid,
          vendor:vendor_id (
            id,
            company_name
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'approved', 'overdue']);

      const vendorBalances = new Map<
        string,
        { name: string; balance: number; billCount: number }
      >();
      (bills || []).forEach((bill: any) => {
        const balance = (bill.total_amount || 0) - (bill.amount_paid || 0);
        const current = vendorBalances.get(bill.vendor_id) || {
          name: bill.vendor?.company_name || 'Unknown',
          balance: 0,
          billCount: 0,
        };
        vendorBalances.set(bill.vendor_id, {
          ...current,
          balance: current.balance + balance,
          billCount: current.billCount + 1,
        });
      });

      const result = Array.from(vendorBalances.entries())
        .map(([vendorId, data]) => ({ vendorId, ...data }))
        .sort((a, b) => b.balance - a.balance);

      return createCorsResponse(result, 200, req);
    }

    // DELETE /account-payable/bills/:id - Delete bill
    if (req.method === 'DELETE' && endpoint === 'bills' && billId) {
      // Delete line items first
      await admin.from('bill_line_items').delete().eq('bill_id', billId);

      const { error } = await admin
        .from('bills')
        .delete()
        .eq('id', billId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete bill' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Bill deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in account-payable function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
