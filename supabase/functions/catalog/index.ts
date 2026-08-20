// Catalog Edge Function
// Handles product catalog management (models, accessories, manufacturers)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /catalog, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'catalog');
    const resource = parts[0]; // 'models', 'manufacturers', 'accessories', etc.
    const resourceId = parts[1];
    const action = parts[2]; // 'enable', 'bulk-enable', etc.

    // GET /catalog/manufacturers - Get unique manufacturers list
    if (req.method === 'GET' && resource === 'manufacturers') {
      const { data: models } = await admin
        .from('product_models')
        .select('manufacturer')
        .eq('tenant_id', tenantId)
        .not('manufacturer', 'is', null);

      const manufacturers = [...new Set(models?.map((m) => m.manufacturer).filter(Boolean))].sort();

      return createCorsResponse(manufacturers, 200, req);
    }

    // GET /catalog/categories - Get unique categories list
    if (req.method === 'GET' && resource === 'categories') {
      const { data: models } = await admin
        .from('product_models')
        .select('category')
        .eq('tenant_id', tenantId)
        .not('category', 'is', null);

      const categories = [...new Set(models?.map((m) => m.category).filter(Boolean))].sort();

      return createCorsResponse(categories, 200, req);
    }

    // POST /catalog/models/:id/enable - Enable product for customer pricing
    if (req.method === 'POST' && resource === 'models' && resourceId && action === 'enable') {
      const body = await req.json();

      // Update product model with customer-specific overrides if needed
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Apply overrides from body if provided
      if (body.overrides) {
        Object.assign(updateData, body.overrides);
      }

      const { data: model, error } = await admin
        .from('product_models')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error enabling product:', error);
        return createCorsResponse({ error: 'Failed to enable product' }, 500, req);
      }

      return createCorsResponse(model, 200, req);
    }

    // POST /catalog/models/bulk-enable - Enable multiple products
    if (req.method === 'POST' && resource === 'models' && resourceId === 'bulk-enable') {
      const body = await req.json();
      const { productIds, overrides } = body;

      if (!productIds || !Array.isArray(productIds)) {
        return createCorsResponse({ error: 'productIds array is required' }, 400, req);
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
        ...overrides,
      };

      const { data: models, error } = await admin
        .from('product_models')
        .update(updateData)
        .in('id', productIds)
        .eq('tenant_id', tenantId)
        .select();

      if (error) {
        console.error('Error bulk enabling products:', error);
        return createCorsResponse({ error: 'Failed to bulk enable products' }, 500, req);
      }

      return createCorsResponse({ updated: models?.length || 0, models }, 200, req);
    }

    // GET /catalog/models - List all product models with filters
    if (req.method === 'GET' && (resource === 'models' || !resource)) {
      const category = url.searchParams.get('category');
      const manufacturer = url.searchParams.get('manufacturer');
      const search = url.searchParams.get('search');
      const isActive = url.searchParams.get('isActive') || url.searchParams.get('is_active');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = (page - 1) * limit;

      let query = admin
        .from('product_models')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('product_name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (category) {
        query = query.eq('category', category);
      }

      if (manufacturer) {
        query = query.eq('manufacturer', manufacturer);
      }

      if (isActive !== null && isActive !== undefined) {
        // Check if any tier is active
        if (isActive === 'true') {
          // The tiers on product_models are new / upgrade / lexmark. There are no
          // refurb, demo or rental columns, so the old filter 42703'd and the
          // "active only" catalog view returned an error instead of products.
          query = query.or(
            'new_active.eq.true,upgrade_active.eq.true,lexmark_active.eq.true,is_active.eq.true',
          );
        }
      }

      if (search) {
        query = query.or(
          `product_code.ilike.%${search}%,product_name.ilike.%${search}%,description.ilike.%${search}%`,
        );
      }

      const { data: models, error, count } = await query;

      if (error) {
        console.error('Error fetching product models:', error);
        return createCorsResponse({ error: 'Failed to fetch product models' }, 500, req);
      }

      return createCorsResponse(
        {
          data: models || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /catalog/models/:id - Get single product model
    if (req.method === 'GET' && resource === 'models' && resourceId && !action) {
      const { data: model, error } = await admin
        .from('product_models')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching product model:', error);
        return createCorsResponse({ error: 'Product model not found' }, 404, req);
      }

      // Also fetch related accessories if any
      const { data: accessories } = await admin
        .from('product_accessory_compatibility')
        .select(
          `
          *,
          accessory:product_accessories(*)
        `,
        )
        .eq('model_id', resourceId)
        .eq('tenant_id', tenantId);

      return createCorsResponse({ ...model, accessories: accessories || [] }, 200, req);
    }

    // POST /catalog/models - Create new product model
    if (req.method === 'POST' && resource === 'models') {
      const body = await req.json();

      // product_models carries THREE pricing tiers — new / upgrade / lexmark —
      // and this handler was written against a different set (new / refurb /
      // demo / rental). Only refurb_active, demo_active and rental_active were
      // visible to check:phantom-cols, because the payload is a named variable;
      // the whole refurb_*, demo_* and rental_* families are equally absent, so
      // every create here was a 42703. They are reported rather than guessed
      // onto upgrade_*/lexmark_*, which mean something else.
      const PHANTOM_TIER_PREFIXES = ['refurb', 'demo', 'rental'];
      const unpersisted = PHANTOM_TIER_PREFIXES.filter((tier) =>
        Object.keys(body).some((k) => k.toLowerCase().startsWith(tier)),
      ).map(
        (tier) => `${tier}*: product_models has no ${tier} tier (tiers are new/upgrade/lexmark)`,
      );

      const modelData = {
        tenant_id: tenantId,
        product_code: body.productCode || body.product_code,
        product_name: body.productName || body.product_name,
        category: body.category || 'MFP',
        manufacturer: body.manufacturer || null,
        description: body.description || null,
        msrp: body.msrp || null,
        color_mode: body.colorMode || body.color_mode || null,
        color_speed: body.colorSpeed || body.color_speed || null,
        bw_speed: body.bwSpeed || body.bw_speed || null,
        product_family: body.productFamily || body.product_family || null,
        required_accessories: body.requiredAccessories || body.required_accessories || null,
        // New tier
        new_active:
          body.newActive !== undefined
            ? body.newActive
            : body.new_active !== undefined
              ? body.new_active
              : false,
        new_dealer_cost: body.newDealerCost || body.new_dealer_cost || null,
        new_rep_markup_percentage:
          body.newRepMarkupPercentage || body.new_rep_markup_percentage || null,
        new_rep_cost: body.newRepCost || body.new_rep_cost || null,
        new_rep_price: body.newRepPrice || body.new_rep_price || null,
        new_suggested_retail: body.newSuggestedRetail || body.new_suggested_retail || null,
        // Upgrade tier
        upgrade_active:
          body.upgradeActive !== undefined
            ? body.upgradeActive
            : body.upgrade_active !== undefined
              ? body.upgrade_active
              : false,
        upgrade_dealer_cost: body.upgradeDealerCost || body.upgrade_dealer_cost || null,
        upgrade_rep_markup_percentage:
          body.upgradeRepMarkupPercentage || body.upgrade_rep_markup_percentage || null,
        upgrade_rep_cost: body.upgradeRepCost || body.upgrade_rep_cost || null,
        upgrade_rep_price: body.upgradeRepPrice || body.upgrade_rep_price || null,
        upgrade_suggested_retail:
          body.upgradeSuggestedRetail || body.upgrade_suggested_retail || null,
        // Lexmark tier
        lexmark_active:
          body.lexmarkActive !== undefined
            ? body.lexmarkActive
            : body.lexmark_active !== undefined
              ? body.lexmark_active
              : false,
        lexmark_dealer_cost: body.lexmarkDealerCost || body.lexmark_dealer_cost || null,
        lexmark_rep_markup_percentage:
          body.lexmarkRepMarkupPercentage || body.lexmark_rep_markup_percentage || null,
        lexmark_rep_cost: body.lexmarkRepCost || body.lexmark_rep_cost || null,
        lexmark_rep_price: body.lexmarkRepPrice || body.lexmark_rep_price || null,
        lexmark_suggested_retail:
          body.lexmarkSuggestedRetail || body.lexmark_suggested_retail || null,
        is_active: body.isActive !== undefined ? body.isActive : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: model, error } = await admin
        .from('product_models')
        .insert(modelData)
        .select()
        .single();

      if (error) {
        console.error('Error creating product model:', error);
        return createCorsResponse(
          { error: 'Failed to create product model', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(
        unpersisted.length > 0 ? { ...model, unpersisted } : model,
        201,
        req,
      );
    }

    // PATCH /catalog/models/:id - Update product model
    if ((req.method === 'PATCH' || req.method === 'PUT') && resource === 'models' && resourceId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map all possible fields (camelCase to snake_case)
      const fieldMap: Record<string, string> = {
        productCode: 'product_code',
        productName: 'product_name',
        category: 'category',
        manufacturer: 'manufacturer',
        description: 'description',
        msrp: 'msrp',
        colorMode: 'color_mode',
        colorSpeed: 'color_speed',
        bwSpeed: 'bw_speed',
        productFamily: 'product_family',
        requiredAccessories: 'required_accessories',
        newActive: 'new_active',
        newDealerCost: 'new_dealer_cost',
        newRepMarkupPercentage: 'new_rep_markup_percentage',
        newRepCost: 'new_rep_cost',
        newRepPrice: 'new_rep_price',
        newSuggestedRetail: 'new_suggested_retail',
        // Same three tiers as the create above: new / upgrade / lexmark. The
        // refurb, demo and rental entries that used to be here named no columns,
        // so any edit touching one took the whole update down with a 42703.
        upgradeActive: 'upgrade_active',
        upgradeDealerCost: 'upgrade_dealer_cost',
        upgradeRepMarkupPercentage: 'upgrade_rep_markup_percentage',
        upgradeRepCost: 'upgrade_rep_cost',
        upgradeRepPrice: 'upgrade_rep_price',
        upgradeSuggestedRetail: 'upgrade_suggested_retail',
        lexmarkActive: 'lexmark_active',
        lexmarkDealerCost: 'lexmark_dealer_cost',
        lexmarkRepMarkupPercentage: 'lexmark_rep_markup_percentage',
        lexmarkRepCost: 'lexmark_rep_cost',
        lexmarkRepPrice: 'lexmark_rep_price',
        lexmarkSuggestedRetail: 'lexmark_suggested_retail',
        isActive: 'is_active',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: model, error } = await admin
        .from('product_models')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating product model:', error);
        return createCorsResponse({ error: 'Failed to update product model' }, 500, req);
      }

      return createCorsResponse(model, 200, req);
    }

    // DELETE /catalog/models/:id - Delete product model
    if (req.method === 'DELETE' && resource === 'models' && resourceId) {
      // First delete related compatibility records
      await admin
        .from('product_accessory_compatibility')
        .delete()
        .eq('model_id', resourceId)
        .eq('tenant_id', tenantId);

      // Then delete the model
      const { error } = await admin
        .from('product_models')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting product model:', error);
        return createCorsResponse({ error: 'Failed to delete product model' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Product model deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in catalog function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
