// Warehouse Operations Edge Function
// Handles warehouse and inventory management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

/**
 * The named sub-paths, so the single-operation GET below cannot swallow one.
 *
 * PA-052 hit the mirror image of this three times: a list branch with no
 * `!resourceId` guard swallowing everything behind an id. Here the risk runs the
 * other way, because the id sits where a name would.
 */
const NAMED_ENDPOINTS = new Set([
  'warehouses',
  'inventory',
  'transfers',
  'bin-locations',
  'picking-list',
  'stats',
]);

/**
 * WF-L-03, on the five branches nothing calls.
 *
 * /warehouses, /inventory, /transfers, /bin-locations and /picking-list have no
 * caller in ANY client tree - client/src, ios, mobile-app and printyx-client were
 * all checked. They are KEPT rather than deleted, and the reason is not
 * sentiment: six of the seven tables they read - warehouses, inventory,
 * inventory_transactions, inventory_transfers, bin_locations and order_items -
 * sit in docs/phantom-tables-baseline.json's `unreviewed` list, which means
 * nothing in this repository declares them. So they cannot be given a caller
 * until those tables are settled, and deleting them would throw away the only
 * written description of what a warehouse module over those tables would look
 * like.
 *
 * What they must NOT be mistaken for is live. Nothing reaches them today.
 */
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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /warehouse-operations, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'warehouse-operations');
    const endpoint = parts[0];
    const resourceId = parts[1];

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

      // CR-002: scope both the read and the write to the caller's tenant so a
      // guessed inventoryId from another tenant cannot be read or adjusted.
      const inventoryId = body.inventoryId || body.inventory_id;
      const { data: current } = await admin
        .from('inventory')
        .select('quantity')
        .eq('id', inventoryId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!current) {
        return createCorsResponse({ error: 'Inventory item not found' }, 404, req);
      }

      const newQuantity = (current?.quantity || 0) + (body.adjustment || 0);

      const { data: inventory, error } = await admin
        .from('inventory')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inventoryId)
        .eq('tenant_id', tenantId)
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

    // GET /warehouse-operations/stats (EDGE-002h)
    //
    // WarehouseOperations.tsx reads stats.totalOperations, pendingOperations,
    // inProgressOperations and completedOperations. Express counts these in JS
    // after fetching every operation; PostgREST can count server-side, so this
    // asks for five head-only counts instead of pulling the rows.
    if (req.method === 'GET' && endpoint === 'stats') {
      const countOf = async (
        client: typeof admin,
        table: string,
        apply: (q: any) => any,
      ): Promise<number> => {
        const { count } = await apply(
          client.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        );
        return count ?? 0;
      };

      const STATUSES = ['pending', 'in_progress', 'completed', 'failed'];
      const TYPES = ['receiving', 'quality_control', 'staging', 'shipping', 'build'];

      const [total, ...statusCounts] = await Promise.all([
        countOf(admin, 'warehouse_operations', (q) => q),
        ...STATUSES.map((st) => countOf(admin, 'warehouse_operations', (q) => q.eq('status', st))),
      ]);

      const typeCounts = await Promise.all(
        TYPES.map((t) => countOf(admin, 'warehouse_operations', (q) => q.eq('operation_type', t))),
      );

      return createCorsResponse(
        {
          totalOperations: total,
          pendingOperations: statusCounts[0],
          inProgressOperations: statusCounts[1],
          completedOperations: statusCounts[2],
          failedOperations: statusCounts[3],
          operationsByType: Object.fromEntries(TYPES.map((t, i) => [t, typeCounts[i]])),
        },
        200,
        req,
      );
    }

    // ── WF-L-03: the three endpoints WarehouseOperations.tsx actually calls ──
    //
    // The board lists GET /, creates with POST / and advances with
    // PATCH /:id/status. None of the three existed here, so every one fell to the
    // terminal 404 below and the page worked only in dev, where
    // server/routes-warehouse.ts served them. EDGE-002h missed it because that
    // check compares NAMED sub-paths and the bare list has no name.
    //
    // These are LAST on purpose: `endpoint` is undefined for the bare list, and
    // for PATCH it is the id, so putting them above would swallow the named
    // branches - the missing-!resourceId defect PA-052 hit three times.
    //
    // Rows go out in camelCase because that is what the page reads.
    const toOperation = (row: Record<string, unknown>) => ({
      id: row.id,
      tenantId: row.tenant_id,
      equipmentId: row.equipment_id,
      operationType: row.operation_type,
      status: row.status,
      assignedTo: row.assigned_to,
      scheduledDate: row.scheduled_date,
      completedDate: row.completed_date,
      notes: row.notes,
      qualityControlChecks: row.quality_control_checks,
      photos: row.photos,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });

    if (req.method === 'GET' && !endpoint) {
      const status = url.searchParams.get('status');
      const operationType =
        url.searchParams.get('operationType') || url.searchParams.get('operation_type');

      let query = admin
        .from('warehouse_operations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (status) query = query.eq('status', status);
      if (operationType) query = query.eq('operation_type', operationType);

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching warehouse operations:', error);
        return createCorsResponse({ error: 'Failed to fetch warehouse operations' }, 500, req);
      }
      return createCorsResponse((data ?? []).map(toOperation), 200, req);
    }

    if (req.method === 'POST' && !endpoint) {
      const body = await req.json();
      const equipmentId = body.equipmentId ?? body.equipment_id;
      const operationType = body.operationType ?? body.operation_type;

      // Both are NOT NULL. Saying which one is missing beats a 23502 the caller
      // reads as "something went wrong".
      if (!equipmentId) return createCorsResponse({ error: 'equipmentId is required' }, 400, req);
      if (!operationType) {
        return createCorsResponse({ error: 'operationType is required' }, 400, req);
      }

      const { data, error } = await admin
        .from('warehouse_operations')
        .insert({
          tenant_id: tenantId,
          equipment_id: equipmentId,
          operation_type: operationType,
          status: body.status ?? 'pending',
          // The Express version defaulted an unassigned operation to the caller.
          // Kept, so an operation always has someone against it.
          assigned_to: body.assignedTo ?? body.assigned_to ?? user.id,
          scheduled_date: body.scheduledDate ?? body.scheduled_date ?? null,
          notes: body.notes ?? null,
          quality_control_checks: body.qualityControlChecks ?? body.quality_control_checks ?? null,
          photos: body.photos ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating warehouse operation:', error);
        return createCorsResponse(
          { error: 'Failed to create the warehouse operation', details: error },
          500,
          req,
        );
      }
      return createCorsResponse(toOperation(data), 201, req);
    }

    if (req.method === 'GET' && endpoint && !resourceId && !NAMED_ENDPOINTS.has(endpoint)) {
      const { data, error } = await admin
        .from('warehouse_operations')
        .select('*')
        .eq('id', endpoint)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching warehouse operation:', error);
        return createCorsResponse({ error: 'Failed to fetch the operation' }, 500, req);
      }
      if (!data) return createCorsResponse({ error: 'Warehouse operation not found' }, 404, req);
      return createCorsResponse(toOperation(data), 200, req);
    }

    if (req.method === 'PATCH' && endpoint && resourceId === 'status') {
      const body = await req.json();
      const status = body.status;
      if (!status) return createCorsResponse({ error: 'status is required' }, 400, req);

      // NO completed_by. The Express handler set it on completion and
      // warehouse_operations has no such column, so Drizzle dropped the key on
      // every write - silently, which is why nobody noticed the field was never
      // stored. completed_date is the one that exists.
      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'completed') patch.completed_date = new Date().toISOString();

      const { data, error } = await admin
        .from('warehouse_operations')
        .update(patch)
        .eq('id', endpoint)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error updating warehouse operation status:', error);
        return createCorsResponse({ error: 'Failed to update the operation' }, 500, req);
      }
      if (!data) return createCorsResponse({ error: 'Warehouse operation not found' }, 404, req);
      return createCorsResponse(toOperation(data), 200, req);
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
