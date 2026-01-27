// Warehouse Operations Edge Function
// Handles warehouse and inventory management
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
    const endpoint = pathParts[1];
    const resourceId = pathParts[2];

    // GET /warehouse-operations/warehouses - List warehouses
    if (req.method === 'GET' && endpoint === 'warehouses' && !resourceId) {
      const { data: warehouses, error } = await admin
        .from('warehouses')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching warehouses:', error);
        return createCorsResponse({ error: 'Failed to fetch warehouses' }, 500, req);
      }

      return createCorsResponse(warehouses || [], 200, req);
    }

    // GET /warehouse-operations/warehouses/:id - Get single warehouse
    if (req.method === 'GET' && endpoint === 'warehouses' && resourceId) {
      const { data: warehouse, error } = await admin
        .from('warehouses')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Warehouse not found' }, 404, req);
      }

      // Get inventory summary
      const { data: inventory } = await admin
        .from('inventory')
        .select('*')
        .eq('warehouse_id', resourceId);

      return createCorsResponse(
        {
          ...warehouse,
          inventoryCount: inventory?.length || 0,
          inventory: inventory || [],
        },
        200,
        req,
      );
    }

    // POST /warehouse-operations/warehouses - Create warehouse
    if (req.method === 'POST' && endpoint === 'warehouses') {
      const body = await req.json();

      const { data: warehouse, error } = await admin
        .from('warehouses')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          code: body.code,
          address: body.address,
          city: body.city,
          state: body.state,
          zip_code: body.zipCode || body.zip_code,
          country: body.country || 'US',
          is_active: body.isActive !== false,
          is_primary: body.isPrimary || false,
          manager_id: body.managerId || body.manager_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create warehouse' }, 500, req);
      }

      return createCorsResponse(warehouse, 201, req);
    }

    // GET /warehouse-operations/inventory - Get inventory
    if (req.method === 'GET' && endpoint === 'inventory') {
      const warehouseId = url.searchParams.get('warehouseId');
      const lowStock = url.searchParams.get('lowStock');
      const category = url.searchParams.get('category');

      let query = admin
        .from('inventory')
        .select(
          `
          *,
          product:product_id (
            id,
            name,
            sku,
            category
          ),
          warehouse:warehouse_id (
            id,
            name
          )
        `,
        )
        .eq('tenant_id', tenantId);

      if (warehouseId) query = query.eq('warehouse_id', warehouseId);
      if (lowStock === 'true') query = query.lt('quantity', admin.raw('reorder_point'));

      const { data: inventory, error } = await query;

      if (error) {
        console.error('Error fetching inventory:', error);
        return createCorsResponse({ error: 'Failed to fetch inventory' }, 500, req);
      }

      return createCorsResponse(inventory || [], 200, req);
    }

    // POST /warehouse-operations/inventory/adjust - Adjust inventory
    if (req.method === 'POST' && endpoint === 'inventory' && resourceId === 'adjust') {
      const body = await req.json();

      const { data: current } = await admin
        .from('inventory')
        .select('quantity')
        .eq('id', body.inventoryId || body.inventory_id)
        .single();

      const newQuantity = (current?.quantity || 0) + (body.adjustment || 0);

      const { data: inventory, error } = await admin
        .from('inventory')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.inventoryId || body.inventory_id)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to adjust inventory' }, 500, req);
      }

      // Log the adjustment
      await admin.from('inventory_transactions').insert({
        tenant_id: tenantId,
        inventory_id: body.inventoryId || body.inventory_id,
        transaction_type: body.adjustment > 0 ? 'adjustment_in' : 'adjustment_out',
        quantity: Math.abs(body.adjustment),
        reason: body.reason,
        performed_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(inventory, 200, req);
    }

    // POST /warehouse-operations/transfer - Transfer between warehouses
    if (req.method === 'POST' && endpoint === 'transfer') {
      const body = await req.json();

      const transfer = {
        tenant_id: tenantId,
        from_warehouse_id: body.fromWarehouseId || body.from_warehouse_id,
        to_warehouse_id: body.toWarehouseId || body.to_warehouse_id,
        product_id: body.productId || body.product_id,
        quantity: body.quantity,
        status: 'pending',
        requested_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: transferRecord, error } = await admin
        .from('inventory_transfers')
        .insert(transfer)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create transfer' }, 500, req);
      }

      return createCorsResponse(transferRecord, 201, req);
    }

    // GET /warehouse-operations/transfers - List transfers
    if (req.method === 'GET' && endpoint === 'transfers') {
      const status = url.searchParams.get('status');

      let query = admin
        .from('inventory_transfers')
        .select(
          `
          *,
          from_warehouse:from_warehouse_id (id, name),
          to_warehouse:to_warehouse_id (id, name),
          product:product_id (id, name, sku)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);

      const { data: transfers } = await query;

      return createCorsResponse(transfers || [], 200, req);
    }

    // PUT /warehouse-operations/transfers/:id - Update transfer status
    if (req.method === 'PUT' && endpoint === 'transfers' && resourceId) {
      const body = await req.json();

      const { data: transfer, error } = await admin
        .from('inventory_transfers')
        .update({
          status: body.status,
          completed_at: body.status === 'completed' ? new Date().toISOString() : null,
          completed_by: body.status === 'completed' ? user.id : null,
          notes: body.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update transfer' }, 500, req);
      }

      return createCorsResponse(transfer, 200, req);
    }

    // GET /warehouse-operations/bin-locations - Get bin locations
    if (req.method === 'GET' && endpoint === 'bin-locations') {
      const warehouseId = url.searchParams.get('warehouseId');

      let query = admin.from('bin_locations').select('*').eq('tenant_id', tenantId);

      if (warehouseId) query = query.eq('warehouse_id', warehouseId);

      const { data: bins } = await query.order('bin_code', { ascending: true });

      return createCorsResponse(bins || [], 200, req);
    }

    // GET /warehouse-operations/picking-list - Generate picking list
    if (req.method === 'GET' && endpoint === 'picking-list') {
      const orderId = url.searchParams.get('orderId');

      const { data: orderItems } = await admin
        .from('order_items')
        .select(
          `
          *,
          product:product_id (
            id,
            name,
            sku
          ),
          inventory:product_id (
            warehouse_id,
            bin_location,
            quantity
          )
        `,
        )
        .eq('order_id', orderId);

      return createCorsResponse(orderItems || [], 200, req);
    }

    // DELETE /warehouse-operations/warehouses/:id - Delete warehouse
    if (req.method === 'DELETE' && endpoint === 'warehouses' && resourceId) {
      const { error } = await admin
        .from('warehouses')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete warehouse' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Warehouse deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in warehouse-operations function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
