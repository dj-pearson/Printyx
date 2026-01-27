// Locations Edge Function
// Handles company locations/branches management
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const locationId = pathParts[1];

    // GET /locations - List locations
    if (req.method === 'GET' && !locationId) {
      const isActive = url.searchParams.get('isActive') || url.searchParams.get('is_active');

      let query = admin
        .from('locations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (isActive !== null && isActive !== undefined) {
        query = query.eq('is_active', isActive === 'true');
      }

      const { data: locations, error } = await query;

      if (error) {
        console.error('Error fetching locations:', error);
        return createCorsResponse({ error: 'Failed to fetch locations' }, 500, req);
      }

      return createCorsResponse(locations || [], 200, req);
    }

    // GET /locations/:id - Get single location
    if (req.method === 'GET' && locationId) {
      const { data: location, error } = await admin
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching location:', error);
        return createCorsResponse({ error: 'Location not found' }, 404, req);
      }

      // Get user count at location
      const { data: users } = await admin
        .from('users')
        .select('id')
        .eq('location_id', locationId)
        .eq('tenant_id', tenantId);

      return createCorsResponse({ ...location, userCount: users?.length || 0 }, 200, req);
    }

    // POST /locations - Create location
    if (req.method === 'POST') {
      const body = await req.json();

      const locationData = {
        tenant_id: tenantId,
        name: body.name,
        code: body.code || null,
        address_line1: body.addressLine1 || body.address_line1 || null,
        address_line2: body.addressLine2 || body.address_line2 || null,
        city: body.city || null,
        state: body.state || null,
        postal_code: body.postalCode || body.postal_code || null,
        country: body.country || 'US',
        phone: body.phone || null,
        email: body.email || null,
        is_headquarters:
          body.isHeadquarters !== undefined
            ? body.isHeadquarters
            : body.is_headquarters !== undefined
              ? body.is_headquarters
              : false,
        is_active:
          body.isActive !== undefined
            ? body.isActive
            : body.is_active !== undefined
              ? body.is_active
              : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: location, error } = await admin
        .from('locations')
        .insert(locationData)
        .select()
        .single();

      if (error) {
        console.error('Error creating location:', error);
        return createCorsResponse({ error: 'Failed to create location', details: error }, 500, req);
      }

      return createCorsResponse(location, 201, req);
    }

    // PATCH /locations/:id - Update location
    if ((req.method === 'PATCH' || req.method === 'PUT') && locationId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        name: 'name',
        code: 'code',
        addressLine1: 'address_line1',
        addressLine2: 'address_line2',
        city: 'city',
        state: 'state',
        postalCode: 'postal_code',
        country: 'country',
        phone: 'phone',
        email: 'email',
        isHeadquarters: 'is_headquarters',
        isActive: 'is_active',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: location, error } = await admin
        .from('locations')
        .update(updateData)
        .eq('id', locationId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating location:', error);
        return createCorsResponse({ error: 'Failed to update location' }, 500, req);
      }

      return createCorsResponse(location, 200, req);
    }

    // DELETE /locations/:id - Delete location
    if (req.method === 'DELETE' && locationId) {
      // Check if location has users
      const { data: users } = await admin
        .from('users')
        .select('id')
        .eq('location_id', locationId)
        .eq('tenant_id', tenantId)
        .limit(1);

      if (users && users.length > 0) {
        return createCorsResponse(
          { error: 'Cannot delete location with assigned users. Please reassign users first.' },
          400,
          req,
        );
      }

      const { error } = await admin
        .from('locations')
        .delete()
        .eq('id', locationId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting location:', error);
        return createCorsResponse({ error: 'Failed to delete location' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Location deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in locations function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
