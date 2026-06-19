// Products Edge Function
// Handles product catalog queries with pricing information
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

// Aggregates the four product catalog tables into a single normalized list.
// Each source table contributes a `product_type`, a display `name`/`productName`,
// and a derived `price`. Any table that fails to query degrades to an empty set.
async function aggregateProducts(
  admin: any,
  tenantId: string,
): Promise<{ products: any[]; degraded: boolean }> {
  let degraded = false;

  const { data: enabledProducts, error: enabledError } = await admin
    .from('enabled_products')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true);
  if (enabledError) {
    console.error('Error fetching enabled products:', enabledError);
    degraded = true;
  }

  const { data: productModels, error: modelsError } = await admin
    .from('product_models')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  if (modelsError) {
    console.error('Error fetching product models:', modelsError);
    degraded = true;
  }

  const { data: softwareProducts, error: softwareError } = await admin
    .from('software_products')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  if (softwareError) {
    console.error('Error fetching software products:', softwareError);
    degraded = true;
  }

  const { data: accessories, error: accessoriesError } = await admin
    .from('product_accessories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  if (accessoriesError) {
    console.error('Error fetching accessories:', accessoriesError);
    degraded = true;
  }

  const products = [
    ...(enabledProducts || []).map((p: any) => {
      const name = p.custom_name || 'Unknown Product';
      return {
        ...p,
        product_type: 'enabled_product',
        name,
        productName: name,
        price: p.company_price || p.dealer_cost || 0,
      };
    }),
    ...(productModels || []).map((p: any) => ({
      ...p,
      product_type: 'product_model',
      name: p.product_name,
      productName: p.product_name,
      price: p.new_rep_price || p.upgrade_rep_price || 0,
    })),
    ...(softwareProducts || []).map((p: any) => ({
      ...p,
      product_type: 'software_product',
      name: p.product_name,
      productName: p.product_name,
      price: p.standard_rep_price || p.new_rep_price || 0,
    })),
    ...(accessories || []).map((p: any) => ({
      ...p,
      product_type: 'accessory',
      name: p.accessory_name,
      productName: p.accessory_name,
      price: p.standard_rep_price || p.new_rep_price || 0,
    })),
  ];

  return { products, degraded };
}

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
    // Coolify's server.ts strips the function-name prefix; normalizePath is
    // robust to either calling convention. parts[0] is the first segment.
    const { parts } = normalizePath(url.pathname, 'products');
    const action = parts[0]; // 'with-pricing', 'all', etc.

    // GET /products/with-pricing - Get all products with pricing information
    // (envelope shape: { data, total })
    if (req.method === 'GET' && action === 'with-pricing') {
      const { products } = await aggregateProducts(admin, tenantId);
      return createCorsResponse({ data: products, total: products.length }, 200, req);
    }

    // GET /products/all - Flat array of all products for selection UIs
    // (PricingManagement.tsx maps over response[].id / .productName directly)
    if (req.method === 'GET' && action === 'all') {
      const { products } = await aggregateProducts(admin, tenantId);
      return createCorsResponse(products, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return createCorsResponse({ error: error.message || 'Internal server error' }, 500, req);
  }
}
