// Catalog Edge Function
// Handles product catalog management (models, accessories, manufacturers)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const resource = pathParts[1]; // 'models', 'manufacturers', 'accessories', etc.
    const resourceId = pathParts[2];
    const action = pathParts[3]; // 'enable', 'bulk-enable', etc.

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
          query = query.or(
            'new_active.eq.true,refurb_active.eq.true,demo_active.eq.true,rental_active.eq.true',
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
        new_suggested_retail: body.newSuggestedRetail || body.new_suggested_retail || null,
        // Refurb tier
        refurb_active:
          body.refurbActive !== undefined
            ? body.refurbActive
            : body.refurb_active !== undefined
              ? body.refurb_active
              : false,
        refurb_dealer_cost: body.refurbDealerCost || body.refurb_dealer_cost || null,
        refurb_rep_markup_percentage:
          body.refurbRepMarkupPercentage || body.refurb_rep_markup_percentage || null,
        refurb_rep_cost: body.refurbRepCost || body.refurb_rep_cost || null,
        refurb_suggested_retail: body.refurbSuggestedRetail || body.refurb_suggested_retail || null,
        // Demo tier
        demo_active:
          body.demoActive !== undefined
            ? body.demoActive
            : body.demo_active !== undefined
              ? body.demo_active
              : false,
        demo_dealer_cost: body.demoDealerCost || body.demo_dealer_cost || null,
        demo_rep_markup_percentage:
          body.demoRepMarkupPercentage || body.demo_rep_markup_percentage || null,
        demo_rep_cost: body.demoRepCost || body.demo_rep_cost || null,
        demo_suggested_retail: body.demoSuggestedRetail || body.demo_suggested_retail || null,
        // Rental tier
        rental_active:
          body.rentalActive !== undefined
            ? body.rentalActive
            : body.rental_active !== undefined
              ? body.rental_active
              : false,
        rental_monthly_rate: body.rentalMonthlyRate || body.rental_monthly_rate || null,
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

      return createCorsResponse(model, 201, req);
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
        newSuggestedRetail: 'new_suggested_retail',
        refurbActive: 'refurb_active',
        refurbDealerCost: 'refurb_dealer_cost',
        refurbRepMarkupPercentage: 'refurb_rep_markup_percentage',
        refurbRepCost: 'refurb_rep_cost',
        refurbSuggestedRetail: 'refurb_suggested_retail',
        demoActive: 'demo_active',
        demoDealerCost: 'demo_dealer_cost',
        demoRepMarkupPercentage: 'demo_rep_markup_percentage',
        demoRepCost: 'demo_rep_cost',
        demoSuggestedRetail: 'demo_suggested_retail',
        rentalActive: 'rental_active',
        rentalMonthlyRate: 'rental_monthly_rate',
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
