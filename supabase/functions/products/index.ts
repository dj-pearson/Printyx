// Products Edge Function
// Handles product catalog queries with pricing information
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
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[1]; // 'with-pricing', etc.

    // GET /products/with-pricing - Get all products with pricing information
    if (req.method === 'GET' && action === 'with-pricing') {
      // First get enabled products
      const { data: enabledProducts, error: enabledError } = await admin
        .from('enabled_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('enabled', true);

      if (enabledError) {
        console.error('Error fetching enabled products:', enabledError);
        return createCorsResponse({ error: enabledError.message }, 500, req);
      }

      // Get product models
      const { data: productModels, error: modelsError } = await admin
        .from('product_models')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (modelsError) {
        console.error('Error fetching product models:', modelsError);
        return createCorsResponse({ error: modelsError.message }, 500, req);
      }

      // Get software products
      const { data: softwareProducts, error: softwareError } = await admin
        .from('software_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (softwareError) {
        console.error('Error fetching software products:', softwareError);
        return createCorsResponse({ error: softwareError.message }, 500, req);
      }

      // Get product accessories
      const { data: accessories, error: accessoriesError } = await admin
        .from('product_accessories')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (accessoriesError) {
        console.error('Error fetching accessories:', accessoriesError);
        return createCorsResponse({ error: accessoriesError.message }, 500, req);
      }

      // Combine all products with their pricing
      const allProducts = [
        ...(enabledProducts || []).map((p: any) => ({
          ...p,
          product_type: 'enabled_product',
          name: p.custom_name || 'Unknown Product',
          price: p.company_price || p.dealer_cost || 0,
        })),
        ...(productModels || []).map((p: any) => ({
          ...p,
          product_type: 'product_model',
          name: p.product_name,
          price: p.new_rep_price || p.upgrade_rep_price || 0,
        })),
        ...(softwareProducts || []).map((p: any) => ({
          ...p,
          product_type: 'software_product',
          name: p.product_name,
          price: p.standard_rep_price || p.new_rep_price || 0,
        })),
        ...(accessories || []).map((p: any) => ({
          ...p,
          product_type: 'accessory',
          name: p.accessory_name,
          price: p.standard_rep_price || p.new_rep_price || 0,
        })),
      ];

      return createCorsResponse({ data: allProducts, total: allProducts.length }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return createCorsResponse({ error: error.message || 'Internal server error' }, 500, req);
  }
}
