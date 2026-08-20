// Supplies Edge Function
// Handles supplies and consumables management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { importCatalogCsv, readUploadedCsv } from '../_shared/catalog-import-runner.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID
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
    // Server strips function name, so /supplies/:id becomes /:id
    const supplyId = pathParts[0];

    // ====================================================================
    // POST /supplies/import - bulk CSV import
    //
    // PROD-014: this existed only on Express, so catalog import 404'd in
    // production. The spec, the CSV parser and the row validation are shared
    // with the client and Express, so the same file imports identically on
    // either backend. It must precede the generic POST create branch, or the
    // upload is treated as a single product. Reads the path segment directly
    // rather than the id variable below, which is declared after this point —
    // naming it here is a temporal-dead-zone ReferenceError at runtime that no
    // bundler flags.
    // ====================================================================
    if (req.method === 'POST' && pathParts[0] === 'import') {
      const csvText = await readUploadedCsv(req);
      if (!csvText) {
        return createCorsResponse({ message: 'No file uploaded' }, 400, req);
      }
      const outcome = await importCatalogCsv(admin, 'supplies', tenantId, csvText);
      return createCorsResponse(outcome, 200, req);
    }
    const subResource = pathParts[1];

    // GET /supplies - List all supplies
    if (req.method === 'GET' && !supplyId) {
      const category = url.searchParams.get('category');
      const lowStock = url.searchParams.get('lowStock');
      const search = url.searchParams.get('search');

      // QUOTE-011: opt-in server-side pagination (when ?page= present). lowStock is
      // an in-memory post-filter, so we skip server pagination when it's requested.
      const pageParam = url.searchParams.get('page');
      const paginate = pageParam !== null && lowStock !== 'true';

      let query = admin
        .from('supplies')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // `supplies` is the price book: the kind is product_type and the code is
      // product_code. There is no category and no sku, so both of these were
      // 42703s — the category filter and every search took the list down.
      if (category) query = query.eq('product_type', category);
      if (search) {
        const safe = search.replace(/[,()]/g, ' ').trim();
        if (safe) {
          query = query.or(
            `product_code.ilike.%${safe}%,product_name.ilike.%${safe}%,note.ilike.%${safe}%`,
          );
        }
      }

      let page = 1;
      let limit = 50;
      if (paginate) {
        page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
        limit = Math.min(
          Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50),
          200,
        );
        const from = (page - 1) * limit;
        query = query.range(from, from + limit - 1);
      }

      const { data: supplies, error, count } = await query;

      if (error) {
        console.error('Error fetching supplies:', error);
        return createCorsResponse({ error: 'Failed to fetch supplies' }, 500, req);
      }

      let result = supplies || [];

      // ?lowStock=true is not answerable from this table: `supplies` is a price
      // book with free-TEXT inventory / in_stock and no quantity or
      // reorder_level. The old filter compared undefined <= 10, so it silently
      // returned an empty list rather than erroring. Left unfiltered instead of
      // pretending; see the /low-stock branch for the same reason stated to the
      // caller.
      if (lowStock === 'true') {
        return createCorsResponse(
          {
            error: 'Low-stock filtering is not available for supplies',
            code: 'SUPPLIES_HAS_NO_STOCK_COUNTS',
            details:
              'supplies is a price-book table: inventory and in_stock are free text, and there ' +
              'is no quantity or reorder_level column to compare.',
          },
          501,
          req,
        );
      }

      if (paginate) {
        return createCorsResponse(
          { data: result, pagination: { page, limit, total: count ?? 0 } },
          200,
          req,
        );
      }
      return createCorsResponse(result, 200, req);
    }

    // GET /supplies/low-stock - not answerable from this table.
    //
    // Returned { items: [], count: 0 } forever: it compared s.quantity, which is
    // not a column, against a reorder_level that is not one either. An empty
    // alert list reads as "nothing is low", which is worse than an error.
    if (req.method === 'GET' && supplyId === 'low-stock') {
      return createCorsResponse(
        {
          error: 'Low-stock alerts are not available for supplies',
          code: 'SUPPLIES_HAS_NO_STOCK_COUNTS',
          details:
            'supplies is a price-book table (product_code, product_name, product_type, pricing ' +
            'tiers). inventory and in_stock are free text, and there is no quantity or ' +
            'reorder_level column. Counted stock belongs in an inventory table.',
        },
        501,
        req,
      );
    }

    // GET /supplies/categories - Get supply categories
    if (req.method === 'GET' && supplyId === 'categories') {
      const { data: supplies } = await admin
        .from('supplies')
        .select('product_type')
        .eq('tenant_id', tenantId)
        .not('product_type', 'is', null);

      const categories = [...new Set((supplies || []).map((s: any) => s.product_type))];
      return createCorsResponse(categories, 200, req);
    }

    // GET /supplies/:id - Get single supply
    if (req.method === 'GET' && supplyId && !subResource) {
      const { data: supply, error } = await admin
        .from('supplies')
        .select('*')
        .eq('id', supplyId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Supply not found' }, 404, req);
      }

      return createCorsResponse(supply, 200, req);
    }

    // POST /supplies - Create new supply
    if (req.method === 'POST' && !supplyId) {
      const body = await req.json();

      // This payload used to describe a warehouse item — sku, category, quantity,
      // unit, unit_cost, reorder_level, supplier_id, location,
      // compatible_equipment, created_by — and NONE of those are columns, so
      // every create 42703'd. `supplies` is the price book, and Supplies.tsx
      // already posts exactly that shape (productCode/productName/productType/
      // inventory/summary/...), so this now maps what the page actually sends.
      const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
      const supplyData = {
        tenant_id: tenantId,
        product_code: body.productCode || body.product_code || body.sku,
        product_name: body.productName || body.product_name || body.name,
        product_type: body.productType || body.product_type || body.category || 'Supplies',
        dealer_comp: body.dealerComp ?? body.dealer_comp ?? null,
        // inventory and in_stock are free-text on this table, not counts.
        inventory: body.inventory ?? null,
        in_stock: body.inStock ?? body.in_stock ?? null,
        summary: body.summary ?? body.description ?? null,
        note: body.note ?? null,
        ea_notes: body.eaNotes ?? body.ea_notes ?? null,
        related_products: body.relatedProducts ?? body.related_products ?? null,
        is_active: bool(body.isActive ?? body.is_active, true),
        available_for_all: bool(body.availableForAll ?? body.available_for_all, false),
        repost_edit: bool(body.repostEdit ?? body.repost_edit, false),
        sales_rep_credit: bool(body.salesRepCredit ?? body.sales_rep_credit, true),
        funding: bool(body.funding, true),
        lease: bool(body.lease, false),
        payment_type: body.paymentType ?? body.payment_type ?? null,
        new_active: bool(body.newActive ?? body.new_active, false),
        new_rep_price: body.newRepPrice ?? body.new_rep_price ?? null,
        upgrade_active: bool(body.upgradeActive ?? body.upgrade_active, false),
        upgrade_rep_price: body.upgradeRepPrice ?? body.upgrade_rep_price ?? null,
        lexmark_active: bool(body.lexmarkActive ?? body.lexmark_active, false),
        lexmark_rep_price: body.lexmarkRepPrice ?? body.lexmark_rep_price ?? null,
        graphic_active: bool(body.graphicActive ?? body.graphic_active, false),
        graphic_rep_price: body.graphicRepPrice ?? body.graphic_rep_price ?? null,
        price_book_id: body.priceBookId ?? body.price_book_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: supply, error } = await admin
        .from('supplies')
        .insert(supplyData)
        .select()
        .single();

      if (error) {
        console.error('Error creating supply:', error);
        return createCorsResponse({ error: 'Failed to create supply' }, 500, req);
      }

      return createCorsResponse(supply, 201, req);
    }

    // PUT /supplies/:id - Update supply
    if (req.method === 'PUT' && supplyId && !subResource) {
      const body = await req.json();

      const { data: supply, error } = await admin
        .from('supplies')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplyId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating supply:', error);
        return createCorsResponse({ error: 'Failed to update supply' }, 500, req);
      }

      return createCorsResponse(supply, 200, req);
    }

    // POST /supplies/:id/adjust - not answerable from this table.
    //
    // It read and wrote `quantity` (not a column) and logged to
    // supply_adjustments, which is in no Drizzle schema or migration. Both the
    // read and the write were 42703s, so no adjustment ever applied.
    if (req.method === 'POST' && supplyId && subResource === 'adjust') {
      return createCorsResponse(
        {
          error: 'Stock adjustment is not available for supplies',
          code: 'SUPPLIES_HAS_NO_STOCK_COUNTS',
          details:
            'supplies has no quantity column to adjust, and supply_adjustments exists in no ' +
            'schema or migration. Counted stock and its audit trail need real tables first.',
        },
        501,
        req,
      );
    }

    // DELETE /supplies/:id - Delete supply
    if (req.method === 'DELETE' && supplyId) {
      const { error } = await admin
        .from('supplies')
        .delete()
        .eq('id', supplyId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete supply' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Supply deleted' }, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in supplies function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
