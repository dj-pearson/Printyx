// Account Payable Edge Function
<<<<<<< HEAD
// Handles accounts payable (vendor bills) management.
//
// URL contract (EDGE-005a): the frontend (client/src/pages/AccountsPayable.tsx)
// calls the FLAT /api/accounts-payable[/:id] shape — list/create at the root and
// get/update/delete on /:id. In production the request reaches functions.printyx.net
// directly; server.ts maps the plural `accounts-payable` segment to this function
// and STRIPS the function-name segment before invoking the handler, so paths arrive
// here as `/` (list/create) or `/<id>` (single). normalizePath makes us robust to
// either calling convention (function name still present or already stripped).
//
// Canonical table: `accounts_payable` (shared/schema.ts) — columns match the
// frontend form fields exactly. (The previous implementation queried a `bills`
// table with nested /bills URLs the frontend never called.)
=======
// Flat CRUD over the canonical `accounts_payable` table.
//
// EDGE-005a: the frontend (client/src/pages/AccountsPayable.tsx) calls the FLAT
// prefix /api/accounts-payable:
//   GET    /api/accounts-payable        → list
//   POST   /api/accounts-payable        → create
//   PATCH  /api/accounts-payable/:id    → update
// In production that resolves to functions.printyx.net/accounts-payable (getApiUrl
// strips /api/), and server.ts route-overrides map the `accounts-payable` segment
// to THIS function (dir name is singular `account-payable`) then strips the
// segment, so the handler sees a flat path ('/' for list, '/:id' for an item).
// In dev the edge-function-proxy forwards /api/accounts-payable → this fn the same
// way. normalizePath makes us robust to either calling convention.
//
// The old handlers queried a `bills` table that does not exist in shared/schema.ts
// and that the frontend never expected — they were dead. The canonical table is
// `accounts_payable` (see shared/schema.ts), which the legacy Express handler
// (server/routes-products-crud.ts → storage.getAccountsPayable) already used.
>>>>>>> 7f72da4c (feat(edge): flat-URL parity for accounts-payable/receivable (EDGE-005a))
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

<<<<<<< HEAD
// Snake_case → camelCase so the frontend (which reads camelCase keys directly,
// e.g. ap.totalAmount / ap.balanceAmount) renders without a transformer.
function toCamelRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())] = v;
  }
  return out;
}

// PostgREST signals a missing relation with code 42P01 (undefined_table) or
// PGRST205 (schema cache miss). These tables ship in migration 0000, so this is
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

