// Enabled Products Edge Function
// Handles CRUD operations for enabled products (tenant-specific product catalog)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID from JWT metadata
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const productId = pathParts[1]; // Get ID from path if present

    // GET /enabled-products - List all enabled products for this tenant
    if (req.method === 'GET' && !productId) {
      const { data: products, error } = await admin
        .from('enabled_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('custom_name', { ascending: true });

      if (error) {
        console.error('Error fetching enabled products:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse({ data: products || [], total: products?.length || 0 }, 200, req);
    }

    // GET /enabled-products/:id - Get single enabled product
    if (req.method === 'GET' && productId) {
      const { data: product, error } = await admin
        .from('enabled_products')
        .select('*')
        .eq('enabled_product_id', productId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching enabled product:', error);
        return createCorsResponse({ error: error.message }, 404, req);
      }

      return createCorsResponse(product, 200, req);
    }

    // POST /enabled-products - Enable a product for this tenant
    if (req.method === 'POST') {
      const body = await req.json();

      // Map camelCase fields to snake_case for database
      const dbData: Record<string, any> = {
        tenant_id: tenantId,
        master_product_id: body.masterProductId || null,
        source: body.source || 'master_catalog',
        enabled: body.enabled !== undefined ? body.enabled : true,
        custom_sku: body.customSku || null,
        custom_name: body.customName || null,
        dealer_cost: body.dealerCost || null,
        company_price: body.companyPrice || null,
        markup_rule_id: body.markupRuleId || null,
        price_overridden: body.priceOverridden !== undefined ? body.priceOverridden : false,
        enabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newProduct, error } = await admin
        .from('enabled_products')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        console.error('Error enabling product:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(newProduct, 201, req);
    }

    // PUT /enabled-products/:id - Update enabled product settings
    if (req.method === 'PUT' && productId) {
      const body = await req.json();

      // Map camelCase fields to snake_case for database
      const dbData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Only include fields that are present in the request
      if (body.masterProductId !== undefined) dbData.master_product_id = body.masterProductId;
      if (body.source !== undefined) dbData.source = body.source;
      if (body.enabled !== undefined) dbData.enabled = body.enabled;
      if (body.customSku !== undefined) dbData.custom_sku = body.customSku;
      if (body.customName !== undefined) dbData.custom_name = body.customName;
      if (body.dealerCost !== undefined) dbData.dealer_cost = body.dealerCost;
      if (body.companyPrice !== undefined) dbData.company_price = body.companyPrice;
      if (body.markupRuleId !== undefined) dbData.markup_rule_id = body.markupRuleId;
      if (body.priceOverridden !== undefined) dbData.price_overridden = body.priceOverridden;

      const { data: updatedProduct, error } = await admin
        .from('enabled_products')
        .update(dbData)
        .eq('enabled_product_id', productId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating enabled product:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(updatedProduct, 200, req);
    }

    // DELETE /enabled-products/:id - Disable product for this tenant
    if (req.method === 'DELETE' && productId) {
      const { error } = await admin
        .from('enabled_products')
        .delete()
        .eq('enabled_product_id', productId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error disabling product:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse({ success: true }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return createCorsResponse({ error: error.message || 'Internal server error' }, 500, req);
  }
}
