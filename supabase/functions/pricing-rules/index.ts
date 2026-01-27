// Pricing Rules Edge Function
// Handles dynamic pricing rule management
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
    const ruleId = pathParts[1];
    const subResource = pathParts[2];

    // GET /pricing-rules - List pricing rules
    if (req.method === 'GET' && !ruleId) {
      const ruleType = url.searchParams.get('type');
      const isActive = url.searchParams.get('isActive');

      let query = admin
        .from('pricing_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true });

      if (ruleType) query = query.eq('rule_type', ruleType);
      if (isActive === 'true') query = query.eq('is_active', true);

      const { data: rules, error } = await query;

      if (error) {
        console.error('Error fetching pricing rules:', error);
        return createCorsResponse({ error: 'Failed to fetch pricing rules' }, 500, req);
      }

      return createCorsResponse(rules || [], 200, req);
    }

    // GET /pricing-rules/types - Get available rule types
    if (req.method === 'GET' && ruleId === 'types') {
      const types = [
        {
          id: 'volume_discount',
          name: 'Volume Discount',
          description: 'Discount based on quantity',
        },
        { id: 'customer_tier', name: 'Customer Tier', description: 'Pricing by customer tier' },
        { id: 'time_based', name: 'Time-Based', description: 'Seasonal or promotional pricing' },
        { id: 'bundle', name: 'Bundle', description: 'Package/bundle pricing' },
        { id: 'contract', name: 'Contract', description: 'Contract-specific pricing' },
        { id: 'markup', name: 'Markup', description: 'Cost-plus pricing' },
      ];

      return createCorsResponse(types, 200, req);
    }

    // GET /pricing-rules/:id - Get single rule
    if (req.method === 'GET' && ruleId && !subResource) {
      const { data: rule, error } = await admin
        .from('pricing_rules')
        .select('*')
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Pricing rule not found' }, 404, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // POST /pricing-rules - Create rule
    if (req.method === 'POST' && !ruleId) {
      const body = await req.json();

      const ruleData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        rule_type: body.ruleType || body.rule_type,
        conditions: body.conditions || {},
        adjustments: body.adjustments || {},
        priority: body.priority || 100,
        is_active: body.isActive !== false,
        start_date: body.startDate || body.start_date,
        end_date: body.endDate || body.end_date,
        applies_to_products: body.appliesToProducts || body.applies_to_products || [],
        applies_to_categories: body.appliesToCategories || body.applies_to_categories || [],
        applies_to_customers: body.appliesToCustomers || body.applies_to_customers || [],
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: rule, error } = await admin
        .from('pricing_rules')
        .insert(ruleData)
        .select()
        .single();

      if (error) {
        console.error('Error creating pricing rule:', error);
        return createCorsResponse({ error: 'Failed to create pricing rule' }, 500, req);
      }

      return createCorsResponse(rule, 201, req);
    }

    // PUT /pricing-rules/:id - Update rule
    if (req.method === 'PUT' && ruleId && !subResource) {
      const body = await req.json();

      const { data: rule, error } = await admin
        .from('pricing_rules')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update pricing rule' }, 500, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // POST /pricing-rules/calculate - Calculate price with rules
    if (req.method === 'POST' && ruleId === 'calculate') {
      const body = await req.json();
      const { productId, customerId, quantity, basePrice } = body;

      // Get applicable rules
      const { data: rules } = await admin
        .from('pricing_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      let finalPrice = basePrice || 0;
      const appliedRules: any[] = [];

      for (const rule of rules || []) {
        let applies = true;

        // Check date range
        if (rule.start_date && new Date(rule.start_date) > new Date()) applies = false;
        if (rule.end_date && new Date(rule.end_date) < new Date()) applies = false;

        // Check product applicability
        if (rule.applies_to_products?.length > 0 && !rule.applies_to_products.includes(productId)) {
          applies = false;
        }

        // Check customer applicability
        if (
          rule.applies_to_customers?.length > 0 &&
          !rule.applies_to_customers.includes(customerId)
        ) {
          applies = false;
        }

        if (!applies) continue;

        // Apply rule adjustments
        const adjustments = rule.adjustments || {};

        if (adjustments.discountPercent) {
          const discount = finalPrice * (adjustments.discountPercent / 100);
          finalPrice -= discount;
          appliedRules.push({ rule: rule.name, type: 'percentage', discount });
        }

        if (adjustments.discountAmount) {
          finalPrice -= adjustments.discountAmount;
          appliedRules.push({
            rule: rule.name,
            type: 'fixed',
            discount: adjustments.discountAmount,
          });
        }

        if (adjustments.newPrice) {
          finalPrice = adjustments.newPrice;
          appliedRules.push({
            rule: rule.name,
            type: 'fixed_price',
            newPrice: adjustments.newPrice,
          });
        }

        // Volume discount check
        if (rule.rule_type === 'volume_discount' && quantity) {
          const tiers = adjustments.tiers || [];
          for (const tier of tiers) {
            if (
              quantity >= tier.minQuantity &&
              (!tier.maxQuantity || quantity <= tier.maxQuantity)
            ) {
              const discount = finalPrice * (tier.discountPercent / 100);
              finalPrice -= discount;
              appliedRules.push({ rule: rule.name, type: 'volume', tier, discount });
              break;
            }
          }
        }
      }

      return createCorsResponse(
        {
          basePrice,
          finalPrice: Math.max(0, finalPrice),
          discount: basePrice - finalPrice,
          appliedRules,
        },
        200,
        req,
      );
    }

    // POST /pricing-rules/:id/toggle - Toggle rule active state
    if (req.method === 'POST' && ruleId && subResource === 'toggle') {
      const { data: current } = await admin
        .from('pricing_rules')
        .select('is_active')
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .single();

      const { data: rule, error } = await admin
        .from('pricing_rules')
        .update({
          is_active: !current?.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to toggle rule' }, 500, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // POST /pricing-rules/:id/duplicate - Duplicate rule
    if (req.method === 'POST' && ruleId && subResource === 'duplicate') {
      const { data: original } = await admin
        .from('pricing_rules')
        .select('*')
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .single();

      if (!original) {
        return createCorsResponse({ error: 'Rule not found' }, 404, req);
      }

      const { data: duplicate, error } = await admin
        .from('pricing_rules')
        .insert({
          tenant_id: tenantId,
          name: `${original.name} (Copy)`,
          description: original.description,
          rule_type: original.rule_type,
          conditions: original.conditions,
          adjustments: original.adjustments,
          priority: original.priority + 1,
          is_active: false,
          applies_to_products: original.applies_to_products,
          applies_to_categories: original.applies_to_categories,
          applies_to_customers: original.applies_to_customers,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to duplicate rule' }, 500, req);
      }

      return createCorsResponse(duplicate, 201, req);
    }

    // DELETE /pricing-rules/:id - Delete rule
    if (req.method === 'DELETE' && ruleId) {
      const { error } = await admin
        .from('pricing_rules')
        .delete()
        .eq('id', ruleId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete pricing rule' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Pricing rule deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in pricing-rules function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
