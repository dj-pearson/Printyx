// Account Receivable Edge Function
<<<<<<< HEAD
// Handles accounts receivable (customer invoices) management.
//
// URL contract (EDGE-005a): the frontend (client/src/pages/AccountsReceivable.tsx)
// calls the FLAT /api/accounts-receivable[/:id] shape — list/create at the root and
// get/update/delete on /:id. In production the request reaches functions.printyx.net
// directly; server.ts maps the plural `accounts-receivable` segment to this function
// and STRIPS the function-name segment before invoking the handler, so paths arrive
// here as `/` (list/create) or `/<id>` (single). normalizePath makes us robust to
// either calling convention (function name still present or already stripped).
//
// Canonical table: `accounts_receivable` (shared/schema.ts) — columns match the
// frontend form fields. (The previous implementation queried the E-Automate
// `invoices` table with nested /summary, /aging, ... URLs the frontend never called.)
=======
// Flat CRUD over the canonical `accounts_receivable` table.
//
// EDGE-005a: the frontend (client/src/pages/AccountsReceivable.tsx) calls the FLAT
// prefix /api/accounts-receivable:
//   GET    /api/accounts-receivable        → list
//   POST   /api/accounts-receivable        → create
//   PATCH  /api/accounts-receivable/:id    → update
// In production that resolves to functions.printyx.net/accounts-receivable
// (getApiUrl strips /api/); server.ts route-overrides map the `accounts-receivable`
// segment to THIS function (dir name is singular `account-receivable`) then strips
// it, so the handler sees a flat path. In dev the edge-function-proxy forwards the
// same way. normalizePath makes us robust to either calling convention.
//
// The old handlers queried `invoices`/`payments`/`ar_reminders`/`ar_write_offs` —
// a different data model the AccountsReceivable page never read. The canonical
// table is `accounts_receivable` (see shared/schema.ts), which the legacy Express
// handler (server/routes-products-crud.ts → storage.getAccountsReceivable) used.
>>>>>>> 7f72da4c (feat(edge): flat-URL parity for accounts-payable/receivable (EDGE-005a))
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

<<<<<<< HEAD
// Snake_case → camelCase so the frontend (which reads camelCase keys directly,
// e.g. ar.totalAmount / ar.balanceAmount) renders without a transformer. The
// frontend's "reference number" maps to the sales_order_number column, so echo it
// back under both keys.
function toCamelRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())] = v;
  }
  if (out.referenceNumber === undefined && out.salesOrderNumber !== undefined) {
    out.referenceNumber = out.salesOrderNumber;
  }
  return out;
}

// PostgREST signals a missing relation with code 42P01 (undefined_table) or
// PGRST205 (schema cache miss). This table ships in migration 0000, so this is
// belt-and-suspenders: GET degrades to an empty list, writes to a clear 503.
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /could not find the table|does not exist|relation .* does not exist/i.test(error.message || '')
  );
}

const pick = <T>(...vals: T[]): T | undefined => vals.find((v) => v !== undefined);
=======
const pick = <T>(v: T | undefined): T | undefined =>
  v === undefined || v === null ? undefined : v;

