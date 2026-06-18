// Accounts Receivable Edge Function (EDGE-005a)
//
// Replaces the legacy singular `account-receivable` edge function, which served
// an orphaned aging/collections feature (`ar_reminders`, `ar_write_offs`,
// `payments`) over nested `/summary` + `/aging` URLs. No frontend code called
// that shape — it was dead drift.
//
// The real contract the frontend (client/src/pages/AccountsReceivable.tsx)
// speaks is flat CRUD over the `accounts_receivable` table (shared/schema.ts):
//   GET    /accounts-receivable        — list all AR records in tenant
//   GET    /accounts-receivable/:id    — single record
//   POST   /accounts-receivable        — create
//   PATCH  /accounts-receivable/:id    — update (frontend uses PATCH)
//   PUT    /accounts-receivable/:id    — update (accepted for symmetry)
//   DELETE /accounts-receivable/:id    — delete
//
// See the sibling accounts-payable function for the naming (PLURAL dir for prod
// routing) and camelCase response-shape rationale.
//
// Drift: the AR form omits `invoice_type` (NOT NULL, no DB default) and sends
// `referenceNumber`/`priority` (no such columns). We default invoice_type to
// 'invoice' and the column whitelist drops the phantom fields.

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
    const { parts } = normalizePath(url.pathname, 'accounts-receivable');
    const id = parts[0]; // record id, or undefined for the collection

    if (req.method === 'GET' && !id) return await listAR(admin, tenantId, req, url);
    if (req.method === 'GET' && id) return await getAR(admin, tenantId, id, req);
    if (req.method === 'POST' && !id) return await createAR(admin, tenantId, user.id, req);
    if ((req.method === 'PATCH' || req.method === 'PUT') && id)
      return await updateAR(admin, tenantId, id, req);
    if (req.method === 'DELETE' && id) return await deleteAR(admin, tenantId, id, req);

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in accounts-receivable function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ─── handlers ────────────────────────────────────────────────────────────────

async function listAR(admin: Admin, tenantId: string, req: Request, url: URL): Promise<Response> {
  const status = url.searchParams.get('status');

  let query = admin
    .from('accounts_receivable')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching accounts receivable:', error);
    return createCorsResponse({ error: 'Failed to fetch accounts receivable' }, 500, req);
  }
  return createCorsResponse((data ?? []).map(toCamel), 200, req);
}

async function getAR(admin: Admin, tenantId: string, id: string, req: Request): Promise<Response> {
  const { data, error } = await admin
    .from('accounts_receivable')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return createCorsResponse({ error: 'Account receivable not found' }, 404, req);
  }
  return createCorsResponse(toCamel(data), 200, req);
}

async function createAR(
  admin: Admin,
  tenantId: string,
  userId: string,
  req: Request,
): Promise<Response> {
  const body = await req.json();
  const cols = mapBodyToColumns(body);

  if (!cols.customer_id) return createCorsResponse({ error: 'customerId is required' }, 400, req);
  if (!cols.invoice_number)
    return createCorsResponse({ error: 'invoiceNumber is required' }, 400, req);

  // invoice_type is NOT NULL with no default; balance_amount is NOT NULL.
  if (cols.invoice_type === undefined || cols.invoice_type === null) cols.invoice_type = 'invoice';
  if (cols.balance_amount === undefined || cols.balance_amount === null) {
    cols.balance_amount = cols.total_amount ?? 0;
  }

  const insertRow = {
    tenant_id: tenantId,
    created_by: userId,
    ...cols,
  };

  const { data, error } = await admin
    .from('accounts_receivable')
    .insert(insertRow)
    .select()
    .single();

  if (error) {
    console.error('Error creating account receivable:', error);
    return createCorsResponse({ error: 'Failed to create account receivable' }, 500, req);
  }
  return createCorsResponse(toCamel(data), 201, req);
}

async function updateAR(
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
    .from('accounts_receivable')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return createCorsResponse({ error: 'Failed to update account receivable' }, 500, req);
  }
  return createCorsResponse(toCamel(data), 200, req);
}

async function deleteAR(
  admin: Admin,
  tenantId: string,
  id: string,
  req: Request,
): Promise<Response> {
  const { error } = await admin
    .from('accounts_receivable')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id);

  if (error) {
    return createCorsResponse({ error: 'Failed to delete account receivable' }, 500, req);
  }
  return createCorsResponse({ success: true, message: 'Account receivable deleted' }, 200, req);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// Whitelist incoming camelCase/snake_case keys → snake_case columns
// (shared/schema.ts accountsReceivable). Phantom form fields the page sends
// (referenceNumber, priority) are intentionally absent and thus dropped.
function mapBodyToColumns(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const fields: Array<[string, string]> = [
    ['customerId', 'customer_id'],
    ['invoiceNumber', 'invoice_number'],
    ['contractId', 'contract_id'],
    ['salesOrderNumber', 'sales_order_number'],
    ['invoiceDate', 'invoice_date'],
    ['dueDate', 'due_date'],
    ['description', 'description'],
    ['subtotal', 'subtotal'],
    ['taxAmount', 'tax_amount'],
    ['totalAmount', 'total_amount'],
    ['paidAmount', 'paid_amount'],
    ['balanceAmount', 'balance_amount'],
    ['status', 'status'],
    ['invoiceType', 'invoice_type'],
    ['category', 'category'],
    ['paymentTerms', 'payment_terms'],
    ['paymentMethod', 'payment_method'],
    ['lastPaymentDate', 'last_payment_date'],
    ['followUpDate', 'follow_up_date'],
    ['collectionNotes', 'collection_notes'],
    ['daysOverdue', 'days_overdue'],
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
