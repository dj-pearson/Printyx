/**
 * WF-V-06 AC3 - THE DECISION IS RECORDED HERE AND IS STILL OPEN, with the
 * evidence, because retiring a routed page is a product call and not a cleanup.
 *
 * THE STATE, verified 2026-09-21 rather than quoted: this function reads
 * `supply_monitoring`, `supply_replenishment_analytics` and
 * `supply_usage_history`, all three of which are in
 * docs/unwritten-tables-baseline.json - nothing anywhere inserts a row. Its own
 * writes go to `auto_supply_orders` and its rules table, not to those inputs.
 * `AutoSupplyReplenishmentDashboard.tsx` is routed and calls three of its
 * endpoints, so a user reaches a dashboard whose inputs are empty by
 * construction.
 *
 * WHAT CHANGED SINCE THE STORY WAS FILED, and why this is now a real question
 * rather than a symptom: AUDIT-032 (migration 0062) and AUDIT-036 (0063) found
 * these three had `tenant_id` and foreign keys declared INTEGER against uuid
 * targets, so nothing COULD have written them. Both are fixed. The tables are
 * writable now; the pipeline that would fill them is what does not exist.
 *
 * THE TWO OPTIONS, neither of which this story takes unilaterally:
 *   - Give it a writer: a capture job on the toner-replenish model, which
 *     already regresses meter history into a depletion date. That is a feature.
 *   - Retire it: the page, this function and the three tables go TOGETHER, per
 *     the story's own AC3 - removing the function while leaving a routed page
 *     is how a 404 becomes the user's problem.
 *
 * server/tests/unit/supply-order-union.test.ts asserts this state and FAILS the
 * day one of the three gains a writer, so the note cannot go stale the way six
 * of them did in one session.
 */
// Auto Supply Replenishment Edge Function
// Handles automatic supply ordering based on thresholds
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
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
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

/**
 * The columns supply_replenishment_rules actually has (AUDIT-037).
 *
 * It is a PER-TENANT SETTINGS row - thresholds, lead times, an ordering window,
 * budgets and notification preferences - not a per-product reorder rule, which
 * is what every write in this file was built against. Mapping explicitly rather
 * than spreading the request body is the point: one unknown key 42703s the whole
 * statement, so `{ ...body }` made the endpoint only as reliable as the caller.
 */
function settingsColumns(body: Record<string, unknown>): Record<string, unknown> {
  const pick = (...names: string[]) => {
    for (const name of names) if (body[name] !== undefined) return body[name];
    return undefined;
  };
  const out: Record<string, unknown> = {
    auto_order_enabled: pick('autoOrderEnabled', 'auto_order_enabled'),
    require_approval: pick('requireApproval', 'require_approval'),
    approval_threshold: pick('approvalThreshold', 'approval_threshold'),
    default_reorder_threshold: pick('defaultReorderThreshold', 'default_reorder_threshold'),
    urgent_threshold: pick('urgentThreshold', 'urgent_threshold'),
    critical_threshold: pick('criticalThreshold', 'critical_threshold'),
    default_lead_time: pick('defaultLeadTime', 'default_lead_time'),
    buffer_days: pick('bufferDays', 'buffer_days'),
    preferred_supplier_id: pick('preferredSupplierId', 'preferred_supplier_id'),
    alternate_supplier_ids: pick('alternateSupplierIds', 'alternate_supplier_ids'),
    notify_on_order_placed: pick('notifyOnOrderPlaced', 'notify_on_order_placed'),
    notify_on_delivery: pick('notifyOnDelivery', 'notify_on_delivery'),
    notify_customers: pick('notifyCustomers', 'notify_customers'),
    notification_email: pick('notificationEmail', 'notification_email'),
    notification_phone: pick('notificationPhone', 'notification_phone'),
    order_days_of_week: pick('orderDaysOfWeek', 'order_days_of_week'),
    no_order_holidays: pick('noOrderHolidays', 'no_order_holidays'),
    consolidate_orders: pick('consolidateOrders', 'consolidate_orders'),
    consolidation_window: pick('consolidationWindow', 'consolidation_window'),
    ai_prediction_enabled: pick('aiPredictionEnabled', 'ai_prediction_enabled'),
    minimum_confidence_score: pick('minimumConfidenceScore', 'minimum_confidence_score'),
    usage_history_days: pick('usageHistoryDays', 'usage_history_days'),
    max_order_value: pick('maxOrderValue', 'max_order_value'),
    monthly_budget: pick('monthlyBudget', 'monthly_budget'),
  };
  for (const key of Object.keys(out)) if (out[key] === undefined) delete out[key];
  return out;
}

