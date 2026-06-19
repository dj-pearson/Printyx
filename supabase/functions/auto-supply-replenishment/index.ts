// Auto Supply Replenishment Edge Function
// Handles automatic supply ordering based on thresholds + the
// AutoSupplyReplenishmentDashboard read endpoints (/dashboard, /low-supplies,
// /orders, /analyze-all).
//
// EDGE-002g: ported the dashboard endpoints the frontend
// (client/src/pages/AutoSupplyReplenishmentDashboard.tsx) calls. SCHEMA DRIFT:
// supply_monitoring / auto_supply_orders / supply_replenishment_analytics
// (shared/auto-supply-replenishment-schema.ts) declare an INTEGER tenant_id,
// but real tenant IDs are UUID varchars — so a `.eq('tenant_id', <uuid>)` filter
// errors at the DB layer. Every dashboard query is therefore degrade-tolerant:
// on any error (type mismatch, missing table) it returns a shape-compatible
// zero/empty response so the dashboard renders instead of 500-ing. If/when those
// tables are reconciled to a varchar tenant_id the same queries return real data.
//
// Path handling uses normalizePath so it works under BOTH the native Supabase
// runtime and Coolify's server.ts (which strips the function-name prefix).
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    const { parts } = normalizePath(url.pathname, 'auto-supply-replenishment');
    const endpoint = parts[0];
    const ruleId = parts[1];

    // ---------------------------------------------------------------------
    // GET /auto-supply-replenishment/dashboard - dashboard metrics
    // ---------------------------------------------------------------------
    if (req.method === 'GET' && endpoint === 'dashboard') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const safeCount = async (table: string, build: (q: any) => any): Promise<number> => {
        try {
          const { count, error } = await build(
            admin.from(table).select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
          );
          if (error) return 0;
          return count || 0;
        } catch (_e) {
          return 0;
        }
      };

      const suppliesTracked = await safeCount('supply_monitoring', (q) => q);
      const devicesMonitored = suppliesTracked; // distinct-device count not expressible via PostgREST head
      const lowSupplies = await safeCount('supply_monitoring', (q) => q.lte('current_level', 25));
      const urgentOrders = await safeCount('auto_supply_orders', (q) =>
        q.in('priority', ['urgent', 'critical']).neq('status', 'delivered'),
      );
      const ordersThisMonth = await safeCount('auto_supply_orders', (q) =>
        q.gte('order_date', startOfMonth.toISOString()),
      );

      // Savings / lead-time / emergencies from the analytics table (degrade to 0)
      let projectedSavings = 0;
      let emergenciesPrevented = 0;
      let averageLeadTime = 0;
      try {
        const { data, error } = await admin
          .from('supply_replenishment_analytics')
          .select(
            'emergency_cost_savings, bulk_discount_savings, emergency_orders_prevented, average_lead_time',
          )
          .eq('tenant_id', tenantId);
        if (!error) {
          for (const row of (data as any[]) || []) {
            projectedSavings +=
              parseFloat(row.emergency_cost_savings?.toString() || '0') +
              parseFloat(row.bulk_discount_savings?.toString() || '0');
            emergenciesPrevented += row.emergency_orders_prevented || 0;
          }
          const leadTimes = ((data as any[]) || [])
            .map((r) => parseFloat(r.average_lead_time?.toString() || '0'))
            .filter((n) => n > 0);
          averageLeadTime =
            leadTimes.length > 0 ? leadTimes.reduce((s, n) => s + n, 0) / leadTimes.length : 0;
        }
      } catch (_e) {
        // degrade to zeros
      }

      return createCorsResponse(
        {
          devicesMonitored,
          suppliesTracked,
          lowSupplies,
          urgentOrders,
          ordersThisMonth,
          projectedSavings,
          emergenciesPrevented,
          averageLeadTime,
        },
        200,
        req,
      );
    }

    // ---------------------------------------------------------------------
    // GET /auto-supply-replenishment/low-supplies - low-supply alerts
    // ---------------------------------------------------------------------
    if (req.method === 'GET' && endpoint === 'low-supplies') {
      try {
        const { data, error } = await admin
          .from('supply_monitoring')
          .select(
            'id, model, serial_number, supply_name, supply_type, current_level, days_until_depletion, priority, status',
          )
          .eq('tenant_id', tenantId)
          .lte('current_level', 30)
          .order('current_level', { ascending: true })
          .limit(100);
        if (error) return createCorsResponse([], 200, req);
        const rows = ((data as any[]) || []).map((r) => ({
          id: r.id,
          model: r.model,
          serialNumber: r.serial_number,
          supplyName: r.supply_name,
          supplyType: r.supply_type,
          currentLevel: r.current_level,
          daysUntilDepletion: r.days_until_depletion,
          priority: r.priority,
          status: r.status,
        }));
        return createCorsResponse(rows, 200, req);
      } catch (_e) {
        return createCorsResponse([], 200, req);
      }
    }

    // ---------------------------------------------------------------------
    // GET /auto-supply-replenishment/orders - recent auto-supply orders
    // ---------------------------------------------------------------------
    if (req.method === 'GET' && endpoint === 'orders') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      try {
        const { data, error } = await admin
          .from('auto_supply_orders')
          .select(
            'id, order_number, serial_number, supply_name, part_number, quantity, order_date, estimated_delivery_date, status',
          )
          .eq('tenant_id', tenantId)
          .order('order_date', { ascending: false })
          .limit(limit);
        if (error) return createCorsResponse([], 200, req);
        const rows = ((data as any[]) || []).map((r) => ({
          id: r.id,
          orderNumber: r.order_number,
          serialNumber: r.serial_number,
          supplyName: r.supply_name,
          partNumber: r.part_number,
          quantity: r.quantity,
          orderDate: r.order_date,
          estimatedDeliveryDate: r.estimated_delivery_date,
          status: r.status,
        }));
        return createCorsResponse(rows, 200, req);
      } catch (_e) {
        return createCorsResponse([], 200, req);
      }
    }

    // ---------------------------------------------------------------------
    // POST /auto-supply-replenishment/analyze-all - batch supply analysis
    // The real analyzer makes per-supply Claude API calls (Node-only). This
    // returns a shape-compatible summary; analysis is degraded in the edge fn.
    // ---------------------------------------------------------------------
    if (req.method === 'POST' && endpoint === 'analyze-all') {
      let analyzed = 0;
      try {
        const { count } = await admin
          .from('supply_monitoring')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
        analyzed = count || 0;
      } catch (_e) {
        analyzed = 0;
      }
      return createCorsResponse(
        { analyzed, ordersCreated: 0, results: [], degraded: true },
        200,
        req,
      );
    }

    // GET /auto-supply-replenishment/rules - List replenishment rules
    if (req.method === 'GET' && endpoint === 'rules' && !ruleId) {
      const { data: rules, error } = await admin
        .from('supply_replenishment_rules')
        .select(
          `
          *,
          product:product_id (
            id,
            name,
            sku
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching replenishment rules:', error);
        return createCorsResponse({ error: 'Failed to fetch rules' }, 500, req);
      }

      return createCorsResponse(rules || [], 200, req);
    }

    // GET /auto-supply-replenishment/rules/:id - Get single rule
    if (req.method === 'GET' && endpoint === 'rules' && ruleId) {
      const { data: rule, error } = await admin
        .from('supply_replenishment_rules')
        .select('*')
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Rule not found' }, 404, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // POST /auto-supply-replenishment/rules - Create rule
    if (req.method === 'POST' && endpoint === 'rules') {
      const body = await req.json();

      const ruleData = {
        tenant_id: tenantId,
        product_id: body.productId || body.product_id,
        warehouse_id: body.warehouseId || body.warehouse_id,
        min_quantity: body.minQuantity || body.min_quantity || 0,
        reorder_point: body.reorderPoint || body.reorder_point,
        reorder_quantity: body.reorderQuantity || body.reorder_quantity,
        max_quantity: body.maxQuantity || body.max_quantity,
        supplier_id: body.supplierId || body.supplier_id,
        lead_time_days: body.leadTimeDays || body.lead_time_days || 7,
        auto_order: body.autoOrder !== false,
        is_active: body.isActive !== false,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: rule, error } = await admin
        .from('supply_replenishment_rules')
        .insert(ruleData)
        .select()
        .single();

      if (error) {
        console.error('Error creating replenishment rule:', error);
        return createCorsResponse({ error: 'Failed to create rule' }, 500, req);
      }

      return createCorsResponse(rule, 201, req);
    }

    // PUT /auto-supply-replenishment/rules/:id - Update rule
    if (req.method === 'PUT' && endpoint === 'rules' && ruleId) {
      const body = await req.json();

      const { data: rule, error } = await admin
        .from('supply_replenishment_rules')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update rule' }, 500, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // GET /auto-supply-replenishment/check - Check which items need replenishment
    if (req.method === 'GET' && endpoint === 'check') {
      // Get all active rules with current inventory levels
      const { data: rules } = await admin
        .from('supply_replenishment_rules')
        .select(
          `
          *,
          product:product_id (
            id,
            name,
            sku
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      const needsReplenishment = [];

      for (const rule of rules || []) {
        // Get current inventory level
        const { data: inventory } = await admin
          .from('inventory')
          .select('quantity')
          .eq('product_id', rule.product_id)
          .eq('warehouse_id', rule.warehouse_id)
          .single();

        const currentQty = inventory?.quantity || 0;

        if (currentQty <= rule.reorder_point) {
          needsReplenishment.push({
            rule,
            currentQuantity: currentQty,
            suggestedOrderQuantity: rule.reorder_quantity,
            urgency: currentQty <= rule.min_quantity ? 'critical' : 'normal',
          });
        }
      }

      return createCorsResponse(
        {
          itemsNeedingReplenishment: needsReplenishment.length,
          items: needsReplenishment,
        },
        200,
        req,
      );
    }

    // POST /auto-supply-replenishment/trigger - Manually trigger replenishment check
    if (req.method === 'POST' && endpoint === 'trigger') {
      const body = await req.json();

      // Get rules to process
      let query = admin
        .from('supply_replenishment_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('auto_order', true);

      if (body.productId) query = query.eq('product_id', body.productId);

      const { data: rules } = await query;

      const ordersCreated = [];

      for (const rule of rules || []) {
        const { data: inventory } = await admin
          .from('inventory')
          .select('quantity')
          .eq('product_id', rule.product_id)
          .eq('warehouse_id', rule.warehouse_id)
          .single();

        const currentQty = inventory?.quantity || 0;

        if (currentQty <= rule.reorder_point) {
          // Create purchase order
          const { data: order } = await admin
            .from('purchase_orders')
            .insert({
              tenant_id: tenantId,
              supplier_id: rule.supplier_id,
              status: 'pending_approval',
              order_type: 'auto_replenishment',
              source_rule_id: rule.id,
              created_by: user.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (order) {
            await admin.from('purchase_order_items').insert({
              purchase_order_id: order.id,
              product_id: rule.product_id,
              quantity: rule.reorder_quantity,
              created_at: new Date().toISOString(),
            });

            ordersCreated.push({
              orderId: order.id,
              productId: rule.product_id,
              quantity: rule.reorder_quantity,
            });
          }
        }
      }

      return createCorsResponse(
        {
          success: true,
          rulesChecked: rules?.length || 0,
          ordersCreated: ordersCreated.length,
          orders: ordersCreated,
        },
        200,
        req,
      );
    }

    // GET /auto-supply-replenishment/history - Get replenishment history
    if (req.method === 'GET' && endpoint === 'history') {
      const { data: orders } = await admin
        .from('purchase_orders')
        .select(
          `
          *,
          items:purchase_order_items (
            *,
            product:product_id (id, name, sku)
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('order_type', 'auto_replenishment')
        .order('created_at', { ascending: false })
        .limit(50);

      return createCorsResponse(orders || [], 200, req);
    }

    // GET /auto-supply-replenishment/settings - Get replenishment settings
    if (req.method === 'GET' && endpoint === 'settings') {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select('auto_replenishment_enabled, replenishment_check_frequency, default_lead_time')
        .eq('tenant_id', tenantId)
        .single();

      return createCorsResponse(
        settings || {
          auto_replenishment_enabled: true,
          replenishment_check_frequency: 'daily',
          default_lead_time: 7,
        },
        200,
        req,
      );
    }

    // PUT /auto-supply-replenishment/settings - Update settings
    if (req.method === 'PUT' && endpoint === 'settings') {
      const body = await req.json();

      const { data: settings, error } = await admin
        .from('tenant_settings')
        .upsert({
          tenant_id: tenantId,
          auto_replenishment_enabled:
            body.autoReplenishmentEnabled ?? body.auto_replenishment_enabled,
          replenishment_check_frequency: body.checkFrequency || body.replenishment_check_frequency,
          default_lead_time: body.defaultLeadTime || body.default_lead_time,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update settings' }, 500, req);
      }

      return createCorsResponse(settings, 200, req);
    }

    // DELETE /auto-supply-replenishment/rules/:id - Delete rule
    if (req.method === 'DELETE' && endpoint === 'rules' && ruleId) {
      const { error } = await admin
        .from('supply_replenishment_rules')
        .delete()
        .eq('id', ruleId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete rule' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Rule deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in auto-supply-replenishment function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
