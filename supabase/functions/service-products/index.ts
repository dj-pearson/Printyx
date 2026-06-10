// Service Products Edge Function
// Replaces /api/service-products endpoints from server/routes-products-crud.ts
// (lines 878-908) plus the CSV import path from routes-catalog-csv.ts:857.
//
// Frontend usage (6 callsites in client/src):
//   GET    /service-products            — list all service products in tenant
//   POST   /service-products            — create one
//   POST   /service-products/import     — CSV bulk import (multipart upload)
//   PUT    /service-products/:id        — update (added for symmetry with software-products)
//   DELETE /service-products/:id        — delete
//
// Table: service_products (shared/schema.ts:4680). Distinct from `products`
// and `software-products` — service_products has service-specific pricing
// tiers (newActive/newRepPrice, upgradeActive/upgradeRepPrice, etc.) and
// service category metadata.
//
// Multipart import requires the EDGE-002l proxy fix (already landed) so the
// CSV body passes through with its boundary preserved.

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
    const { parts } = normalizePath(url.pathname, 'service-products');
    const first = parts[0]; // ':id' or 'import'

    // POST /service-products/import — multipart CSV (degraded; tracks EDGE-005d-remainder follow-up)
    if (req.method === 'POST' && first === 'import') {
      return await importCsvDegraded(req);
    }

    // GET /service-products
    if (req.method === 'GET' && !first) return await listProducts(admin, tenantId, req, url);

    // POST /service-products
    if (req.method === 'POST' && !first) return await createProduct(admin, tenantId, req);

    // PUT /service-products/:id
    if (req.method === 'PUT' && first) return await updateProduct(admin, tenantId, first, req);

    // DELETE /service-products/:id
    if (req.method === 'DELETE' && first) return await deleteProduct(admin, tenantId, first, req);

    // GET /service-products/:id (single read; useful for edit forms)
    if (req.method === 'GET' && first) return await getProduct(admin, tenantId, first, req);

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in service-products function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ─── handlers ───────────────────────────────────────────────────────────────

async function listProducts(
  admin: Admin,
  tenantId: string,
  req: Request,
  url: URL,
): Promise<Response> {
  // QUOTE-011: opt-in server-side search + pagination (when ?page= is present).
  const params = url.searchParams;
  const search = (params.get('search') || '').trim();
  const category = params.get('category');
  const pageParam = params.get('page');
  const paginate = pageParam !== null;

  let query = admin
    .from('service_products')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('product_name', { ascending: true });

  if (search) {
    const safe = search.replace(/[,()]/g, ' ').trim();
    if (safe)
      query = query.or(
        `product_name.ilike.%${safe}%,product_code.ilike.%${safe}%,description.ilike.%${safe}%`,
      );
  }
  if (category && category !== 'all') query = query.eq('category', category);

  let page = 1;
  let limit = 50;
  if (paginate) {
    page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
    limit = Math.min(Math.max(1, parseInt(params.get('limit') || '50', 10) || 50), 200);
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('Error fetching service products:', error);
    return createCorsResponse({ error: 'Failed to fetch service products' }, 500, req);
  }
  if (paginate) {
    return createCorsResponse(
      { data: data ?? [], pagination: { page, limit, total: count ?? 0 } },
      200,
      req,
    );
  }
  return createCorsResponse(data ?? [], 200, req);
}

async function getProduct(
  admin: Admin,
  tenantId: string,
  id: string,
  req: Request,
): Promise<Response> {
  const { data, error } = await admin
    .from('service_products')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return createCorsResponse({ error: 'Service product not found' }, 404, req);
  }
  return createCorsResponse(data, 200, req);
}

async function createProduct(admin: Admin, tenantId: string, req: Request): Promise<Response> {
  const body = await req.json();

  if (!body.productCode && !body.product_code) {
    return createCorsResponse({ error: 'productCode is required' }, 400, req);
  }
  if (!body.productName && !body.product_name) {
    return createCorsResponse({ error: 'productName is required' }, 400, req);
  }

  const insertRow = {
    tenant_id: tenantId,
    ...mapBodyToColumns(body),
  };

  const { data, error } = await admin.from('service_products').insert(insertRow).select().single();

  if (error) {
    console.error('Error creating service product:', error);
    return createCorsResponse({ error: 'Failed to create service product' }, 500, req);
  }
  return createCorsResponse(data, 201, req);
}

async function updateProduct(
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
    .from('service_products')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return createCorsResponse({ error: 'Failed to update service product' }, 500, req);
  }
  return createCorsResponse(data, 200, req);
}

async function deleteProduct(
  admin: Admin,
  tenantId: string,
  id: string,
  req: Request,
): Promise<Response> {
  const { error } = await admin
    .from('service_products')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id);

  if (error) {
    return createCorsResponse({ error: 'Failed to delete service product' }, 500, req);
  }
  return createCorsResponse({ success: true, message: 'Service product deleted' }, 200, req);
}

function importCsvDegraded(req: Request): Response {
  // CSV import requires the existing csv-import-service heavy machinery
  // (column mapping, validation, dedup detection) which lives in
  // server/services/csv-import-service.ts and depends on Drizzle + busboy +
  // duplicate detection logic. Port is sizable; flagged degraded so the
  // import button reports a meaningful error instead of silent failure.
  return createCorsResponse(
    {
      error: 'CSV import not yet ported to edge function',
      degraded: {
        csvImport: true,
        reason:
          'csv-import-service requires Drizzle aggregations + dedup heuristics that need a separate port. Tracked in EDGE-005d-remainder follow-up.',
      },
    },
    503,
    req,
  );
}

// Maps the snake_case + camelCase keys the frontend sends to snake_case
// DB columns. Mirrors the field set in shared/schema.ts:4680.
function mapBodyToColumns(body: any): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  const fields: Array<[string, string]> = [
    ['productCode', 'product_code'],
    ['productName', 'product_name'],
    ['category', 'category'],
    ['serviceType', 'service_type'],
    ['pricingLevel', 'pricing_level'],
    ['description', 'description'],
    ['summary', 'summary'],
    ['note', 'note'],
    ['eaNotes', 'ea_notes'],
    ['relatedProducts', 'related_products'],
    ['isActive', 'is_active'],
    ['availableForAll', 'available_for_all'],
    ['repostEdit', 'repost_edit'],
    ['salesRepCredit', 'sales_rep_credit'],
    ['funding', 'funding'],
    ['lease', 'lease'],
    ['paymentType', 'payment_type'],
    ['newActive', 'new_active'],
    ['newRepPrice', 'new_rep_price'],
    ['upgradeActive', 'upgrade_active'],
    ['upgradeRepPrice', 'upgrade_rep_price'],
    ['lexmarkActive', 'lexmark_active'],
    ['lexmarkRepPrice', 'lexmark_rep_price'],
    ['graphicActive', 'graphic_active'],
  ];
  for (const [camel, snake] of fields) {
    if (body[camel] !== undefined) map[snake] = body[camel];
    else if (body[snake] !== undefined) map[snake] = body[snake];
  }
  return map;
}