/**
 * Per-product fields a caller may still send, named back rather than dropped.
 *
 * These are the eleven this file used to write. There is no table behind them:
 * building one is the feature the /trigger branch answers 501 for.
 */
const PER_PRODUCT_FIELDS = [
  'productId',
  'product_id',
  'warehouseId',
  'warehouse_id',
  'minQuantity',
  'min_quantity',
  'maxQuantity',
  'max_quantity',
  'reorderPoint',
  'reorder_point',
  'reorderQuantity',
  'reorder_quantity',
  'supplierId',
  'supplier_id',
  'leadTimeDays',
  'lead_time_days',
  'autoOrder',
  'auto_order',
  'isActive',
  'is_active',
];

function unpersistedRuleFields(body: Record<string, unknown>): string[] {
  return PER_PRODUCT_FIELDS.filter((f) => body[f] !== undefined);
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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    /**
     * SEC-EDGE-001. Placing supply orders and changing the rules that place them spends the
     * dealer's money.
     *
     * The gate is on the WRITE branches, not the function: seeing what the analysis recommends is a rep's or a
     * technician's own work.
     * A LEVEL check rather than a permission code (SEC-EDGE-002).
     */
    const requireManager = () => {
      requireRoleLevel(
        {
          userId: user.id,
          tenantId,
          email: user.email,
          jwt: jwt ?? '',
          supabaseUser: user,
        } as AuthContext,
        ROLE_LEVEL.MANAGER,
      );
    };
    const denyManager = (err: unknown) => {
      if (err instanceof RbacError) {
        return createCorsResponse(
          {
            error: 'Changing replenishment rules or triggering an order requires a manager role',
            code: 'INSUFFICIENT_ROLE',
            details: err.details,
          },
          403,
          req,
        );
      }
      throw err;
    };

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

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
      // AUDIT-037: the embed was `product:product_id (...)`, and product_id is
      // not a column on this table - nor is there a foreign key for PostgREST
      // to follow if it were. supply_replenishment_rules is PER-TENANT
      // SETTINGS: thresholds, lead times, budgets, notification preferences and
      // an ordering window, one row. There is no per-product rule model here,
      // which is the same finding the /trigger branch below records.
      const { data: rules, error } = await admin
        .from('supply_replenishment_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching replenishment rules:', error);
        return createCorsResponse({ error: 'Failed to fetch rules' }, 500, req);
      }

      return createCorsResponse(toCamel(rules ?? []), 200, req);
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
      try {
        requireManager();
      } catch (err) {
        return denyManager(err);
      }
      const body = await req.json();

      // Every field below is a column this table HAS. What was here named
      // product_id, warehouse_id, min_quantity, reorder_point, reorder_quantity,
      // max_quantity, supplier_id, lead_time_days, auto_order, is_active and
      // created_by - eleven names, not one of them a column, so creating a rule
      // was a 42703 in every environment (AUDIT-037).
      const ruleData = { ...settingsColumns(body), tenant_id: tenantId };

      const { data: rule, error } = await admin
        .from('supply_replenishment_rules')
        .insert({
          ...ruleData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating replenishment rule:', error);
        return createCorsResponse({ error: 'Failed to create rule' }, 500, req);
      }

      const skipped = unpersistedRuleFields(body);
      return createCorsResponse(
        skipped.length > 0 ? { ...toCamel(rule), unpersisted: skipped } : toCamel(rule),
        201,
        req,
      );
    }

    // PUT /auto-supply-replenishment/rules/:id - Update rule
    if (req.method === 'PUT' && endpoint === 'rules' && ruleId) {
      try {
        requireManager();
      } catch (err) {
        return denyManager(err);
      }
      const body = await req.json();

      // `{ ...body }` sent whatever the caller typed straight at PostgREST, so
      // one unknown key 42703'd the whole update. Mapped explicitly now.
      const { data: rule, error } = await admin
        .from('supply_replenishment_rules')
        .update({ ...settingsColumns(body), updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update rule' }, 500, req);
      }

      const skipped = unpersistedRuleFields(body);
      return createCorsResponse(
        skipped.length > 0 ? { ...toCamel(rule), unpersisted: skipped } : toCamel(rule),
        200,
        req,
      );
    }

    // GET /auto-supply-replenishment/check - which items are at or below their
    // reorder point
    //
    // AUDIT-037: this used to iterate supply_replenishment_rules filtered on
    // is_active, reading `rule.product_id`, `rule.warehouse_id`,
    // `rule.reorder_point`, `rule.reorder_quantity` and `rule.min_quantity`, and
    // then read a table called `inventory` - which does not exist either; the
    // real one is inventory_items. Six phantom names, so the endpoint answered
    // 500 wherever it was called.
    //
    // The question is answerable without any of it. inventory_items carries its
    // OWN reorder_point and reorder_quantity per item, so the per-product rule
    // model this was reaching for is already in the inventory table. The tenant
    // settings row supplies the urgency bands.
    if (req.method === 'GET' && endpoint === 'check') {
      const { data: settings } = await admin
        .from('supply_replenishment_rules')
        .select('urgent_threshold, critical_threshold')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();

      // PostgREST cannot compare two columns, so quantity_on_hand <=
      // reorder_point is evaluated here - hence the cap and the ordering.
      const { data: items, error } = await admin
        .from('inventory_items')
        .select(
          'id, name, part_number, quantity_on_hand, reorder_point, reorder_quantity, primary_vendor',
        )
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .not('reorder_point', 'is', null)
        .order('quantity_on_hand', { ascending: true })
        .limit(500);

      if (error) {
        console.error('Error checking replenishment:', error);
        return createCorsResponse({ error: 'Failed to check replenishment' }, 500, req);
      }

      const urgentAt = toNumber(settings?.urgent_threshold);
      const criticalAt = toNumber(settings?.critical_threshold);

      const needsReplenishment = [];
      for (const item of items ?? []) {
        if (item.reorder_point === null || item.reorder_point === undefined) continue;
        const onHand = toNumber(item.quantity_on_hand) ?? 0;
        const reorderAt = toNumber(item.reorder_point);
        if (reorderAt === null || onHand > reorderAt) continue;

        // Bands come from the tenant's settings row. With no settings row there
        // is no band to apply, so urgency is null rather than a guess.
        let urgency: string | null = null;
        if (criticalAt !== null && onHand <= criticalAt) urgency = 'critical';
        else if (urgentAt !== null && onHand <= urgentAt) urgency = 'urgent';
        else if (criticalAt !== null || urgentAt !== null) urgency = 'normal';

        needsReplenishment.push({
          inventoryItemId: item.id,
          name: item.name,
          partNumber: item.part_number,
          currentQuantity: onHand,
          reorderPoint: reorderAt,
          suggestedOrderQuantity: toNumber(item.reorder_quantity),
          preferredVendor: item.primary_vendor ?? null,
          urgency,
        });
      }

      return createCorsResponse(
        {
          itemsNeedingReplenishment: needsReplenishment.length,
          items: needsReplenishment.slice(0, 100),
          ...(urgentAt === null && criticalAt === null
            ? {
                unbacked: ['urgency'],
                reason:
                  'This tenant has no supply_replenishment_rules row, so there are no urgency bands to apply.',
              }
            : {}),
        },
        200,
        req,
      );
    }

    // POST /auto-supply-replenishment/trigger - manually trigger a replenishment run
    if (req.method === 'POST' && endpoint === 'trigger') {
      try {
        requireManager();
      } catch (err) {
        return denyManager(err);
      }
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