// Map an incoming (camelCase or snake_case) body to real accounts_payable columns.
// Only keys that map to an actual column are returned, so an unknown field (e.g. a
// stray camelCase alias) never causes a PostgREST "column not found" error.
function toApColumns(body: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (col: string, val: unknown) => {
    if (val !== undefined) out[col] = val;
  };
  set('vendor_id', pick(body.vendorId ?? body.vendor_id));
  set('bill_number', pick(body.billNumber ?? body.bill_number));
  set('purchase_order_number', pick(body.purchaseOrderNumber ?? body.purchase_order_number));
  set('reference_number', pick(body.referenceNumber ?? body.reference_number));
  set('bill_date', pick(body.billDate ?? body.bill_date));
  set('due_date', pick(body.dueDate ?? body.due_date));
  set('description', pick(body.description));
  set('subtotal', pick(body.subtotal));
  set('tax_amount', pick(body.taxAmount ?? body.tax_amount));
  set('total_amount', pick(body.totalAmount ?? body.total_amount));
  set('paid_amount', pick(body.paidAmount ?? body.paid_amount));
  set('balance_amount', pick(body.balanceAmount ?? body.balance_amount));
  set('status', pick(body.status));
  set('priority', pick(body.priority));
  set('category', pick(body.category));
  set('department', pick(body.department));
  set('payment_method', pick(body.paymentMethod ?? body.payment_method));
  set('payment_date', pick(body.paymentDate ?? body.payment_date));
  set('check_number', pick(body.checkNumber ?? body.check_number));
  set('approved_by', pick(body.approvedBy ?? body.approved_by));
  set('approval_notes', pick(body.approvalNotes ?? body.approval_notes));
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
    const { parts } = normalizePath(url.pathname, 'account-payable');
    const resource = parts[0]; // '' (list/create), 'summary', or a bill id

    // GET /accounts-payable/summary - AP aging summary
    if (req.method === 'GET' && resource === 'summary') {
      const { data: rows, error } = await admin
        .from('accounts_payable')
        .select('total_amount, paid_amount, balance_amount, due_date, status')
        .eq('tenant_id', tenantId)
        .neq('status', 'paid');

      if (error && isMissingTableError(error)) {
        return createCorsResponse(
          { totalPayables: 0, current: 0, dueThisWeek: 0, overdue: 0, billCount: 0 },
          200,
          req,
        );
      }
      if (error) {
        console.error('Error fetching AP summary:', error);
        return createCorsResponse({ error: 'Failed to fetch summary' }, 500, req);
      }

      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      let current = 0;
      let overdue = 0;
      let dueThisWeek = 0;

      (rows || []).forEach((b: any) => {
        const balance =
          b.balance_amount != null
            ? Number(b.balance_amount)
            : Number(b.total_amount || 0) - Number(b.paid_amount || 0);
        const dueDate = new Date(b.due_date);
        if (dueDate < now) overdue += balance;
        else if (dueDate <= weekFromNow) dueThisWeek += balance;
        else current += balance;
      });

      return createCorsResponse(
        {
          totalPayables: current + overdue + dueThisWeek,
          current,
          dueThisWeek,
          overdue,
          billCount: rows?.length || 0,
        },
        200,
        req,
      );
    }

    // GET /accounts-payable - List bills
    if (req.method === 'GET' && !resource) {
      const status = url.searchParams.get('status');
      const vendorId = url.searchParams.get('vendorId') || url.searchParams.get('vendor_id');

      let query = admin
        .from('accounts_payable')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true });

      if (status) query = query.eq('status', status);
      if (vendorId) query = query.eq('vendor_id', vendorId);

      const { data: bills, error, count } = await query;

      if (error && isMissingTableError(error)) {
        return createCorsResponse({ data: [], total: 0 }, 200, req);
      }
      if (error) {
        console.error('Error fetching accounts payable:', error);
        return createCorsResponse({ error: 'Failed to fetch accounts payable' }, 500, req);
      }

      return createCorsResponse(
        { data: (bills || []).map(toCamelRow), total: count ?? bills?.length ?? 0 },
        200,
        req,
      );
    }

    // GET /accounts-payable/:id - Get single bill
    if (req.method === 'GET' && resource) {
      const { data: bill, error } = await admin
        .from('accounts_payable')
        .select('*')
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !bill) {
        return createCorsResponse({ error: 'Bill not found' }, 404, req);
      }

      return createCorsResponse(toCamelRow(bill), 200, req);
    }

    // POST /accounts-payable - Create bill
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
        vendor_id: pick(body.vendorId, body.vendor_id),
        bill_number: pick(body.billNumber, body.bill_number),
        purchase_order_number: pick(body.purchaseOrderNumber, body.purchase_order_number) || null,
        reference_number: pick(body.referenceNumber, body.reference_number) || null,
        bill_date: pick(body.billDate, body.bill_date) || new Date().toISOString(),
        due_date: pick(body.dueDate, body.due_date),
        description: body.description ?? null,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        balance_amount: balanceAmount,
        status: pick(body.status, 'pending'),
        priority: pick(body.priority, 'normal'),
        category: body.category || null,
        department: body.department || null,
        payment_method: pick(body.paymentMethod, body.payment_method) || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!insert.vendor_id || !insert.bill_number || !insert.due_date) {
        return createCorsResponse(
          { error: 'vendorId, billNumber and dueDate are required' },
          400,
          req,
        );
      }

      const { data: bill, error } = await admin
        .from('accounts_payable')
        .insert(insert)
        .select()
        .single();

      if (error && isMissingTableError(error)) {
        return createCorsResponse({ error: 'Accounts payable storage is unavailable' }, 503, req);
      }
      if (error) {
        console.error('Error creating bill:', error);
        return createCorsResponse({ error: 'Failed to create bill' }, 500, req);
      }

      return createCorsResponse(toCamelRow(bill), 201, req);
    }

    // PUT | PATCH /accounts-payable/:id - Update bill (frontend uses PATCH)
    if ((req.method === 'PUT' || req.method === 'PATCH') && resource) {
      const body = await req.json().catch(() => ({}));
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

      const map: Record<string, string> = {
        vendorId: 'vendor_id',
        billNumber: 'bill_number',
        purchaseOrderNumber: 'purchase_order_number',
        referenceNumber: 'reference_number',
        billDate: 'bill_date',
        dueDate: 'due_date',
        description: 'description',
        subtotal: 'subtotal',
        taxAmount: 'tax_amount',
        totalAmount: 'total_amount',
        paidAmount: 'paid_amount',
        balanceAmount: 'balance_amount',
        status: 'status',
        priority: 'priority',
        category: 'category',
        department: 'department',
        paymentMethod: 'payment_method',
      };

      for (const [camel, snake] of Object.entries(map)) {
        if (body[camel] !== undefined) update[snake] = body[camel];
        else if (body[snake] !== undefined) update[snake] = body[snake];
      }

      const { data: bill, error } = await admin
        .from('accounts_payable')
        .update(update)
        .eq('id', resource)
=======
    const { parts } = normalizePath(new URL(req.url).pathname, 'account-payable');
    // parts[0] is the resource id for /:id routes, or undefined for the collection.
    const apId = parts[0];

    // GET /accounts-payable - list
    if (req.method === 'GET' && !apId) {
      const { data, error } = await admin
        .from('accounts_payable')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching accounts payable:', error);
        return createCorsResponse({ error: 'Failed to fetch accounts payable' }, 500, req);
      }
      return createCorsResponse(data || [], 200, req);
    }

    // GET /accounts-payable/:id - single
    if (req.method === 'GET' && apId) {
      const { data, error } = await admin
        .from('accounts_payable')
        .select('*')
        .eq('id', apId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        return createCorsResponse({ error: 'Account payable not found' }, 404, req);
      }
      return createCorsResponse(data, 200, req);
    }

    // POST /accounts-payable - create
    if (req.method === 'POST' && !apId) {
      const body = await req.json();
      const cols = toApColumns(body);

      // balance_amount is NOT NULL; default to total - paid when the client omits it.
      if (cols.balance_amount === undefined) {
        const total = Number(cols.total_amount ?? 0);
        const paid = Number(cols.paid_amount ?? 0);
        cols.balance_amount = total - paid;
      }
      if (cols.paid_amount === undefined) cols.paid_amount = 0;

      const { data, error } = await admin
        .from('accounts_payable')
        .insert({
          ...cols,
          tenant_id: tenantId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating account payable:', error);
        return createCorsResponse(
          { error: 'Failed to create account payable', detail: error.message },
          500,
          req,
        );
      }
      return createCorsResponse(data, 201, req);
    }

    // PATCH / PUT /accounts-payable/:id - update
    if ((req.method === 'PATCH' || req.method === 'PUT') && apId) {
      const body = await req.json();
      const cols = toApColumns(body);

      const { data, error } = await admin
        .from('accounts_payable')
        .update({ ...cols, updated_at: new Date().toISOString() })
        .eq('id', apId)
>>>>>>> 7f72da4c (feat(edge): flat-URL parity for accounts-payable/receivable (EDGE-005a))
        .eq('tenant_id', tenantId)
        .select()
        .single();

<<<<<<< HEAD
      if (error || !bill) {
        console.error('Error updating bill:', error);
        return createCorsResponse({ error: 'Failed to update bill' }, error ? 500 : 404, req);
      }

      return createCorsResponse(toCamelRow(bill), 200, req);
    }

    // DELETE /accounts-payable/:id - Delete bill
    if (req.method === 'DELETE' && resource) {
      const { error } = await admin
        .from('accounts_payable')
        .delete()
        .eq('id', resource)
=======
      if (error || !data) {
        return createCorsResponse(
          { error: 'Failed to update account payable', detail: error?.message },
          error ? 500 : 404,
          req,
        );
      }
      return createCorsResponse(data, 200, req);
    }

    // DELETE /accounts-payable/:id
    if (req.method === 'DELETE' && apId) {
      const { error } = await admin
        .from('accounts_payable')
        .delete()
        .eq('id', apId)
>>>>>>> 7f72da4c (feat(edge): flat-URL parity for accounts-payable/receivable (EDGE-005a))
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete account payable' }, 500, req);
      }
      return createCorsResponse({ success: true, message: 'Account payable deleted' }, 200, req);
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
