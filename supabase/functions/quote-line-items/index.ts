// Quote Line Items Edge Function
// Handles quote line items
//
// ⚠️ DEPRECATED (QUOTE-001): Canonical line items live in `proposal_line_items`
// via supabase/functions/proposals/. The UI does NOT call this function. See
// docs/quote-module-architecture.md.
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
    // /quote-line-items, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'quote-line-items');
    const quoteId = parts[0]; // quotes/:quoteId/line-items

    // GET /quotes/:quoteId/line-items - Get quote line items
    //
    // AUDIT-037. Three things were wrong here and one of them was a tenant leak.
    //
    // quote_line_items is a MINIMAL table - quote_id, description, quantity,
    // unit_price, total_price - with no product_id, no discount_percent and no
    // line_number. So the `product:product_id (…)` embed named a foreign key
    // that does not exist and the order named a missing column, and PostgREST
    // failed the whole read. (The rich line-item model with discounts and line
    // numbers is proposal_line_items, a different table behind the quote
    // builder - see QUOTE-016 and QUOTE-020.)
    //
    // THE LEAK: this filtered on quote_id ALONE, with no tenant_id, so any
    // authenticated user who knew or guessed a quote id could read another
    // tenant's line items - prices included. It only ever returned an error
    // because of the embed above, which is not a control.
    if (req.method === 'GET' && quoteId) {
      const { data: lineItems, error } = await admin
        .from('quote_line_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch quote line items' }, 500, req);
      }

      return createCorsResponse(lineItems || [], 200, req);
    }

    // POST /quotes/:quoteId/line-items - Add line item
    if (req.method === 'POST' && quoteId) {
      const body = await req.json();

      // tenant_id and total_price are NOT NULL and neither was set, so this
      // insert could not have worked even without the three phantom columns.
      const description = body.description;
      const quantity = Number(body.quantity ?? 1);
      const unitPrice = Number(body.unitPrice ?? body.unit_price);
      if (!description || !Number.isFinite(unitPrice)) {
        return createCorsResponse(
          {
            error: 'description and unitPrice are required',
            missing: ['description', 'unitPrice'],
          },
          400,
          req,
        );
      }

      const { data: lineItem, error } = await admin
        .from('quote_line_items')
        .insert({
          tenant_id: tenantId,
          quote_id: quoteId,
          description,
          quantity,
          unit_price: unitPrice,
          total_price: Number((quantity * unitPrice).toFixed(2)),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add line item' }, 500, req);
      }

      // productId, discountPercent and lineNumber have no columns here. The
      // model that carries them is proposal_line_items; adding them to this
      // table would give the quote two line-item shapes.
      const ignored = ['productId', 'discountPercent', 'lineNumber'].filter(
        (k) => body[k] !== undefined,
      );

      return createCorsResponse(
        ignored.length > 0
          ? {
              ...(lineItem as Record<string, unknown>),
              unpersisted: ignored.map(
                (k) => `${k}: quote_line_items has no such column - see proposal_line_items`,
              ),
            }
          : lineItem,
        201,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in quote-line-items function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
