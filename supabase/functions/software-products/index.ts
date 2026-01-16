// Software Products Edge Function
// Handles CRUD operations for software products
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

    // GET /software-products - List all software products
    if (req.method === 'GET' && !productId) {
      const { data: products, error } = await admin
        .from('software_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('product_name', { ascending: true });

      if (error) {
        console.error('Error fetching software products:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse({ data: products || [], total: products?.length || 0 }, 200, req);
    }

    // GET /software-products/:id - Get single software product
    if (req.method === 'GET' && productId) {
      const { data: product, error } = await admin
        .from('software_products')
        .select('*')
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching software product:', error);
        return createCorsResponse({ error: error.message }, 404, req);
      }

      return createCorsResponse(product, 200, req);
    }

    // POST /software-products - Create new software product
    if (req.method === 'POST') {
      const body = await req.json();

      const { data: newProduct, error } = await admin
        .from('software_products')
        .insert({
          ...body,
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating software product:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(newProduct, 201, req);
    }

    // PUT /software-products/:id - Update software product
    if (req.method === 'PUT' && productId) {
      const body = await req.json();

      const { data: updatedProduct, error } = await admin
        .from('software_products')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating software product:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(updatedProduct, 200, req);
    }

    // DELETE /software-products/:id - Delete software product
    if (req.method === 'DELETE' && productId) {
      const { error } = await admin
        .from('software_products')
        .delete()
        .eq('id', productId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting software product:', error);
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
