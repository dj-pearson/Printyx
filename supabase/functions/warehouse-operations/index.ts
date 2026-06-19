// Warehouse Operations Edge Function
// Handles warehouse and inventory management
//
// Routes (function name stripped by Coolify's server.ts; normalizePath handles both):
//   GET    /                          → list warehouse operations (frontend default)
//   POST   /                          → create a warehouse operation
//   GET    /stats                     → operation stats summary
//   PATCH  /:id/status                → update an operation's status
//   GET    /warehouses                → list warehouses
//   GET    /warehouses/:id            → single warehouse + inventory
//   POST   /warehouses                → create warehouse
//   DELETE /warehouses/:id            → delete warehouse
//   GET    /inventory                 → list inventory
//   POST   /inventory/adjust          → adjust inventory
//   POST   /transfer                  → create transfer
//   GET    /transfers                 → list transfers
//   PUT    /transfers/:id             → update transfer status
//   GET    /bin-locations             → list bin locations
//   GET    /picking-list              → generate picking list
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

// First-segment reserved words that are named sub-resources, NOT operation ids.
const RESERVED = new Set([
  'warehouses',
  'inventory',
  'transfers',
  'transfer',
  'bin-locations',
  'picking-list',
  'stats',
]);

// Camelize a warehouse_operations row for the frontend (which reads Drizzle
// camelCase fields: operationType, equipmentId, assignedTo, scheduledDate, ...).
function toOperation(r: any) {
  if (!r) return r;
  return {
    id: r.id,
    tenantId: r.tenant_id,
    equipmentId: r.equipment_id,
    operationType: r.operation_type,
    status: r.status,
    assignedTo: r.assigned_to,
    scheduledDate: r.scheduled_date,
    completedDate: r.completed_date,
    completedBy: r.completed_by,
    notes: r.notes,
    qualityControlChecks: r.quality_control_checks,
    photos: r.photos,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    // Coolify strips the function name; normalizePath makes parts[0] the first
    // path segment (named sub-resource OR an operation id), parts[1] the id,
    // parts[2] the action.
    const { parts } = normalizePath(url.pathname, 'warehouse-operations');
    const endpoint = parts[0];
    const resourceId = parts[1];
    const sub = parts[2];
    const isReserved = !!endpoint && RESERVED.has(endpoint);

    // ─── Warehouse operations surface (frontend default) ──────────────────

    // GET /warehouse-operations/stats - Operation stats summary
    if (req.method === 'GET' && endpoint === 'stats') {
      const { data: ops, error } = await admin
        .from('warehouse_operations')
        .select('status, operation_type')
        .eq('tenant_id', tenantId);

      if (error) {
        // Degrade honestly: zeros so the dashboard renders an empty state.
        return createCorsResponse(
          {
            totalOperations: 0,
            pendingOperations: 0,
            inProgressOperations: 0,
            completedOperations: 0,
            failedOperations: 0,
            operationsByType: {
              receiving: 0,
              quality_control: 0,
              staging: 0,
              shipping: 0,
              build: 0,
            },
            degraded: true,
          },
          200,
          req,
        );
      }

      const operations = (ops as { status?: string; operation_type?: string }[]) || [];
      const countStatus = (s: string) => operations.filter((op) => op.status === s).length;
      const countType = (t: string) => operations.filter((op) => op.operation_type === t).length;

      return createCorsResponse(
        {
          totalOperations: operations.length,
          pendingOperations: countStatus('pending'),
          inProgressOperations: countStatus('in_progress'),
          completedOperations: countStatus('completed'),
          failedOperations: countStatus('failed'),
          operationsByType: {
            receiving: countType('receiving'),
            quality_control: countType('quality_control'),
            staging: countType('staging'),
            shipping: countType('shipping'),
            build: countType('build'),
          },
        },
        200,
        req,
      );
    }

    // GET /warehouse-operations - List warehouse operations
    if (req.method === 'GET' && !endpoint) {
      const status = url.searchParams.get('status');

      let query = admin
        .from('warehouse_operations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);

      const { data: ops, error } = await query;

      if (error) {
        console.error('Error fetching warehouse operations:', error);
        return createCorsResponse({ error: 'Failed to fetch warehouse operations' }, 500, req);
      }

      return createCorsResponse((ops || []).map(toOperation), 200, req);
    }

    // POST /warehouse-operations - Create a warehouse operation
    if (req.method === 'POST' && !endpoint) {
      const body = await req.json();

      const now = new Date().toISOString();
      const opData = {
        tenant_id: tenantId,
        equipment_id: body.equipmentId || body.equipment_id,
        operation_type: body.operationType || body.operation_type,
        status: body.status || 'pending',
        assigned_to: body.assignedTo || body.assigned_to || user.id,
        scheduled_date: body.scheduledDate || body.scheduled_date || null,
        completed_date: body.completedDate || body.completed_date || null,
        notes: body.notes || null,
        quality_control_checks: body.qualityControlChecks || body.quality_control_checks || null,
        photos: body.photos || null,
        created_at: now,
        updated_at: now,
      };

      const { data: op, error } = await admin
        .from('warehouse_operations')
        .insert(opData)
        .select()
        .single();

      if (error) {
        console.error('Error creating warehouse operation:', error);
        return createCorsResponse(
          { error: 'Failed to create warehouse operation', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse(toOperation(op), 201, req);
    }

    // PATCH /warehouse-operations/:id/status - Update operation status
    if (
      (req.method === 'PATCH' || req.method === 'PUT') &&
      endpoint &&
      !isReserved &&
      sub === 'status'
    ) {
      const operationId = endpoint;
      const body = await req.json();

      const updateData: Record<string, unknown> = {
        status: body.status,
        updated_at: new Date().toISOString(),
      };
      if (body.status === 'completed') {
        updateData.completed_date = new Date().toISOString();
        updateData.completed_by = user.id;
      }

      const { data: op, error } = await admin
        .from('warehouse_operations')
        .update(updateData)
        .eq('id', operationId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error || !op) {
        return createCorsResponse({ error: 'Warehouse operation not found' }, 404, req);
      }

      return createCorsResponse(toOperation(op), 200, req);
    }

    // ─── Warehouses ───────────────────────────────────────────────────────

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

    // ─── Inventory ────────────────────────────────────────────────────────

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

    // GET /warehouse-operations/inventory - Get inventory
    if (req.method === 'GET' && endpoint === 'inventory') {
      const warehouseId = url.searchParams.get('warehouseId');
      const lowStock = url.searchParams.get('lowStock');

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

      const { data: inventory, error } = await query;

      if (error) {
        console.error('Error fetching inventory:', error);
        return createCorsResponse({ error: 'Failed to fetch inventory' }, 500, req);
      }

      let result = inventory || [];
      // reorder_point is a per-row column, so low-stock is an in-memory filter
      // (supabase-js can't compare two columns server-side).
      if (lowStock === 'true') {
        result = result.filter((r: any) => (r.quantity ?? 0) < (r.reorder_point ?? 0));
      }

      return createCorsResponse(result, 200, req);
    }

    // ─── Transfers ────────────────────────────────────────────────────────

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
    if (req.method === 'GET' && endpoint === 'transfers' && !resourceId) {
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

    // ─── Bin locations & picking list ─────────────────────────────────────

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

    // PUT /warehouse-operations/:id - Update a warehouse operation (generic)
    if ((req.method === 'PUT' || req.method === 'PATCH') && endpoint && !isReserved && !sub) {
      const operationId = endpoint;
      const body = await req.json();

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const fieldMap: Record<string, string> = {
        equipmentId: 'equipment_id',
        operationType: 'operation_type',
        status: 'status',
        assignedTo: 'assigned_to',
        scheduledDate: 'scheduled_date',
        completedDate: 'completed_date',
        notes: 'notes',
        qualityControlChecks: 'quality_control_checks',
        photos: 'photos',
      };
      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: op, error } = await admin
        .from('warehouse_operations')
        .update(updateData)
        .eq('id', operationId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error || !op) {
        return createCorsResponse({ error: 'Warehouse operation not found' }, 404, req);
      }

      return createCorsResponse(toOperation(op), 200, req);
    }

    // GET /warehouse-operations/:id - Get a single warehouse operation
    if (req.method === 'GET' && endpoint && !isReserved && !resourceId) {
      const { data: op, error } = await admin
        .from('warehouse_operations')
        .select('*')
        .eq('id', endpoint)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !op) {
        return createCorsResponse({ error: 'Warehouse operation not found' }, 404, req);
      }

      return createCorsResponse(toOperation(op), 200, req);
    }

    // DELETE /warehouse-operations/:id - Delete a warehouse operation
    if (req.method === 'DELETE' && endpoint && !isReserved && !resourceId) {
      const { error } = await admin
        .from('warehouse_operations')
        .delete()
        .eq('id', endpoint)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete warehouse operation' }, 500, req);
      }

      return createCorsResponse({ success: true }, 200, req);
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
