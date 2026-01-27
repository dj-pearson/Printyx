// Inventory Edge Function
// Handles inventory item management and stock tracking
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
    const itemId = pathParts[1];
    const action = pathParts[2]; // 'adjust', 'reserve', 'release', etc.

    // GET /inventory - List all inventory items with filters
    if (req.method === 'GET' && !itemId) {
      const category = url.searchParams.get('category');
      const manufacturer = url.searchParams.get('manufacturer');
      const search = url.searchParams.get('search');
      const lowStock = url.searchParams.get('lowStock') || url.searchParams.get('low_stock');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = (page - 1) * limit;

      let query = admin
        .from('inventory_items')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (category) {
        query = query.eq('item_category', category);
      }

      if (manufacturer) {
        query = query.eq('manufacturer', manufacturer);
      }

      if (lowStock === 'true') {
        // Items where quantity available is at or below reorder point
        query = query.or('quantity_available.lte.reorder_point,quantity_on_hand.lte.reorder_point');
      }

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,part_number.ilike.%${search}%,manufacturer_part_number.ilike.%${search}%,item_description.ilike.%${search}%`,
        );
      }

      const { data: items, error, count } = await query;

      if (error) {
        console.error('Error fetching inventory items:', error);
        return createCorsResponse({ error: 'Failed to fetch inventory items' }, 500, req);
      }

      return createCorsResponse(
        {
          data: items || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /inventory/:id - Get single inventory item
    if (req.method === 'GET' && itemId && !action) {
      const { data: item, error } = await admin
        .from('inventory_items')
        .select('*')
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching inventory item:', error);
        return createCorsResponse({ error: 'Inventory item not found' }, 404, req);
      }

      return createCorsResponse(item, 200, req);
    }

    // POST /inventory/:id/adjust - Adjust inventory quantity
    if (req.method === 'POST' && itemId && action === 'adjust') {
      const body = await req.json();
      const { quantity, reason, notes } = body;

      if (quantity === undefined || quantity === null) {
        return createCorsResponse({ error: 'quantity is required' }, 400, req);
      }

      // Get current inventory item
      const { data: item } = await admin
        .from('inventory_items')
        .select('quantity_on_hand, quantity_available')
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .single();

      if (!item) {
        return createCorsResponse({ error: 'Inventory item not found' }, 404, req);
      }

      // Calculate new quantities
      const newOnHand = (item.quantity_on_hand || 0) + quantity;
      const newAvailable = (item.quantity_available || 0) + quantity;

      // Update inventory
      const { data: updated, error } = await admin
        .from('inventory_items')
        .update({
          quantity_on_hand: newOnHand,
          quantity_available: newAvailable,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error adjusting inventory:', error);
        return createCorsResponse({ error: 'Failed to adjust inventory' }, 500, req);
      }

      // TODO: Log the adjustment to an inventory_transactions table if it exists
      // This would track: user, timestamp, old quantity, new quantity, reason, notes

      return createCorsResponse(
        {
          ...updated,
          adjustment: {
            quantity,
            reason,
            notes,
            adjusted_by: user.id,
            adjusted_at: new Date().toISOString(),
          },
        },
        200,
        req,
      );
    }

    // POST /inventory/:id/reserve - Reserve inventory (commit quantity)
    if (req.method === 'POST' && itemId && action === 'reserve') {
      const body = await req.json();
      const { quantity, reference } = body;

      if (!quantity || quantity <= 0) {
        return createCorsResponse({ error: 'Valid quantity is required' }, 400, req);
      }

      // Get current inventory item
      const { data: item } = await admin
        .from('inventory_items')
        .select('quantity_available, quantity_committed')
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .single();

      if (!item) {
        return createCorsResponse({ error: 'Inventory item not found' }, 404, req);
      }

      if ((item.quantity_available || 0) < quantity) {
        return createCorsResponse(
          {
            error: 'Insufficient inventory',
            available: item.quantity_available,
            requested: quantity,
          },
          400,
          req,
        );
      }

      // Reserve inventory (move from available to committed)
      const newAvailable = (item.quantity_available || 0) - quantity;
      const newCommitted = (item.quantity_committed || 0) + quantity;

      const { data: updated, error } = await admin
        .from('inventory_items')
        .update({
          quantity_available: newAvailable,
          quantity_committed: newCommitted,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error reserving inventory:', error);
        return createCorsResponse({ error: 'Failed to reserve inventory' }, 500, req);
      }

      return createCorsResponse(
        {
          ...updated,
          reservation: {
            quantity,
            reference,
            reserved_by: user.id,
            reserved_at: new Date().toISOString(),
          },
        },
        200,
        req,
      );
    }

    // POST /inventory/:id/release - Release reserved inventory
    if (req.method === 'POST' && itemId && action === 'release') {
      const body = await req.json();
      const { quantity } = body;

      if (!quantity || quantity <= 0) {
        return createCorsResponse({ error: 'Valid quantity is required' }, 400, req);
      }

      // Get current inventory item
      const { data: item } = await admin
        .from('inventory_items')
        .select('quantity_available, quantity_committed, quantity_on_hand')
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .single();

      if (!item) {
        return createCorsResponse({ error: 'Inventory item not found' }, 404, req);
      }

      if ((item.quantity_committed || 0) < quantity) {
        return createCorsResponse(
          {
            error: 'Insufficient committed inventory',
            committed: item.quantity_committed,
            requested: quantity,
          },
          400,
          req,
        );
      }

      // Release inventory (move from committed back to available or remove from on_hand)
      const action_type = body.action || 'return'; // 'return' or 'consume'

      let updateData: Record<string, any> = {
        quantity_committed: (item.quantity_committed || 0) - quantity,
        updated_at: new Date().toISOString(),
      };

      if (action_type === 'return') {
        // Return to available
        updateData.quantity_available = (item.quantity_available || 0) + quantity;
      } else if (action_type === 'consume') {
        // Consume (reduce on_hand)
        updateData.quantity_on_hand = (item.quantity_on_hand || 0) - quantity;
      }

      const { data: updated, error } = await admin
        .from('inventory_items')
        .update(updateData)
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error releasing inventory:', error);
        return createCorsResponse({ error: 'Failed to release inventory' }, 500, req);
      }

      return createCorsResponse(updated, 200, req);
    }

    // POST /inventory - Create new inventory item
    if (req.method === 'POST' && !itemId) {
      const body = await req.json();

      const itemData = {
        tenant_id: tenantId,
        name: body.name,
        category: body.category || 'Parts',
        external_item_id: body.externalItemId || body.external_item_id || null,
        part_number: body.partNumber || body.part_number,
        manufacturer_part_number:
          body.manufacturerPartNumber || body.manufacturer_part_number || null,
        item_description: body.itemDescription || body.item_description || body.description || null,
        item_category: body.itemCategory || body.item_category || body.category,
        manufacturer: body.manufacturer || null,
        quantity_on_hand:
          body.quantityOnHand !== undefined
            ? body.quantityOnHand
            : body.quantity_on_hand !== undefined
              ? body.quantity_on_hand
              : 0,
        quantity_committed: 0,
        quantity_available:
          body.quantityOnHand !== undefined
            ? body.quantityOnHand
            : body.quantity_on_hand !== undefined
              ? body.quantity_on_hand
              : 0,
        quantity_on_order: body.quantityOnOrder || body.quantity_on_order || 0,
        reorder_point: body.reorderPoint || body.reorder_point || 0,
        reorder_quantity: body.reorderQuantity || body.reorder_quantity || 0,
        max_stock_level: body.maxStockLevel || body.max_stock_level || null,
        unit_cost: body.unitCost || body.unit_cost || null,
        average_cost: body.averageCost || body.average_cost || null,
        last_cost: body.lastCost || body.last_cost || null,
        unit_price: body.unitPrice || body.unit_price || null,
        retail_price: body.retailPrice || body.retail_price || null,
        warehouse_location: body.warehouseLocation || body.warehouse_location || null,
        bin_location: body.binLocation || body.bin_location || null,
        is_serialized:
          body.isSerialized !== undefined
            ? body.isSerialized
            : body.is_serialized !== undefined
              ? body.is_serialized
              : false,
        is_lot_tracked:
          body.isLotTracked !== undefined
            ? body.isLotTracked
            : body.is_lot_tracked !== undefined
              ? body.is_lot_tracked
              : false,
        is_active:
          body.isActive !== undefined
            ? body.isActive
            : body.is_active !== undefined
              ? body.is_active
              : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: item, error } = await admin
        .from('inventory_items')
        .insert(itemData)
        .select()
        .single();

      if (error) {
        console.error('Error creating inventory item:', error);
        return createCorsResponse(
          { error: 'Failed to create inventory item', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(item, 201, req);
    }

    // PATCH /inventory/:id - Update inventory item
    if ((req.method === 'PATCH' || req.method === 'PUT') && itemId && !action) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map all updatable fields
      const fieldMap: Record<string, string> = {
        name: 'name',
        category: 'category',
        partNumber: 'part_number',
        manufacturerPartNumber: 'manufacturer_part_number',
        itemDescription: 'item_description',
        itemCategory: 'item_category',
        manufacturer: 'manufacturer',
        reorderPoint: 'reorder_point',
        reorderQuantity: 'reorder_quantity',
        maxStockLevel: 'max_stock_level',
        unitCost: 'unit_cost',
        averageCost: 'average_cost',
        lastCost: 'last_cost',
        unitPrice: 'unit_price',
        retailPrice: 'retail_price',
        warehouseLocation: 'warehouse_location',
        binLocation: 'bin_location',
        isSerialized: 'is_serialized',
        isLotTracked: 'is_lot_tracked',
        isActive: 'is_active',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: item, error } = await admin
        .from('inventory_items')
        .update(updateData)
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating inventory item:', error);
        return createCorsResponse({ error: 'Failed to update inventory item' }, 500, req);
      }

      return createCorsResponse(item, 200, req);
    }

    // DELETE /inventory/:id - Delete inventory item
    if (req.method === 'DELETE' && itemId) {
      const { error } = await admin
        .from('inventory_items')
        .delete()
        .eq('id', itemId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting inventory item:', error);
        return createCorsResponse({ error: 'Failed to delete inventory item' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Inventory item deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in inventory function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
