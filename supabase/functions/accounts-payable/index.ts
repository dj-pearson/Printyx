// Accounts Payable Edge Function (EDGE-005a)
//
// Replaces the legacy singular `account-payable` edge function, which served an
// orphaned `bills`/`bill_line_items`/`bill_payments` sub-ledger over nested
// `/bills/:id` + `/summary` URLs. None of those tables exist in the Drizzle
// schema and no frontend code ever called that shape — it was dead drift.
//
// The real contract the frontend (client/src/pages/AccountsPayable.tsx) speaks
// is flat CRUD over the `accounts_payable` table (shared/schema.ts:6356):
//   GET    /accounts-payable        — list all AP records in tenant
//   GET    /accounts-payable/:id    — single record (edit form / view)
//   POST   /accounts-payable        — create
//   PATCH  /accounts-payable/:id    — update (frontend uses PATCH)
//   PUT    /accounts-payable/:id    — update (accepted for symmetry)
//   DELETE /accounts-payable/:id    — delete
//
// Naming: the directory is PLURAL (`accounts-payable`) so production routing
// works — the frontend hits functions.printyx.net/accounts-payable directly
// (config.ts getApiUrl strips /api/), and server.ts resolves the first path
// segment to a function dir by exact name.
//
// Response shape: the Express path returned Drizzle objects with camelCase keys
// (`totalAmount`, `balanceAmount`, …) and the frontend reads those directly
// (e.g. `ap.totalAmount.toString()`). supabase-js returns raw snake_case, so we
// convert rows back to camelCase to preserve the established contract.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

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
    const { parts } = normalizePath(url.pathname, 'accounts-payable');
    const id = parts[0]; // record id, or undefined for the collection

    if (req.method === 'GET' && !id) return await listAP(admin, tenantId, req, url);
    if (req.method === 'GET' && id) return await getAP(admin, tenantId, id, req);
    if (req.method === 'POST' && !id) return await createAP(admin, tenantId, user.id, req);
    if ((req.method === 'PATCH' || req.method === 'PUT') && id)
      return await updateAP(admin, tenantId, id, req);
    if (req.method === 'DELETE' && id) return await deleteAP(admin, tenantId, id, req);

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in accounts-payable function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ─── handlers ────────────────────────────────────────────────────────────────

async function listAP(admin: Admin, tenantId: string, req: Request, url: URL): Promise<Response> {
  const status = url.searchParams.get('status');

  let query = admin
    .from('accounts_payable')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching accounts payable:', error);
    return createCorsResponse({ error: 'Failed to fetch accounts payable' }, 500, req);
  }
  return createCorsResponse((data ?? []).map(toCamel), 200, req);
}

async function getAP(admin: Admin, tenantId: string, id: string, req: Request): Promise<Response> {
  const { data, error } = await admin
    .from('accounts_payable')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return createCorsResponse({ error: 'Account payable not found' }, 404, req);
  }
  return createCorsResponse(toCamel(data), 200, req);
}

async function createAP(
  admin: Admin,
  tenantId: string,
  userId: string,
  req: Request,
): Promise<Response> {
  const body = await req.json();
  const cols = mapBodyToColumns(body);

  if (!cols.vendor_id) return createCorsResponse({ error: 'vendorId is required' }, 400, req);
  if (!cols.bill_number) return createCorsResponse({ error: 'billNumber is required' }, 400, req);

  // balance_amount is NOT NULL — default to total when the client omits it.
  if (cols.balance_amount === undefined || cols.balance_amount === null) {
    cols.balance_amount = cols.total_amount ?? 0;
  }

  const insertRow = {
    tenant_id: tenantId,
    created_by: userId,
    ...cols,
  };

  const { data, error } = await admin.from('accounts_payable').insert(insertRow).select().single();

  if (error) {
    console.error('Error creating account payable:', error);
    return createCorsResponse({ error: 'Failed to create account payable' }, 500, req);
  }
  return createCorsResponse(toCamel(data), 201, req);
}

async function updateAP(
  admin: Admin,
  tenantId: string,
  id: string,
  req: Request,
): Promise<Response> {
  const body = await req.json();
  const update = {
    ...mapBodyToColumns(body),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('accounts_payable')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return createCorsResponse({ error: 'Failed to update account payable' }, 500, req);
  }
  return createCorsResponse(toCamel(data), 200, req);
}

async function deleteAP(
  admin: Admin,
  tenantId: string,
  id: string,
  req: Request,
): Promise<Response> {
  const { error } = await admin
    .from('accounts_payable')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id);

  if (error) {
    return createCorsResponse({ error: 'Failed to delete account payable' }, 500, req);
  }
  return createCorsResponse({ success: true, message: 'Account payable deleted' }, 200, req);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// Whitelist incoming camelCase/snake_case keys → snake_case columns
// (shared/schema.ts accountsPayable). Drops unknown fields so the client can't
// inject phantom columns.
function mapBodyToColumns(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const fields: Array<[string, string]> = [
    ['vendorId', 'vendor_id'],
    ['billNumber', 'bill_number'],
    ['purchaseOrderNumber', 'purchase_order_number'],
    ['referenceNumber', 'reference_number'],
    ['billDate', 'bill_date'],
    ['dueDate', 'due_date'],
    ['description', 'description'],
    ['subtotal', 'subtotal'],
    ['taxAmount', 'tax_amount'],
    ['totalAmount', 'total_amount'],
    ['paidAmount', 'paid_amount'],
    ['balanceAmount', 'balance_amount'],
    ['status', 'status'],
    ['priority', 'priority'],
    ['category', 'category'],
    ['department', 'department'],
    ['paymentMethod', 'payment_method'],
    ['paymentDate', 'payment_date'],
    ['checkNumber', 'check_number'],
    ['approvedBy', 'approved_by'],
    ['approvedDate', 'approved_date'],
    ['approvalNotes', 'approval_notes'],
  ];
  for (const [camel, snake] of fields) {
    if (body[camel] !== undefined) out[snake] = body[camel];
    else if (body[snake] !== undefined) out[snake] = body[snake];
  }
  return out;
}

// Convert a DB row's snake_case keys to camelCase to match the Drizzle/Express
// response the frontend was built against.
function toCamel(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}
