// Parts Inventory Edge Function
// Handles parts/spare parts inventory management
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
    const partId = pathParts[1];
    const subResource = pathParts[2];

    // GET /parts-inventory - List parts
    if (req.method === 'GET' && !partId) {
      const search = url.searchParams.get('search');
      const category = url.searchParams.get('category');
      const lowStock = url.searchParams.get('lowStock');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('parts')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('part_number', { ascending: true })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`part_number.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (category) query = query.eq('category', category);
      if (lowStock === 'true') query = query.lt('quantity_on_hand', admin.raw('reorder_point'));

      const { data: parts, count, error } = await query;

      if (error) {
        console.error('Error fetching parts:', error);
        return createCorsResponse({ error: 'Failed to fetch parts' }, 500, req);
      }

      return createCorsResponse(
        {
          parts: parts || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
        200,
        req,
      );
    }

    // GET /parts-inventory/low-stock - Get low stock parts
    if (req.method === 'GET' && partId === 'low-stock') {
      const { data: parts } = await admin
        .from('parts')
        .select('*')
        .eq('tenant_id', tenantId)
        .lt('quantity_on_hand', admin.raw('reorder_point'))
        .order('quantity_on_hand', { ascending: true });

      return createCorsResponse(parts || [], 200, req);
    }

    // GET /parts-inventory/categories - Get part categories
    if (req.method === 'GET' && partId === 'categories') {
      const { data: parts } = await admin
        .from('parts')
        .select('category')
        .eq('tenant_id', tenantId);

      const categories = [...new Set((parts || []).map((p: any) => p.category).filter(Boolean))];

      return createCorsResponse(categories, 200, req);
    }

    // GET /parts-inventory/:id - Get single part
    if (req.method === 'GET' && partId && !subResource) {
      const { data: part, error } = await admin
        .from('parts')
        .select('*')
        .eq('id', partId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Part not found' }, 404, req);
      }

      // Get transaction history
      const { data: transactions } = await admin
        .from('parts_transactions')
        .select('*')
        .eq('part_id', partId)
        .order('created_at', { ascending: false })
        .limit(50);

      // Get compatible equipment
      const { data: compatible } = await admin
        .from('part_equipment_compatibility')
        .select(
          `
          equipment_model:equipment_model_id (
            id,
            model_name,
            manufacturer
          )
        `,
        )
        .eq('part_id', partId);

      return createCorsResponse(
        {
          ...part,
          transactions: transactions || [],
          compatibleEquipment: compatible || [],
        },
        200,
        req,
      );
    }

    // POST /parts-inventory - Create part
    if (req.method === 'POST' && !partId) {
      const body = await req.json();

      const partData = {
        tenant_id: tenantId,
        part_number: body.partNumber || body.part_number,
        description: body.description,
        category: body.category,
        manufacturer: body.manufacturer,
        manufacturer_part_number: body.manufacturerPartNumber || body.manufacturer_part_number,
        unit_cost: body.unitCost || body.unit_cost || 0,
        list_price: body.listPrice || body.list_price || 0,
        quantity_on_hand: body.quantityOnHand || body.quantity_on_hand || 0,
        quantity_reserved: 0,
        reorder_point: body.reorderPoint || body.reorder_point || 5,
        reorder_quantity: body.reorderQuantity || body.reorder_quantity || 10,
        location: body.location,
        bin_location: body.binLocation || body.bin_location,
        is_serialized: body.isSerialized || body.is_serialized || false,
        is_active: body.isActive !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: part, error } = await admin.from('parts').insert(partData).select().single();

      if (error) {
        console.error('Error creating part:', error);
        return createCorsResponse({ error: 'Failed to create part' }, 500, req);
      }

      return createCorsResponse(part, 201, req);
    }

    // PUT /parts-inventory/:id - Update part
    if (req.method === 'PUT' && partId && !subResource) {
      const body = await req.json();

      const { data: part, error } = await admin
        .from('parts')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', partId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update part' }, 500, req);
      }

      return createCorsResponse(part, 200, req);
    }

    // POST /parts-inventory/:id/adjust - Adjust quantity
    if (req.method === 'POST' && partId && subResource === 'adjust') {
      const body = await req.json();
      const adjustment = body.adjustment || 0;
      const reason = body.reason || 'Manual adjustment';

      const { data: part } = await admin
        .from('parts')
        .select('quantity_on_hand')
        .eq('id', partId)
        .eq('tenant_id', tenantId)
        .single();

      if (!part) {
        return createCorsResponse({ error: 'Part not found' }, 404, req);
      }

      const newQuantity = (part.quantity_on_hand || 0) + adjustment;

      // Update part quantity
      const { data: updatedPart, error } = await admin
        .from('parts')
        .update({
          quantity_on_hand: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', partId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to adjust quantity' }, 500, req);
      }

      // Log transaction
      await admin.from('parts_transactions').insert({
        part_id: partId,
        transaction_type: adjustment > 0 ? 'adjustment_in' : 'adjustment_out',
        quantity: Math.abs(adjustment),
        reason,
        performed_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(updatedPart, 200, req);
    }

    // POST /parts-inventory/:id/transfer - Transfer between locations
    if (req.method === 'POST' && partId && subResource === 'transfer') {
      const body = await req.json();

      const { data: transfer, error } = await admin
        .from('parts_transfers')
        .insert({
          part_id: partId,
          from_location: body.fromLocation || body.from_location,
          to_location: body.toLocation || body.to_location,
          quantity: body.quantity,
          status: 'pending',
          requested_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create transfer' }, 500, req);
      }

      return createCorsResponse(transfer, 201, req);
    }

    // POST /parts-inventory/:id/reserve - Reserve parts for work order
    if (req.method === 'POST' && partId && subResource === 'reserve') {
      const body = await req.json();
      const quantity = body.quantity || 1;

      const { data: part } = await admin
        .from('parts')
        .select('quantity_on_hand, quantity_reserved')
        .eq('id', partId)
        .eq('tenant_id', tenantId)
        .single();

      if (!part) {
        return createCorsResponse({ error: 'Part not found' }, 404, req);
      }

      const available = (part.quantity_on_hand || 0) - (part.quantity_reserved || 0);
      if (available < quantity) {
        return createCorsResponse({ error: 'Insufficient quantity available' }, 400, req);
      }

      const { error } = await admin
        .from('parts')
        .update({
          quantity_reserved: (part.quantity_reserved || 0) + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', partId);

      if (error) {
        return createCorsResponse({ error: 'Failed to reserve parts' }, 500, req);
      }

      // Log reservation
      await admin.from('parts_reservations').insert({
        part_id: partId,
        work_order_id: body.workOrderId || body.work_order_id,
        quantity,
        reserved_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(
        {
          success: true,
          reserved: quantity,
          availableAfter: available - quantity,
        },
        200,
        req,
      );
    }

    // DELETE /parts-inventory/:id - Delete part
    if (req.method === 'DELETE' && partId) {
      const { error } = await admin
        .from('parts')
        .delete()
        .eq('id', partId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete part' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Part deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in parts-inventory function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
