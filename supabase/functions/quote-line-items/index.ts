// Quote Line Items Edge Function
// Handles quote line items
//
// ⚠️ DEPRECATED (QUOTE-001): Canonical line items live in `proposal_line_items`
// via supabase/functions/proposals/. The UI does NOT call this function. See
// docs/quote-module-architecture.md.
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
    const quoteId = pathParts[1]; // quotes/:quoteId/line-items

    // GET /quotes/:quoteId/line-items - Get quote line items
    if (req.method === 'GET' && quoteId) {
      const { data: lineItems, error } = await admin
        .from('quote_line_items')
        .select(
          `
          *,
          product:product_id (id, name, sku)
        `,
        )
        .eq('quote_id', quoteId)
        .order('line_number', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch quote line items' }, 500, req);
      }

      return createCorsResponse(lineItems || [], 200, req);
    }

    // POST /quotes/:quoteId/line-items - Add line item
    if (req.method === 'POST' && quoteId) {
      const body = await req.json();

      const { data: lineItem, error } = await admin
        .from('quote_line_items')
        .insert({
          quote_id: quoteId,
          product_id: body.productId || body.product_id,
          description: body.description,
          quantity: body.quantity || 1,
          unit_price: body.unitPrice || body.unit_price,
          discount_percent: body.discountPercent || body.discount_percent || 0,
          line_number: body.lineNumber || body.line_number,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add line item' }, 500, req);
      }

      return createCorsResponse(lineItem, 201, req);
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