// Map an incoming (camelCase or snake_case) body to real accounts_receivable
// columns. Frontend-only fields with no column (priority, referenceNumber) are
// intentionally dropped so they can't trigger a PostgREST "column not found".
function toArColumns(body: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (col: string, val: unknown) => {
    if (val !== undefined) out[col] = val;
  };
  set('customer_id', pick(body.customerId ?? body.customer_id));
  set('invoice_number', pick(body.invoiceNumber ?? body.invoice_number));
  set('contract_id', pick(body.contractId ?? body.contract_id));
  set('sales_order_number', pick(body.salesOrderNumber ?? body.sales_order_number));
  set('invoice_date', pick(body.invoiceDate ?? body.invoice_date));
  set('due_date', pick(body.dueDate ?? body.due_date));
  set('description', pick(body.description));
  set('subtotal', pick(body.subtotal));
  set('tax_amount', pick(body.taxAmount ?? body.tax_amount));
  set('total_amount', pick(body.totalAmount ?? body.total_amount));
  set('paid_amount', pick(body.paidAmount ?? body.paid_amount));
  set('balance_amount', pick(body.balanceAmount ?? body.balance_amount));
  set('status', pick(body.status));
  set('invoice_type', pick(body.invoiceType ?? body.invoice_type));
  set('category', pick(body.category));
  set('payment_terms', pick(body.paymentTerms ?? body.payment_terms));
  set('payment_method', pick(body.paymentMethod ?? body.payment_method));
  set('last_payment_date', pick(body.lastPaymentDate ?? body.last_payment_date));
  set('follow_up_date', pick(body.followUpDate ?? body.follow_up_date));
  set('collection_notes', pick(body.collectionNotes ?? body.collection_notes));
  set('days_overdue', pick(body.daysOverdue ?? body.days_overdue));
  return out;
}
>>>>>>> 7f72da4c (feat(edge): flat-URL parity for accounts-payable/receivable (EDGE-005a))

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
    } = await supabase.auth.getUser(jwt ?? undefined);

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
<<<<<<< HEAD
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'account-receivable');
    const resource = parts[0]; // '' (list/create), 'summary', or an invoice id

    // GET /accounts-receivable/summary - AR aging summary
    if (req.method === 'GET' && resource === 'summary') {
      const { data: rows, error } = await admin
        .from('accounts_receivable')
        .select('total_amount, paid_amount, balance_amount, due_date, status')
        .eq('tenant_id', tenantId)
        .neq('status', 'paid');

      if (error && isMissingTableError(error)) {
        return createCorsResponse(
          {
            totalReceivables: 0,
            current: 0,
            overdue30: 0,
            overdue60: 0,
            overdue90: 0,
            overdue90Plus: 0,
            invoiceCount: 0,
          },
          200,
          req,
        );
      }
      if (error) {
        console.error('Error fetching AR summary:', error);
        return createCorsResponse({ error: 'Failed to fetch summary' }, 500, req);
      }

      const now = new Date();
      let current = 0;
      let overdue30 = 0;
      let overdue60 = 0;
      let overdue90 = 0;
      let overdue90Plus = 0;

      (rows || []).forEach((inv: any) => {
        const balance =
          inv.balance_amount != null
            ? Number(inv.balance_amount)
            : Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
        const dueDate = new Date(inv.due_date);
        const daysPast = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysPast <= 0) current += balance;
        else if (daysPast <= 30) overdue30 += balance;
        else if (daysPast <= 60) overdue60 += balance;
        else if (daysPast <= 90) overdue90 += balance;
        else overdue90Plus += balance;
      });

      return createCorsResponse(
        {
          totalReceivables: current + overdue30 + overdue60 + overdue90 + overdue90Plus,
          current,
          overdue30,
          overdue60,
          overdue90,
          overdue90Plus,
          invoiceCount: rows?.length || 0,
        },
        200,
        req,
      );
    }

    // GET /accounts-receivable - List invoices
    if (req.method === 'GET' && !resource) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');

      let query = admin
        .from('accounts_receivable')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true });

      if (status) query = query.eq('status', status);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data: invoices, error, count } = await query;
=======
    const { parts } = normalizePath(new URL(req.url).pathname, 'account-receivable');
    const arId = parts[0];

    // GET /accounts-receivable - list
    if (req.method === 'GET' && !arId) {
      const { data, error } = await admin
        .from('accounts_receivable')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching accounts receivable:', error);
        return createCorsResponse({ error: 'Failed to fetch accounts receivable' }, 500, req);
      }
      return createCorsResponse(data || [], 200, req);
    }

    // GET /accounts-receivable/:id - single
    if (req.method === 'GET' && arId) {
      const { data, error } = await admin
        .from('accounts_receivable')
        .select('*')
        .eq('id', arId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        return createCorsResponse({ error: 'Account receivable not found' }, 404, req);
      }
      return createCorsResponse(data, 200, req);
    }

    // POST /accounts-receivable - create
    if (req.method === 'POST' && !arId) {
      const body = await req.json();
      const cols = toArColumns(body);

      // invoice_type is NOT NULL with no DB default; the AR form doesn't expose it.
      if (cols.invoice_type === undefined) cols.invoice_type = 'standard';
      // balance_amount is NOT NULL; default to total - paid when omitted.
      if (cols.balance_amount === undefined) {
        const total = Number(cols.total_amount ?? 0);
        const paid = Number(cols.paid_amount ?? 0);
        cols.balance_amount = total - paid;
      }
      if (cols.paid_amount === undefined) cols.paid_amount = 0;

      const { data, error } = await admin
        .from('accounts_receivable')
        .insert({
          ...cols,
          tenant_id: tenantId,
          created_by: user.id,
        })
        .select()
        .single();
>>>>>>> 7f72da4c (feat(edge): flat-URL parity for accounts-payable/receivable (EDGE-005a))

      if (error && isMissingTableError(error)) {
        return createCorsResponse({ data: [], total: 0 }, 200, req);
      }
      if (error) {
<<<<<<< HEAD
        console.error('Error fetching accounts receivable:', error);
        return createCorsResponse({ error: 'Failed to fetch accounts receivable' }, 500, req);
      }

      return createCorsResponse(
        { data: (invoices || []).map(toCamelRow), total: count ?? invoices?.length ?? 0 },
        200,
        req,
      );
    }

    // GET /accounts-receivable/:id - Get single invoice
    if (req.method === 'GET' && resource) {
      const { data: invoice, error } = await admin
        .from('accounts_receivable')
        .select('*')
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !invoice) {
        return createCorsResponse({ error: 'Invoice not found' }, 404, req);
      }

      return createCorsResponse(toCamelRow(invoice), 200, req);
    }

    // POST /accounts-receivable - Create invoice
    if (req.method === 'POST' && !resource) {
      const body = await req.json().catch(() => ({}));

      const subtotal = Number(pick(body.subtotal, 0));
      const taxAmount = Number(pick(body.taxAmount, body.tax_amount, 0));
      const totalAmount = Number(pick(body.totalAmount, body.total_amount, subtotal + taxAmount));
      const paidAmount = Number(pick(body.paidAmount, body.paid_amount, 0));
      const balanceAmount = Number(
        pick(body.balanceAmount, body.balance_amount, totalAmount - paidAmount),
      );

      const insert: Record<string, unknown> = {
        tenant_id: tenantId,
        customer_id: pick(body.customerId, body.customer_id),
        invoice_number: pick(body.invoiceNumber, body.invoice_number),
        contract_id: pick(body.contractId, body.contract_id) || null,
        sales_order_number:
          pick(body.salesOrderNumber, body.sales_order_number, body.referenceNumber) || null,
        invoice_date: pick(body.invoiceDate, body.invoice_date) || new Date().toISOString(),
        due_date: pick(body.dueDate, body.due_date),
        description: body.description ?? null,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        balance_amount: balanceAmount,
        status: pick(body.status, 'outstanding'),
        invoice_type: pick(body.invoiceType, body.invoice_type, 'sales'),
        category: body.category || null,
        payment_terms: pick(body.paymentTerms, body.payment_terms, 'Net 30'),
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!insert.customer_id || !insert.invoice_number || !insert.due_date) {
        return createCorsResponse(
          { error: 'customerId, invoiceNumber and dueDate are required' },
          400,
          req,
        );
      }

      const { data: invoice, error } = await admin
        .from('accounts_receivable')
        .insert(insert)
        .select()
        .single();

      if (error && isMissingTableError(error)) {
        return createCorsResponse(
          { error: 'Accounts receivable storage is unavailable' },
          503,
          req,
        );
      }
      if (error) {
        console.error('Error creating invoice:', error);
        return createCorsResponse({ error: 'Failed to create invoice' }, 500, req);
=======
        console.error('Error creating account receivable:', error);
        return createCorsResponse(
          { error: 'Failed to create account receivable', detail: error.message },
          500,
          req,
        );
      }
      return createCorsResponse(data, 201, req);
    }

    // PATCH / PUT /accounts-receivable/:id - update
    if ((req.method === 'PATCH' || req.method === 'PUT') && arId) {
      const body = await req.json();
      const cols = toArColumns(body);

      const { data, error } = await admin
        .from('accounts_receivable')
        .update({ ...cols, updated_at: new Date().toISOString() })
        .eq('id', arId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error || !data) {
        return createCorsResponse(
          { error: 'Failed to update account receivable', detail: error?.message },
          error ? 500 : 404,
          req,
        );
>>>>>>> 7f72da4c (feat(edge): flat-URL parity for accounts-payable/receivable (EDGE-005a))
      }
      return createCorsResponse(data, 200, req);
    }

