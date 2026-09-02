// Auto Supply Replenishment Edge Function
// Handles automatic supply ordering based on thresholds
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamel } from '../_shared/case.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import {
  buildSupplyAnalysisPrompt,
  calculateAverageUsage,
  heuristicSupplyAnalysis,
  supplyPriorityFor,
  type SupplyAnalysisInput,
  type SupplyUsageReading,
} from '../_shared/supply-analysis.ts';
import { toNumber } from '../_shared/quote-math.ts';

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
    // /auto-supply-replenishment, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'auto-supply-replenishment');
    const endpoint = parts[0];
    const ruleId = parts[1];

    // ─── Dashboard endpoints (EDGE-002g) ────────────────────────────────────
    //
    // AutoSupplyReplenishmentDashboard.tsx calls /dashboard, /low-supplies,
    // /orders and /analyze-all. None existed here, so all four were hard 404s
    // in production while dev fell back to the Express router mounted at
    // routes-registry.ts. Ported from
    // server/services/auto-supply-replenishment-service.ts.
    //
    // Rows go through toCamel: the page reads supply.{serialNumber, supplyType,
    // supplyName, currentLevel, daysUntilDepletion, ...} and order.{orderNumber,
    // orderDate, estimatedDeliveryDate, partNumber, ...}, while PostgREST
    // returns snake_case.

    // GET /auto-supply-replenishment/dashboard
    if (req.method === 'GET' && endpoint === 'dashboard') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Signature matches daily-briefing's countRows(client, 'table', apply):
      // check:phantom-cols recognises that shape and scopes the callback's
      // filters to the named table. With the client dropped it falls back to
      // positional attribution and blames them on the previous .from().
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

      const [equipmentRows, suppliesTracked, lowSupplies, urgentOrders, ordersThisMonth] =
        await Promise.all([
          // count(distinct equipment_id) has no PostgREST equivalent, so the
          // ids come back and are de-duplicated here.
          admin.from('supply_monitoring').select('equipment_id').eq('tenant_id', tenantId),
          countOf(admin, 'supply_monitoring', (q) => q),
          countOf(admin, 'supply_monitoring', (q) => q.lt('current_level', 20)),
          countOf(admin, 'auto_supply_orders', (q) =>
            q
              .in('priority', ['urgent', 'critical'])
              .in('status', ['order_placed', 'order_confirmed', 'in_transit']),
          ),
          countOf(admin, 'auto_supply_orders', (q) =>
            q.gte('order_date', startOfMonth.toISOString()),
          ),
        ]);

      const devicesMonitored = new Set(
        (equipmentRows.data ?? []).map((r: any) => r.equipment_id).filter(Boolean),
      ).size;

      const { data: analytics } = await admin
        .from('supply_replenishment_analytics')
        .select('emergency_cost_savings, emergency_orders_prevented, average_lead_time')
        .eq('tenant_id', tenantId)
        .eq('period_type', 'monthly')
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      // AUDIT-028: the three fields below come from supply_replenishment_analytics,
      // and NOTHING WRITES THAT TABLE - no insert exists anywhere in the tree.
      // So `analytics` is always null here, and the Express default this ported
      // (`|| 3.0`) meant the dashboard reported a 3.0-day average lead time it
      // had never measured, permanently. Null says "not measured"; the page
      // renders that as a dash rather than a confident zero.
      const hasAnalytics = Boolean(analytics);
      return createCorsResponse(
        {
          devicesMonitored,
          suppliesTracked,
          lowSupplies,
          urgentOrders,
          ordersThisMonth,
          projectedSavings: hasAnalytics ? toNumber(analytics?.emergency_cost_savings) : null,
          emergenciesPrevented: hasAnalytics
            ? (analytics?.emergency_orders_prevented ?? null)
            : null,
          averageLeadTime: hasAnalytics ? toNumber(analytics?.average_lead_time) : null,
          unbacked: hasAnalytics
            ? []
            : [
                'projectedSavings, emergenciesPrevented, averageLeadTime: supply_replenishment_analytics has no producer, so no period has ever been summarised',
              ],
        },
        200,
        req,
      );
    }

    // GET /auto-supply-replenishment/low-supplies
    if (req.method === 'GET' && endpoint === 'low-supplies') {
      const { data: supplies, error } = await admin
        .from('supply_monitoring')
        .select('*')
        .eq('tenant_id', tenantId)
        .lt('current_level', 20)
        .order('current_level', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error fetching low supplies:', error);
        return createCorsResponse({ error: 'Failed to fetch low supplies' }, 500, req);
      }

      return createCorsResponse(toCamel(supplies ?? []), 200, req);
    }

    // GET /auto-supply-replenishment/orders
    if (req.method === 'GET' && endpoint === 'orders' && !ruleId) {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100);

      const { data: orders, error } = await admin
        .from('auto_supply_orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('order_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching supply orders:', error);
        return createCorsResponse({ error: 'Failed to fetch orders' }, 500, req);
      }

      return createCorsResponse(toCamel(orders ?? []), 200, req);
    }

    // POST /auto-supply-replenishment/analyze-all
    //
    // Scores every monitored supply, writes the prediction back, and places an
    // auto-order where the supply allows it. Unlike contract-renewal's
    // analyze-all this is a COMPLETE port: the ordering half
    // (createAutoSupplyOrder) involves no model call, just data, so there was
    // nothing to leave out.
    //
    // Prompt and deterministic fallback come from _shared/supply-analysis.ts,
    // locked to the Express service by
    // server/tests/unit/supply-analysis-parity.test.ts. With no CLAUDE_API_KEY
    // the heuristic is the only path that runs — and it decides whether toner is
    // bought, so the two copies agreeing is not cosmetic.
    if (req.method === 'POST' && endpoint === 'analyze-all') {
      const now = Date.now();

      const { data: supplies, error: suppliesError } = await admin
        .from('supply_monitoring')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'monitoring');

      if (suppliesError) {
        console.error('Error loading supplies to analyze:', suppliesError);
        return createCorsResponse({ error: 'Failed to load supplies' }, 500, req);
      }

      const results: Array<Record<string, unknown>> = [];
      let ordersCreated = 0;

      for (const row of supplies ?? []) {
        const supply = toCamel<SupplyAnalysisInput>(row);

        const { data: historyRows } = await admin
          .from('supply_usage_history')
          .select('date_recorded, pages_since_last_reading')
          .eq('tenant_id', tenantId)
          .eq('supply_monitoring_id', row.id)
          .order('date_recorded', { ascending: false })
          .limit(90);
        const usageHistory = toCamel<SupplyUsageReading[]>(historyRows ?? []);

        const dailyUsage = supply.dailyUsageAverage
          ? parseFloat(String(supply.dailyUsageAverage))
          : calculateAverageUsage(usageHistory);

        let analysis = heuristicSupplyAnalysis(supply, dailyUsage, now);
        let analysedBy: 'model' | 'heuristic' = 'heuristic';

        try {
          const text = await generateCompletion({
            max_tokens: 1024,
            messages: [
              { role: 'user', content: buildSupplyAnalysisPrompt(supply, usageHistory, now) },
            ],
          });
          const parsed = JSON.parse(text);
          const depletion = parsed.depletionDate ? new Date(parsed.depletionDate) : null;
          const days = depletion
            ? Math.ceil((depletion.getTime() - now) / (1000 * 60 * 60 * 24))
            : null;
          const priority = supplyPriorityFor(days);
          analysis = {
            currentLevel: supply.currentLevel ?? 0,
            predictedDepletionDate: depletion,
            daysUntilDepletion: days,
            confidenceScore: parsed.confidenceScore ?? 70,
            aiAnalysis: {
              summary: parsed.summary,
              usagePattern: parsed.usagePattern,
              riskLevel: parsed.riskLevel,
              recommendation: parsed.recommendation,
              factors: parsed.factors,
            },
            shouldOrder:
              parsed.recommendation === 'order_now' || parsed.recommendation === 'urgent',
            priority,
          };
          analysedBy = 'model';
        } catch (modelError) {
          console.warn(
            'Supply model analysis unavailable, using heuristic:',
            modelError instanceof Error ? modelError.message : modelError,
          );
        }

        const { error: updateError } = await admin
          .from('supply_monitoring')
          .update({
            predicted_depletion_date: analysis.predictedDepletionDate?.toISOString() ?? null,
            days_until_depletion: analysis.daysUntilDepletion,
            confidence_score: analysis.confidenceScore,
            ai_analysis: analysis.aiAnalysis,
            priority: analysis.priority,
            status: analysis.shouldOrder ? 'low' : 'monitoring',
            last_checked_at: new Date(now).toISOString(),
            updated_at: new Date(now).toISOString(),
          })
          .eq('id', row.id)
          .eq('tenant_id', tenantId);

        if (updateError) {
          console.error('Error writing supply analysis:', updateError);
          results.push({
            supplyId: row.id,
            serialNumber: row.serial_number,
            supplyName: row.supply_name,
            error: updateError.message,
          });
          continue;
        }

        let orderCreated = false;
        if (analysis.shouldOrder && row.auto_order_enabled) {
          // Never place a second order while one is already moving.
          const { data: existingOrder } = await admin
            .from('auto_supply_orders')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('supply_monitoring_id', row.id)
            .in('status', ['order_placed', 'order_confirmed', 'in_transit'])
            .limit(1)
            .maybeSingle();

          if (!existingOrder) {
            const orderNumber = `AUTO-${now}-${crypto.randomUUID().slice(0, 9).toUpperCase()}`;
            const { error: orderError } = await admin.from('auto_supply_orders').insert({
              tenant_id: tenantId,
              supply_monitoring_id: row.id,
              equipment_id: row.equipment_id,
              serial_number: row.serial_number,
              order_number: orderNumber,
              supply_type: row.supply_type,
              supply_name: row.supply_name,
              part_number: row.part_number ?? null,
              quantity: row.reorder_quantity || 1,
              status: 'order_placed',
              priority: analysis.priority,
              triggered_by: 'ai_prediction',
              prevented_emergency:
                analysis.priority === 'critical' || analysis.priority === 'urgent',
              order_date: new Date(now).toISOString(),
              // Express estimates delivery at a 3-day lead time.
              estimated_delivery_date: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
            });

            if (orderError) {
              console.error('Error placing auto supply order:', orderError);
            } else {
              orderCreated = true;
              ordersCreated++;
              await admin
                .from('supply_monitoring')
                .update({
                  status: 'order_placed',
                  last_ordered_at: new Date(now).toISOString(),
                  updated_at: new Date(now).toISOString(),
                })
                .eq('id', row.id)
                .eq('tenant_id', tenantId);
            }
          }
        }

        results.push({
          supplyId: row.id,
          serialNumber: row.serial_number,
          supplyName: row.supply_name,
          analysedBy,
          analysis,
          orderCreated,
        });
      }

      return createCorsResponse({ analyzed: results.length, ordersCreated, results }, 200, req);
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

    // POST /auto-supply-replenishment/trigger - manually trigger a replenishment run
    if (req.method === 'POST' && endpoint === 'trigger') {
      // AUDIT-037: this used to create a purchase order per triggered rule and
      // report how many it made. It could not create one, and it could not read
      // a rule either.
      //
      // The rule query filtered supply_replenishment_rules on is_active,
      // auto_order and product_id. That table is per-TENANT SETTINGS - one row,
      // holding thresholds, budgets and notification preferences - and has none
      // of those three columns, nor reorder_point, warehouse_id or
      // reorder_quantity. So there is no per-product rule model to iterate.
      //
      // The insert then named supplier_id, order_type and source_rule_id, none
      // of which is a column on purchase_orders, and OMITTED six that are NOT
      // NULL: po_number, vendor_id, requested_by, order_date, subtotal and
      // total_amount. Its line item named product_id, which purchase_order_items
      // does not have either. And the result was destructured as
      // `{ data: order }` with no error, so every failure was swallowed and this
      // answered 200 with `ordersCreated: 0` - a run that ordered nothing looked
      // exactly like a run with nothing to order.
      //
      // Building it means a per-product rule table, PO numbering, a supplier to
      // vendor resolution and a priced line. That is a feature. Saying so beats
      // reporting a number nothing produced.
      return createCorsResponse(
        {
          error: 'Not implemented',
          message:
            'Automatic purchase-order creation is not built. supply_replenishment_rules holds ' +
            'per-tenant settings, not per-product reorder rules, and a purchase order needs a ' +
            'number, a vendor and a priced line that nothing here can supply.',
          code: 'NOT_IMPLEMENTED',
        },
        501,
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
          items:purchase_order_items (*)
        `,
        )
        .eq('tenant_id', tenantId)
        // No order_type column exists, so there is nothing to filter on - and
        // nothing writes an auto-replenishment order in the first place (see
        // the /check branch above). Left as a tenant-scoped list rather than a
        // 42703 on a column that is not there.
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
