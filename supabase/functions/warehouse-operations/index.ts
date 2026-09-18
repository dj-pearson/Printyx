// Warehouse Operations Edge Function
// Handles warehouse and inventory management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { applyUserScope, resolveScope, rowInScope } from '../_shared/scope.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchInBatches } from '../_shared/batch-fetch.ts';
import {
  completionUpdate,
  computeFpy,
  periodStart,
  satisfiedRequirements,
  type KittingRow,
} from '../_shared/kitting-fpy.ts';
import { toCamel } from '../_shared/case.ts';

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
  // WF-L-05
  'kitting',
  'fpy-metrics',
  'serials',
]);

/** Equipment stages a unit can be at while it is still the warehouse's problem. */
const PRE_STAGE_STAGES = ['received', 'staged'];

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

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

    // ────────────────────────── WF-L-05: kitting and FPY ──────────────────────
    //
    // Ported from server/routes-warehouse-fpy.ts, which had real Zod CRUD over
    // warehouse_kitting_operations and fpy_metrics, no caller in any client
    // tree, and no edge function - so it worked in dev for nobody and 404'd in
    // production. The Build and Serial Numbers tabs on WarehouseOperations.tsx
    // rendered "will be implemented here" above it the whole time.

    // GET /warehouse-operations/kitting - list, newest first
    if (req.method === 'GET' && endpoint === 'kitting' && !resourceId) {
      let query = admin
        .from('warehouse_kitting_operations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);

      const status = url.searchParams.get('status');
      const technician = url.searchParams.get('technician');
      const orderNumber = url.searchParams.get('orderNumber');
      if (status) query = query.eq('operation_status', status);
      if (technician) query = query.eq('assigned_technician', technician);
      if (orderNumber) query = query.eq('order_number', orderNumber);

      const { data, error } = await query;
      if (error) {
        console.error('Error listing kitting operations:', error);
        return createCorsResponse({ error: 'Failed to list kitting operations' }, 500, req);
      }
      return createCorsResponse(toCamel(data ?? []), 200, req);
    }

    // GET /warehouse-operations/kitting/:id
    if (req.method === 'GET' && endpoint === 'kitting' && resourceId && !parts[2]) {
      const { data, error } = await admin
        .from('warehouse_kitting_operations')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error || !data) {
        return createCorsResponse({ error: 'Kitting operation not found' }, 404, req);
      }
      return createCorsResponse(
        { ...toCamel(data), satisfiesRequirements: satisfiedRequirements(data as KittingRow) },
        200,
        req,
      );
    }

    // POST /warehouse-operations/kitting - open a build
    if (req.method === 'POST' && endpoint === 'kitting' && !resourceId) {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);

      // order_number, customer_id, kit_name and assigned_technician are all NOT
      // NULL. Refusing here beats a 23502 the caller has to decode.
      const required = {
        order_number: body.orderNumber ?? body.order_number,
        customer_id: body.customerId ?? body.customer_id,
        kit_name: body.kitName ?? body.kit_name,
        assigned_technician: body.assignedTechnician ?? body.assigned_technician,
      };
      const missing = Object.entries(required)
        .filter(([, v]) => v === undefined || v === null || v === '')
        .map(([k]) => k);
      if (missing.length > 0) {
        return createCorsResponse({ error: 'Missing required fields', fields: missing }, 400, req);
      }

      const now = new Date().toISOString();
      const { data, error } = await admin
        .from('warehouse_kitting_operations')
        .insert({
          ...required,
          tenant_id: tenantId,
          purchase_order_id: body.purchaseOrderId ?? body.purchase_order_id ?? null,
          equipment_model: body.equipmentModel ?? body.equipment_model ?? null,
          required_accessories: body.requiredAccessories ?? body.required_accessories ?? [],
          checklist_items: body.checklistItems ?? body.checklist_items ?? [],
          serial_numbers: body.serialNumbers ?? body.serial_numbers ?? [],
          asset_tags: body.assetTags ?? body.asset_tags ?? [],
          notes: body.notes ?? null,
          operation_status: 'in_progress',
          quality_status: 'pending',
          rework_count: 0,
          started_at: now,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating kitting operation:', error);
        return createCorsResponse({ error: 'Failed to create kitting operation' }, 500, req);
      }
      return createCorsResponse(toCamel(data), 201, req);
    }

    // PATCH /warehouse-operations/kitting/:id - checklist and serial progress
    if (req.method === 'PATCH' && endpoint === 'kitting' && resourceId) {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const map: Record<string, string> = {
        checklistItems: 'checklist_items',
        requiredAccessories: 'required_accessories',
        serialNumbers: 'serial_numbers',
        assetTags: 'asset_tags',
        firmwareVersions: 'firmware_versions',
        photos: 'photos',
        notes: 'notes',
        equipmentModel: 'equipment_model',
        assignedTechnician: 'assigned_technician',
        operationStatus: 'operation_status',
      };
      for (const [camel, snake] of Object.entries(map)) {
        if (body[camel] !== undefined) update[snake] = body[camel];
        else if (body[snake] !== undefined) update[snake] = body[snake];
      }

      const { data, error } = await admin
        .from('warehouse_kitting_operations')
        .update(update)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error || !data) {
        return createCorsResponse({ error: 'Failed to update kitting operation' }, 500, req);
      }
      return createCorsResponse(toCamel(data), 200, req);
    }

    // POST /warehouse-operations/kitting/:id/complete - the QA decision
    if (req.method === 'POST' && endpoint === 'kitting' && resourceId && parts[2] === 'complete') {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      if (typeof body.passed !== 'boolean') {
        return createCorsResponse({ error: '`passed` must be true or false' }, 400, req);
      }

      // Read first: whether this is a FIRST pass depends on the rework count
      // already on the row, not on what the caller sends.
      const { data: current, error: readError } = await admin
        .from('warehouse_kitting_operations')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (readError || !current) {
        return createCorsResponse({ error: 'Kitting operation not found' }, 404, req);
      }

      const { data, error } = await admin
        .from('warehouse_kitting_operations')
        .update(
          completionUpdate(current as KittingRow, {
            passed: body.passed as boolean,
            defects: (body.defects ?? body.defectsFound) as never,
            notes: (body.notes as string) ?? null,
            completedBy: user.id,
          }),
        )
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error || !data) {
        console.error('Error completing kitting operation:', error);
        return createCorsResponse({ error: 'Failed to complete kitting operation' }, 500, req);
      }

      // WF-L-13 is the story that makes the transition endpoint CHECK its
      // requirements; today it accepts whatever the caller claims. What this
      // returns is the EVIDENCE side of that - a durable record the check can
      // read once it lands, rather than a claim.
      return createCorsResponse(
        { ...toCamel(data), satisfiesRequirements: satisfiedRequirements(data as KittingRow) },
        200,
        req,
      );
    }

    // GET /warehouse-operations/fpy-metrics?period=day|week|month|quarter
    if (req.method === 'GET' && endpoint === 'fpy-metrics') {
      const period = url.searchParams.get('period') || 'week';
      const start = periodStart(period);

      const { data, error } = await admin
        .from('warehouse_kitting_operations')
        .select(
          'id, assigned_technician, equipment_model, first_pass_yield, rework_required, defects_found',
        )
        .eq('tenant_id', tenantId)
        .eq('operation_status', 'completed')
        .gte('created_at', start.toISOString());

      if (error) {
        console.error('Error computing FPY metrics:', error);
        return createCorsResponse({ error: 'Failed to compute FPY metrics' }, 500, req);
      }

      const metrics = computeFpy((data ?? []) as KittingRow[]);
      return createCorsResponse(
        {
          period: { start: start.toISOString(), end: new Date().toISOString(), label: period },
          ...metrics,
          // A yield over an empty window is not zero. Saying so keeps a quiet
          // week from reading as a collapse in build quality.
          ...(metrics.totalOperations === 0
            ? {
                unbacked: ['fpyPercentage', 'reworkRate'],
                reason: 'No kitting operation completed in this window.',
              }
            : {}),
        },
        200,
        req,
      );
    }

    // GET /warehouse-operations/serials - units the warehouse still holds,
    // each with the kitting operation that covers it
    if (req.method === 'GET' && endpoint === 'serials') {
      // equipment_lifecycle is where the STAGE lives (current_stage); the
      // `equipment` table has equipment_status, a different vocabulary, and no
      // `model` column at all - it is model_number there. WF-L-04 put the
      // lifecycle row in charge of the stage and this follows it.
      const { data: units, error } = await admin
        .from('equipment_lifecycle')
        .select(
          'id, equipment_id, serial_number, model, manufacturer, current_stage, current_location, customer_id, updated_at',
        )
        .eq('tenant_id', tenantId)
        .in('current_stage', PRE_STAGE_STAGES)
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error listing staged serials:', error);
        return createCorsResponse({ error: 'Failed to list serial numbers' }, 500, req);
      }

      const serials = (units ?? [])
        .map((u: Record<string, unknown>) => String(u.serial_number ?? ''))
        .filter(Boolean);

      // serial_numbers is a jsonb ARRAY on the operation, so a serial cannot be
      // matched with .in() - the rows are fetched for the tenant and grouped
      // here. Capped for the same reason.
      const operations =
        serials.length === 0
          ? []
          : await fetchInBatches<Record<string, unknown>>([tenantId], 'tenant_id', () =>
              admin
                .from('warehouse_kitting_operations')
                .select(
                  'id, order_number, kit_name, serial_numbers, operation_status, quality_status, first_pass_yield, assigned_technician, completed_at',
                )
                .order('created_at', { ascending: false }),
            );

      const bySerial = new Map<string, Record<string, unknown>>();
      for (const op of operations) {
        for (const serial of (op.serial_numbers as string[] | null) ?? []) {
          const key = String(serial);
          if (!bySerial.has(key)) bySerial.set(key, op);
        }
      }

      return createCorsResponse(
        (units ?? []).map((unit: Record<string, unknown>) => {
          const op = bySerial.get(String(unit.serial_number ?? ''));
          return {
            ...toCamel(unit),
            kitting: op ? toCamel(op) : null,
            kittingStatus: op ? (op.quality_status ?? op.operation_status) : 'not_started',
          };
        }),
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

      // WF-R-06. `assigned_to` is the only person this table names - there is no
      // location or warehouse column, so AC1's "location of the operation" is not
      // expressible here and is not faked. An operation assigned to nobody stays
      // visible above `own` scope: the create branch below defaults it to the
      // caller, so an unassigned row means an import, not private work.
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
        requestedScope: url.searchParams.get('scope'),
      });
      query = applyUserScope(query, 'assigned_to', scope);

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

      // WF-R-06: a list filter says nothing about a write aimed at an id. Marking
      // somebody else's operation complete is a claim that work was done.
      const { data: existing } = await admin
        .from('warehouse_operations')
        .select('id, assigned_to')
        .eq('id', endpoint)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!existing) {
        return createCorsResponse({ error: 'Warehouse operation not found' }, 404, req);
      }
      const patchScope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
      });
      if (!rowInScope(existing, 'assigned_to', patchScope)) {
        return createCorsResponse(
          { error: 'This operation is outside your scope', code: 'ROW_OUT_OF_SCOPE' },
          403,
          req,
        );
      }

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