<<<<<<< HEAD
      return createCorsResponse(toCamelRow(invoice), 201, req);
    }

    // PUT | PATCH /accounts-receivable/:id - Update invoice (frontend uses PATCH)
    if ((req.method === 'PUT' || req.method === 'PATCH') && resource) {
      const body = await req.json().catch(() => ({}));
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

      const map: Record<string, string> = {
        customerId: 'customer_id',
        invoiceNumber: 'invoice_number',
        contractId: 'contract_id',
        referenceNumber: 'sales_order_number',
        salesOrderNumber: 'sales_order_number',
        invoiceDate: 'invoice_date',
        dueDate: 'due_date',
        description: 'description',
        subtotal: 'subtotal',
        taxAmount: 'tax_amount',
        totalAmount: 'total_amount',
        paidAmount: 'paid_amount',
        balanceAmount: 'balance_amount',
        status: 'status',
        invoiceType: 'invoice_type',
        category: 'category',
        paymentTerms: 'payment_terms',
      };

      for (const [camel, snake] of Object.entries(map)) {
        if (body[camel] !== undefined) update[snake] = body[camel];
        else if (body[snake] !== undefined) update[snake] = body[snake];
      }

      const { data: invoice, error } = await admin
        .from('accounts_receivable')
        .update(update)
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error || !invoice) {
        console.error('Error updating invoice:', error);
        return createCorsResponse({ error: 'Failed to update invoice' }, error ? 500 : 404, req);
      }

      return createCorsResponse(toCamelRow(invoice), 200, req);
    }

    // DELETE /accounts-receivable/:id - Delete invoice
    if (req.method === 'DELETE' && resource) {
      const { error } = await admin
        .from('accounts_receivable')
        .delete()
        .eq('id', resource)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete invoice' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Invoice deleted' }, 200, req);
=======
    // DELETE /accounts-receivable/:id
    if (req.method === 'DELETE' && arId) {
      const { error } = await admin
        .from('accounts_receivable')
        .delete()
        .eq('id', arId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete account receivable' }, 500, req);
      }
      return createCorsResponse({ success: true, message: 'Account receivable deleted' }, 200, req);
>>>>>>> 7f72da4c (feat(edge): flat-URL parity for accounts-payable/receivable (EDGE-005a))
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
