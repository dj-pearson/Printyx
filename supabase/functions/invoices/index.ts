// Invoices Edge Function
// Handles invoice generation and management
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
    const invoiceId = pathParts[1];

    // GET /invoices - List invoices
    if (req.method === 'GET' && !invoiceId) {
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const status = url.searchParams.get('status');
      const invoiceStatus =
        url.searchParams.get('invoiceStatus') || url.searchParams.get('invoice_status');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('invoices')
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

      if (invoiceStatus) {
        query = query.eq('invoice_status', invoiceStatus);
      }

      if (search) {
        query = query.or(`invoice_number.ilike.%${search}%,po_number.ilike.%${search}%`);
      }

      const { data: invoices, error, count } = await query;

      if (error) {
        console.error('Error fetching invoices:', error);
        return createCorsResponse({ error: 'Failed to fetch invoices' }, 500, req);
      }

      // Enrich with customer names
      const enriched = await enrichWithCustomerNames(admin, invoices || []);
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

    // GET /invoices/:id - Get single invoice with line items
    if (req.method === 'GET' && invoiceId) {
      const { data: invoiceData, error } = await admin
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('tenant_id', tenantId)
        .single();

      // Enrich with customer info
      let invoice = invoiceData;
      if (invoiceData?.customer_id) {
        const { data: customer } = await admin
          .from('business_records')
          .select(
            'id, company_name, primary_contact_name, primary_contact_email, primary_contact_phone, address_line1, address_line2, city, state, postal_code',
          )
          .eq('id', invoiceData.customer_id)
          .single();
        invoice = { ...invoiceData, customer: customer || null };
      }

      if (error) {
        console.error('Error fetching invoice:', error);
        return createCorsResponse({ error: 'Invoice not found' }, 404, req);
      }

      // Get line items
      const { data: lineItems } = await admin
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      return createCorsResponse({ ...invoice, lineItems: lineItems || [] }, 200, req);
    }

    // POST /invoices - Create invoice
    if (req.method === 'POST') {
      const body = await req.json();

      const invoiceNumber = body.invoiceNumber || body.invoice_number || `INV-${Date.now()}`;

      // Calculate totals from line items
      const lineItems = body.lineItems || body.line_items || [];
      const subtotal = lineItems.reduce(
        (sum: number, item: any) => sum + parseFloat(item.totalPrice || item.total_price || 0),
        0,
      );
      const tax = body.taxAmount || body.tax_amount || 0;
      const total = subtotal + parseFloat(tax);

      const invoiceData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        contract_id: body.contractId || body.contract_id || null,
        invoice_number: invoiceNumber,
        due_date:
          body.dueDate ||
          body.due_date ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        po_number: body.poNumber || body.po_number || null,
        sales_rep: body.salesRep || body.sales_rep || null,
        invoice_type: body.invoiceType || body.invoice_type || 'sales',
        subtotal_amount: subtotal,
        tax_amount: tax,
        total_amount: total,
        amount_paid: 0,
        balance_due: total,
        invoice_status: body.invoiceStatus || body.invoice_status || 'open',
        payment_terms: body.paymentTerms || body.payment_terms || 'Net 30',
        billing_period_start: body.billingPeriodStart || body.billing_period_start || null,
        billing_period_end: body.billingPeriodEnd || body.billing_period_end || null,
        status: body.status || 'draft',
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: invoice, error } = await admin
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (error) {
        console.error('Error creating invoice:', error);
        return createCorsResponse({ error: 'Failed to create invoice', details: error }, 500, req);
      }

      // Insert line items if provided
      if (lineItems.length > 0) {
        const lineItemsData = lineItems.map((item: any) => ({
          tenant_id: tenantId,
          invoice_id: invoice.id,
          equipment_id: item.equipmentId || item.equipment_id || null,
          meter_reading_id: item.meterReadingId || item.meter_reading_id || null,
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unitPrice || item.unit_price,
          total_price: item.totalPrice || item.total_price,
          item_type: item.itemType || item.item_type || 'service',
          copies: item.copies || null,
          created_at: new Date().toISOString(),
        }));

        await admin.from('invoice_line_items').insert(lineItemsData);
      }

      // Fetch line items separately
      const { data: createdLineItems } = await admin
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      return createCorsResponse({ ...invoice, lineItems: createdLineItems || [] }, 201, req);
    }

    // PATCH /invoices/:id - Update invoice
    if ((req.method === 'PATCH' || req.method === 'PUT') && invoiceId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.dueDate || body.due_date) updateData.due_date = body.dueDate || body.due_date;
      if (body.poNumber !== undefined || body.po_number !== undefined)
        updateData.po_number = body.poNumber || body.po_number;
      if (body.salesRep || body.sales_rep) updateData.sales_rep = body.salesRep || body.sales_rep;
      if (body.invoiceType || body.invoice_type)
        updateData.invoice_type = body.invoiceType || body.invoice_type;
      if (body.subtotalAmount !== undefined || body.subtotal_amount !== undefined)
        updateData.subtotal_amount = body.subtotalAmount || body.subtotal_amount;
      if (body.taxAmount !== undefined || body.tax_amount !== undefined)
        updateData.tax_amount = body.taxAmount || body.tax_amount;
      if (body.totalAmount !== undefined || body.total_amount !== undefined)
        updateData.total_amount = body.totalAmount || body.total_amount;
      if (body.amountPaid !== undefined || body.amount_paid !== undefined) {
        updateData.amount_paid = body.amountPaid || body.amount_paid;
        // Recalculate balance
        const total = body.totalAmount || body.total_amount;
        if (total !== undefined) {
          updateData.balance_due = parseFloat(total) - parseFloat(updateData.amount_paid);
        }
      }
      if (body.invoiceStatus || body.invoice_status)
        updateData.invoice_status = body.invoiceStatus || body.invoice_status;
      if (body.status) updateData.status = body.status;
      if (body.paymentTerms || body.payment_terms)
        updateData.payment_terms = body.paymentTerms || body.payment_terms;
      if (body.paidDate || body.paid_date !== undefined)
        updateData.paid_date = body.paidDate || body.paid_date;

      const { data: invoice, error } = await admin
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating invoice:', error);
        return createCorsResponse({ error: 'Failed to update invoice' }, 500, req);
      }

      // Update line items if provided
      if (body.lineItems || body.line_items) {
        const lineItems = body.lineItems || body.line_items;

        // Delete existing line items
        await admin
          .from('invoice_line_items')
          .delete()
          .eq('invoice_id', invoiceId)
          .eq('tenant_id', tenantId);

        // Insert new line items
        if (lineItems.length > 0) {
          const lineItemsData = lineItems.map((item: any) => ({
            tenant_id: tenantId,
            invoice_id: invoiceId,
            equipment_id: item.equipmentId || item.equipment_id || null,
            meter_reading_id: item.meterReadingId || item.meter_reading_id || null,
            description: item.description,
            quantity: item.quantity || 1,
            unit_price: item.unitPrice || item.unit_price,
            total_price: item.totalPrice || item.total_price,
            item_type: item.itemType || item.item_type || 'service',
            copies: item.copies || null,
            created_at: new Date().toISOString(),
          }));

          await admin.from('invoice_line_items').insert(lineItemsData);
        }
      }

      // Fetch updated line items separately
      const { data: updatedLineItems } = await admin
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      return createCorsResponse({ ...invoice, lineItems: updatedLineItems || [] }, 200, req);
    }

    // DELETE /invoices/:id - Delete invoice
    if (req.method === 'DELETE' && invoiceId) {
      // Delete line items first
      await admin
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', invoiceId)
        .eq('tenant_id', tenantId);

      // Delete invoice
      const { error } = await admin
        .from('invoices')
        .delete()
        .eq('id', invoiceId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting invoice:', error);
        return createCorsResponse({ error: 'Failed to delete invoice' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Invoice deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in invoices function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
