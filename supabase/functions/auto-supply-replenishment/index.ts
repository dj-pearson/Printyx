// Auto Supply Replenishment Edge Function
// Handles automatic supply ordering based on thresholds
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
    const ruleId = pathParts[2];

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
