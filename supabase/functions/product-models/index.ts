// Product Models Edge Function
// Handles CRUD operations for copier/printer equipment models
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
    const modelId = pathParts[1]; // Get ID from path if present

    // GET /product-models - List all product models
    if (req.method === 'GET' && !modelId) {
      const { data: models, error } = await admin
        .from('product_models')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('product_name', { ascending: true });

      if (error) {
        console.error('Error fetching product models:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse({ data: models || [], total: models?.length || 0 }, 200, req);
    }

    // GET /product-models/:id - Get single product model
    if (req.method === 'GET' && modelId) {
      const { data: model, error } = await admin
        .from('product_models')
        .select('*')
        .eq('id', modelId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching product model:', error);
        return createCorsResponse({ error: error.message }, 404, req);
      }

      return createCorsResponse(model, 200, req);
    }

    // POST /product-models - Create new product model
    if (req.method === 'POST') {
      const body = await req.json();

      const { data: newModel, error } = await admin
        .from('product_models')
        .insert({
          ...body,
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating product model:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(newModel, 201, req);
    }

    // PUT /product-models/:id - Update product model
    if (req.method === 'PUT' && modelId) {
      const body = await req.json();

      const { data: updatedModel, error } = await admin
        .from('product_models')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', modelId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating product model:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(updatedModel, 200, req);
    }

    // DELETE /product-models/:id - Delete product model
    if (req.method === 'DELETE' && modelId) {
      const { error } = await admin
        .from('product_models')
        .delete()
        .eq('id', modelId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting product model:', error);
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
