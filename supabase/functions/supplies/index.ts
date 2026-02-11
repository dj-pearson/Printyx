// Supplies Edge Function
// Handles supplies and consumables management
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
    const subResource = pathParts[1];

    // GET /supplies - List all supplies
    if (req.method === 'GET' && !supplyId) {
      const category = url.searchParams.get('category');
      const lowStock = url.searchParams.get('lowStock');
      const search = url.searchParams.get('search');

      let query = admin
        .from('supplies')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (category) query = query.eq('category', category);
      if (search) query = query.or(`sku.ilike.%${search}%,note.ilike.%${search}%`);

      const { data: supplies, error } = await query;

      if (error) {
        console.error('Error fetching supplies:', error);
        return createCorsResponse({ error: 'Failed to fetch supplies' }, 500, req);
      }

      let result = supplies || [];

      // Filter low stock if requested
      if (lowStock === 'true') {
        result = result.filter((s: any) => s.quantity <= (s.reorder_level || 10));
      }

      return createCorsResponse(result, 200, req);
    }

    // GET /supplies/low-stock - Get low stock alerts
    if (req.method === 'GET' && supplyId === 'low-stock') {
      const { data: supplies } = await admin.from('supplies').select('*').eq('tenant_id', tenantId);

      const lowStockItems = (supplies || []).filter(
        (s: any) => s.quantity <= (s.reorder_level || 10),
      );

      return createCorsResponse(
        {
          items: lowStockItems,
          count: lowStockItems.length,
        },
        200,
        req,
      );
    }

    // GET /supplies/categories - Get supply categories
    if (req.method === 'GET' && supplyId === 'categories') {
      const { data: supplies } = await admin
        .from('supplies')
        .select('category')
        .eq('tenant_id', tenantId)
        .not('category', 'is', null);

      const categories = [...new Set((supplies || []).map((s: any) => s.category))];
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

      const supplyData = {
        tenant_id: tenantId,
        note: body.name || body.note,
        sku: body.sku,
        description: body.description,
        category: body.category,
        quantity: body.quantity || 0,
        unit: body.unit || 'each',
        unit_cost: body.unitCost || body.unit_cost || 0,
        reorder_level: body.reorderLevel || body.reorder_level || 10,
        supplier_id: body.supplierId || body.supplier_id,
        location: body.location,
        compatible_equipment: body.compatibleEquipment || body.compatible_equipment || [],
        created_by: user.id,
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

    // POST /supplies/:id/adjust - Adjust supply quantity
    if (req.method === 'POST' && supplyId && subResource === 'adjust') {
      const body = await req.json();
      const { adjustment, reason } = body;

      // Get current supply
      const { data: currentSupply } = await admin
        .from('supplies')
        .select('quantity')
        .eq('id', supplyId)
        .eq('tenant_id', tenantId)
        .single();

      if (!currentSupply) {
        return createCorsResponse({ error: 'Supply not found' }, 404, req);
      }

      const newQuantity = (currentSupply.quantity || 0) + adjustment;

      const { data: supply, error } = await admin
        .from('supplies')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplyId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to adjust supply' }, 500, req);
      }

      // Log the adjustment
      await admin.from('supply_adjustments').insert({
        tenant_id: tenantId,
        supply_id: supplyId,
        adjustment,
        previous_quantity: currentSupply.quantity,
        new_quantity: newQuantity,
        reason,
        adjusted_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(supply, 200, req);
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
