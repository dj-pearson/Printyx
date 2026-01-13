// Territories Edge Function
// Handles sales territory management and assignment
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

const TERRITORY_TYPES = {
  geographic: {
    name: 'Geographic',
    description: 'Territory based on location (country, state, city, zip)',
  },
  industry: {
    name: 'Industry',
    description: 'Territory based on industry vertical',
  },
  account_size: {
    name: 'Account Size',
    description: 'Territory based on company size or revenue',
  },
  product_line: {
    name: 'Product Line',
    description: 'Territory based on product focus',
  },
  named_accounts: {
    name: 'Named Accounts',
    description: 'Specific accounts assigned to territory',
  },
};

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
    const territoryId = pathParts[1];
    const subResource = pathParts[2]; // 'types', 'stats', etc.

    // GET /territories/types - Get territory type definitions
    if (req.method === 'GET' && territoryId === 'types') {
      return createCorsResponse({ territoryTypes: TERRITORY_TYPES }, 200, req);
    }

    // GET /territories/stats - Get territory statistics
    if (req.method === 'GET' && territoryId === 'stats') {
      const { data: stats } = await admin
        .from('sales_territories')
        .select('territory_type, is_active')
        .eq('tenant_id', tenantId);

      const territoryStats = {
        total: stats?.length || 0,
        active: stats?.filter((t) => t.is_active).length || 0,
        inactive: stats?.filter((t) => !t.is_active).length || 0,
        byType: {} as Record<string, number>,
      };

      if (stats) {
        for (const stat of stats) {
          if (stat.territory_type) {
            territoryStats.byType[stat.territory_type] =
              (territoryStats.byType[stat.territory_type] || 0) + 1;
          }
        }
      }

      return createCorsResponse(territoryStats, 200, req);
    }

    // GET /territories - List territories with filters
    if (req.method === 'GET' && !territoryId) {
      const type = url.searchParams.get('type');
      const ownerId = url.searchParams.get('ownerId') || url.searchParams.get('owner_id');
      const isActive = url.searchParams.get('isActive') || url.searchParams.get('is_active');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '25');
      const offset = (page - 1) * limit;

      let query = admin
        .from('sales_territories')
        .select(
          `
          *,
          owner:users!sales_territories_owner_id_fkey(id, first_name, last_name, email)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false })
        .order('territory_name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (type) {
        query = query.eq('territory_type', type);
      }

      if (ownerId) {
        query = query.eq('owner_id', ownerId);
      }

      if (isActive !== null && isActive !== undefined) {
        query = query.eq('is_active', isActive === 'true');
      }

      if (search) {
        query = query.or(
          `territory_name.ilike.%${search}%,territory_code.ilike.%${search}%,description.ilike.%${search}%`,
        );
      }

      const { data: territories, error, count } = await query;

      if (error) {
        console.error('Error fetching territories:', error);
        return createCorsResponse({ error: 'Failed to fetch territories' }, 500, req);
      }

      return createCorsResponse(
        {
          territories: territories || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /territories/:id - Get single territory
    if (req.method === 'GET' && territoryId && territoryId !== 'types' && territoryId !== 'stats') {
      const { data: territory, error } = await admin
        .from('sales_territories')
        .select(
          `
          *,
          owner:users!sales_territories_owner_id_fkey(id, first_name, last_name, email, phone)
        `,
        )
        .eq('id', territoryId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching territory:', error);
        return createCorsResponse({ error: 'Territory not found' }, 404, req);
      }

      return createCorsResponse(territory, 200, req);
    }

    // POST /territories - Create new territory
    if (req.method === 'POST') {
      const body = await req.json();

      const territoryData = {
        tenant_id: tenantId,
        territory_name: body.territoryName || body.territory_name,
        territory_code: body.territoryCode || body.territory_code || null,
        description: body.description || null,
        territory_type: body.territoryType || body.territory_type || 'geographic',
        geographic_rules: body.geographicRules || body.geographic_rules || null,
        account_rules: body.accountRules || body.account_rules || null,
        product_focus: body.productFocus || body.product_focus || null,
        is_active:
          body.isActive !== undefined
            ? body.isActive
            : body.is_active !== undefined
              ? body.is_active
              : true,
        owner_id: body.ownerId || body.owner_id || user.id,
        priority: body.priority || 5,
        target_quota: body.targetQuota || body.target_quota || null,
        current_quota: body.currentQuota || body.current_quota || 0,
        active_leads_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: territory, error } = await admin
        .from('sales_territories')
        .insert(territoryData)
        .select()
        .single();

      if (error) {
        console.error('Error creating territory:', error);
        return createCorsResponse(
          { error: 'Failed to create territory', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(territory, 201, req);
    }

    // PUT /territories/:id - Update territory
    if ((req.method === 'PUT' || req.method === 'PATCH') && territoryId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map fields
      if (body.territoryName || body.territory_name)
        updateData.territory_name = body.territoryName || body.territory_name;
      if (body.territoryCode || body.territory_code !== undefined)
        updateData.territory_code = body.territoryCode || body.territory_code;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.territoryType || body.territory_type)
        updateData.territory_type = body.territoryType || body.territory_type;
      if (body.geographicRules || body.geographic_rules !== undefined)
        updateData.geographic_rules = body.geographicRules || body.geographic_rules;
      if (body.accountRules || body.account_rules !== undefined)
        updateData.account_rules = body.accountRules || body.account_rules;
      if (body.productFocus || body.product_focus !== undefined)
        updateData.product_focus = body.productFocus || body.product_focus;
      if (body.isActive !== undefined || body.is_active !== undefined)
        updateData.is_active = body.isActive !== undefined ? body.isActive : body.is_active;
      if (body.ownerId || body.owner_id) updateData.owner_id = body.ownerId || body.owner_id;
      if (body.priority !== undefined) updateData.priority = body.priority;
      if (body.targetQuota || body.target_quota !== undefined)
        updateData.target_quota = body.targetQuota || body.target_quota;
      if (body.currentQuota !== undefined || body.current_quota !== undefined)
        updateData.current_quota =
          body.currentQuota !== undefined ? body.currentQuota : body.current_quota;

      const { data: territory, error } = await admin
        .from('sales_territories')
        .update(updateData)
        .eq('id', territoryId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating territory:', error);
        return createCorsResponse({ error: 'Failed to update territory' }, 500, req);
      }

      return createCorsResponse(territory, 200, req);
    }

    // DELETE /territories/:id - Delete (soft delete by setting is_active = false)
    if (req.method === 'DELETE' && territoryId) {
      const { error } = await admin
        .from('sales_territories')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', territoryId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting territory:', error);
        return createCorsResponse({ error: 'Failed to delete territory' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Territory deactivated' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in territories function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
