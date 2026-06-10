// Product Accessories Edge Function
// Handles CRUD operations for product accessories
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Check for special routes like /by-model/:modelId
    const isModelRoute = pathParts[1] === 'by-model';
    const accessoryId = !isModelRoute ? pathParts[1] : null;
    const modelId = isModelRoute ? pathParts[2] : null;

    // GET /product-accessories/by-model/:modelId - Get accessories for a specific product model
    if (req.method === 'GET' && isModelRoute && modelId) {
      // Query the accessory_model_compatibility junction table
      const { data: compatibilities, error: compatError } = await admin
        .from('accessory_model_compatibility')
        .select(
          `
          id,
          is_required,
          is_optional,
          installation_notes,
          accessory:product_accessories(*)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('model_id', modelId);

      if (compatError) {
        console.error('Error fetching accessories by model:', compatError);
        return createCorsResponse({ error: compatError.message }, 500, req);
      }

      // Flatten the response to return accessories with compatibility info
      const accessories = (compatibilities || []).map((c: any) => ({
        ...c.accessory,
        isRequired: c.is_required,
        isOptional: c.is_optional,
        installationNotes: c.installation_notes,
        compatibilityId: c.id,
      }));

      return createCorsResponse({ data: accessories, total: accessories.length }, 200, req);
    }

    // GET /product-accessories - List accessories with filtering and pagination
    if (req.method === 'GET' && !accessoryId) {
      const productModelId =
        url.searchParams.get('productModelId') || url.searchParams.get('product_model_id');
      const category = url.searchParams.get('category');
      const accessoryType =
        url.searchParams.get('accessoryType') || url.searchParams.get('accessory_type');
      const manufacturer = url.searchParams.get('manufacturer');
      const search = url.searchParams.get('search');
      const isActive = url.searchParams.get('isActive') || url.searchParams.get('is_active');
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
      // QUOTE-011: cap limit (was uncapped) to protect the function.
      const limit = Math.min(
        Math.max(1, parseInt(url.searchParams.get('limit') || '100') || 100),
        200,
      );
      const offset = (page - 1) * limit;

      let query = admin
        .from('product_accessories')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('accessory_name', { ascending: true })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (category) {
        query = query.eq('category', category);
      }

      if (accessoryType) {
        query = query.eq('accessory_type', accessoryType);
      }

      if (manufacturer) {
        query = query.eq('manufacturer', manufacturer);
      }

      if (isActive !== null && isActive !== undefined) {
        query = query.eq('is_active', isActive === 'true');
      }

      if (search) {
        const safe = search.replace(/[,()]/g, ' ').trim();
        if (safe) {
          query = query.or(
            `accessory_code.ilike.%${safe}%,accessory_name.ilike.%${safe}%,description.ilike.%${safe}%,manufacturer.ilike.%${safe}%`,
          );
        }
      }

      const { data: accessories, error, count } = await query;

      if (error) {
        console.error('Error fetching product accessories:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      // If productModelId filter is specified, also get compatibility info
      let result = accessories || [];
      if (productModelId && result.length > 0) {
        const accessoryIds = result.map((a: any) => a.id);
        const { data: compatibilities } = await admin
          .from('accessory_model_compatibility')
          .select('accessory_id, is_required, is_optional')
          .eq('tenant_id', tenantId)
          .eq('model_id', productModelId)
          .in('accessory_id', accessoryIds);

        const compatMap = new Map((compatibilities || []).map((c: any) => [c.accessory_id, c]));

        result = result.map((acc: any) => ({
          ...acc,
          compatibility: compatMap.get(acc.id) || null,
        }));
      }

      return createCorsResponse(
        {
          data: result,
          total: count || 0,
          page,
          limit,
          // QUOTE-011: standard envelope alongside the legacy flat fields.
          pagination: { page, limit, total: count || 0 },
        },
        200,
        req,
      );
    }

    // GET /product-accessories/:id - Get single accessory
    if (req.method === 'GET' && accessoryId) {
      const { data: accessory, error } = await admin
        .from('product_accessories')
        .select('*')
        .eq('id', accessoryId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching product accessory:', error);
        return createCorsResponse({ error: error.message }, 404, req);
      }

      // Get compatible models for this accessory
      const { data: compatibilities } = await admin
        .from('accessory_model_compatibility')
        .select(
          `
          id,
          model_id,
          is_required,
          is_optional,
          installation_notes,
          model:product_models(id, product_code, product_name, manufacturer)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('accessory_id', accessoryId);

      return createCorsResponse(
        {
          ...accessory,
          compatibleModels: compatibilities || [],
        },
        200,
        req,
      );
    }

    // POST /product-accessories - Create new accessory
    if (req.method === 'POST') {
      const body = await req.json();

      // Map camelCase fields to snake_case for database
      const dbData: Record<string, any> = {
        tenant_id: tenantId,
        accessory_code: body.accessoryCode || body.accessory_code,
        accessory_name: body.accessoryName || body.accessory_name,
        accessory_type: body.accessoryType || body.accessory_type || null,
        category: body.category || null,
        manufacturer: body.manufacturer || null,
        description: body.description || null,

        // Standard Tier Pricing
        standard_cost: body.standardCost || body.standard_cost || null,
        standard_dealer_cost: body.standardDealerCost || body.standard_dealer_cost || null,
        standard_rep_markup_percentage:
          body.standardRepMarkupPercentage || body.standard_rep_markup_percentage || null,
        standard_rep_cost: body.standardRepCost || body.standard_rep_cost || null,
        standard_rep_price: body.standardRepPrice || body.standard_rep_price || null,
        standard_suggested_retail:
          body.standardSuggestedRetail || body.standard_suggested_retail || null,

        // New Tier Pricing
        new_cost: body.newCost || body.new_cost || null,
        new_dealer_cost: body.newDealerCost || body.new_dealer_cost || null,
        new_rep_markup_percentage:
          body.newRepMarkupPercentage || body.new_rep_markup_percentage || null,
        new_rep_cost: body.newRepCost || body.new_rep_cost || null,
        new_rep_price: body.newRepPrice || body.new_rep_price || null,
        new_suggested_retail: body.newSuggestedRetail || body.new_suggested_retail || null,

        // Upgrade Tier Pricing
        upgrade_cost: body.upgradeCost || body.upgrade_cost || null,
        upgrade_dealer_cost: body.upgradeDealerCost || body.upgrade_dealer_cost || null,
        upgrade_rep_markup_percentage:
          body.upgradeRepMarkupPercentage || body.upgrade_rep_markup_percentage || null,
        upgrade_rep_cost: body.upgradeRepCost || body.upgrade_rep_cost || null,
        upgrade_rep_price: body.upgradeRepPrice || body.upgrade_rep_price || null,
        upgrade_suggested_retail:
          body.upgradeSuggestedRetail || body.upgrade_suggested_retail || null,

        // Status and Requirements
        is_active:
          body.isActive !== undefined
            ? body.isActive
            : body.is_active !== undefined
              ? body.is_active
              : true,
        available_for_all:
          body.availableForAll !== undefined
            ? body.availableForAll
            : body.available_for_all !== undefined
              ? body.available_for_all
              : false,
        sales_rep_credit:
          body.salesRepCredit !== undefined
            ? body.salesRepCredit
            : body.sales_rep_credit !== undefined
              ? body.sales_rep_credit
              : false,
        funding: body.funding !== undefined ? body.funding : false,
        lease: body.lease !== undefined ? body.lease : false,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Validate required fields
      if (!dbData.accessory_code || !dbData.accessory_name) {
        return createCorsResponse(
          { error: 'accessoryCode and accessoryName are required' },
          400,
          req,
        );
      }

      const { data: newAccessory, error } = await admin
        .from('product_accessories')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        console.error('Error creating product accessory:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(newAccessory, 201, req);
    }

    // PUT/PATCH /product-accessories/:id - Update accessory
    if ((req.method === 'PUT' || req.method === 'PATCH') && accessoryId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Field mapping from camelCase to snake_case
      const fieldMap: Record<string, string> = {
        accessoryCode: 'accessory_code',
        accessoryName: 'accessory_name',
        accessoryType: 'accessory_type',
        category: 'category',
        manufacturer: 'manufacturer',
        description: 'description',

        // Standard Tier
        standardCost: 'standard_cost',
        standardDealerCost: 'standard_dealer_cost',
        standardRepMarkupPercentage: 'standard_rep_markup_percentage',
        standardRepCost: 'standard_rep_cost',
        standardRepPrice: 'standard_rep_price',
        standardSuggestedRetail: 'standard_suggested_retail',

        // New Tier
        newCost: 'new_cost',
        newDealerCost: 'new_dealer_cost',
        newRepMarkupPercentage: 'new_rep_markup_percentage',
        newRepCost: 'new_rep_cost',
        newRepPrice: 'new_rep_price',
        newSuggestedRetail: 'new_suggested_retail',

        // Upgrade Tier
        upgradeCost: 'upgrade_cost',
        upgradeDealerCost: 'upgrade_dealer_cost',
        upgradeRepMarkupPercentage: 'upgrade_rep_markup_percentage',
        upgradeRepCost: 'upgrade_rep_cost',
        upgradeRepPrice: 'upgrade_rep_price',
        upgradeSuggestedRetail: 'upgrade_suggested_retail',

        // Status and Requirements
        isActive: 'is_active',
        availableForAll: 'available_for_all',
        salesRepCredit: 'sales_rep_credit',
        funding: 'funding',
        lease: 'lease',
      };

      // Map camelCase to snake_case for update
      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined) {
          updateData[snakeKey] = body[camelKey];
        } else if (body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[snakeKey];
        }
      }

      const { data: updatedAccessory, error } = await admin
        .from('product_accessories')
        .update(updateData)
        .eq('id', accessoryId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating product accessory:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse(updatedAccessory, 200, req);
    }

    // DELETE /product-accessories/:id - Delete accessory
    if (req.method === 'DELETE' && accessoryId) {
      // First, delete any compatibility records
      const { error: compatError } = await admin
        .from('accessory_model_compatibility')
        .delete()
        .eq('accessory_id', accessoryId)
        .eq('tenant_id', tenantId);

      if (compatError) {
        console.error('Error deleting compatibility records:', compatError);
        // Continue with accessory deletion even if compatibility deletion fails
      }

      const { error } = await admin
        .from('product_accessories')
        .delete()
        .eq('id', accessoryId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting product accessory:', error);
        return createCorsResponse({ error: error.message }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Accessory deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return createCorsResponse({ error: error.message || 'Internal server error' }, 500, req);
  }
}
