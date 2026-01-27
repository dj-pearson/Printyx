// Sales Territories Edge Function
// Handles sales territory management and lead assignment rules
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
    const territoryId = pathParts[1];

    // GET /sales-territories - List territories
    if (req.method === 'GET' && !territoryId) {
      const { data: territories, error } = await admin
        .from('sales_territories')
        .select(
          `
          *,
          assigned_rep:assigned_rep_id (id, full_name, email)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching territories:', error);
        return createCorsResponse({ error: 'Failed to fetch territories' }, 500, req);
      }

      return createCorsResponse(territories || [], 200, req);
    }

    // GET /sales-territories/:id - Get single territory
    if (req.method === 'GET' && territoryId) {
      const { data: territory, error } = await admin
        .from('sales_territories')
        .select(
          `
          *,
          assigned_rep:assigned_rep_id (id, full_name, email)
        `,
        )
        .eq('id', territoryId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Territory not found' }, 404, req);
      }

      return createCorsResponse(territory, 200, req);
    }

    // POST /sales-territories - Create territory
    if (req.method === 'POST' && !territoryId) {
      const body = await req.json();

      const territoryData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        region: body.region,
        states: body.states || [],
        zip_codes: body.zipCodes || body.zip_codes || [],
        assigned_rep_id: body.assignedRepId || body.assigned_rep_id,
        is_active: body.isActive !== false,
        rules: body.rules || {},
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: territory, error } = await admin
        .from('sales_territories')
        .insert(territoryData)
        .select()
        .single();

      if (error) {
        console.error('Error creating territory:', error);
        return createCorsResponse({ error: 'Failed to create territory' }, 500, req);
      }

      return createCorsResponse(territory, 201, req);
    }

    // PUT /sales-territories/:id - Update territory
    if (req.method === 'PUT' && territoryId) {
      const body = await req.json();

      const { data: territory, error } = await admin
        .from('sales_territories')
        .update({
          name: body.name,
          description: body.description,
          region: body.region,
          states: body.states,
          zip_codes: body.zipCodes || body.zip_codes,
          assigned_rep_id: body.assignedRepId || body.assigned_rep_id,
          is_active: body.isActive ?? body.is_active,
          rules: body.rules,
          updated_at: new Date().toISOString(),
        })
        .eq('id', territoryId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update territory' }, 500, req);
      }

      return createCorsResponse(territory, 200, req);
    }

    // DELETE /sales-territories/:id - Delete territory
    if (req.method === 'DELETE' && territoryId) {
      const { error } = await admin
        .from('sales_territories')
        .delete()
        .eq('id', territoryId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete territory' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Territory deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in sales-territories function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
