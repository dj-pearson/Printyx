// OID Mappings Edge Function
// Handles SNMP OID to human-readable name mappings for printer monitoring
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

    // Extract tenant ID from JWT metadata or header
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    // Coolify-safe routing: server.ts strips the function-name prefix, so
    // normalizePath gives parts[0] = first segment after /oid-mappings.
    const { parts } = normalizePath(url.pathname, 'oid-mappings');
    const mappingId = parts[0]; // /oid-mappings/:id  (or named route)
    const subResource = parts[1];

    // GET /oid-mappings - List all OID mappings
    if (req.method === 'GET' && !mappingId) {
      const category = url.searchParams.get('category');
      const manufacturer = url.searchParams.get('manufacturer');
      const search = url.searchParams.get('search');

      let query = admin.from('oid_mappings').select('*').order('name', { ascending: true });

      // OID mappings may be global or tenant-specific
      if (category) query = query.eq('category', category);
      if (manufacturer) query = query.eq('manufacturer', manufacturer);
      if (search) query = query.or(`name.ilike.%${search}%,oid.ilike.%${search}%`);

      const { data: mappings, error } = await query;

      if (error) {
        console.error('Error fetching OID mappings:', error);
        return createCorsResponse({ error: 'Failed to fetch OID mappings' }, 500, req);
      }

      return createCorsResponse(mappings || [], 200, req);
    }

    // GET /oid-mappings/categories - Get unique categories
    if (req.method === 'GET' && mappingId === 'categories') {
      const { data: categories } = await admin
        .from('oid_mappings')
        .select('category')
        .not('category', 'is', null);

      const uniqueCategories = [...new Set((categories || []).map((c: any) => c.category))];
      return createCorsResponse(uniqueCategories, 200, req);
    }

    // GET /oid-mappings/manufacturers - Get unique manufacturers
    if (req.method === 'GET' && mappingId === 'manufacturers') {
      const { data: manufacturers } = await admin
        .from('oid_mappings')
        .select('manufacturer')
        .not('manufacturer', 'is', null);

      const uniqueManufacturers = [
        ...new Set((manufacturers || []).map((m: any) => m.manufacturer)),
      ];
      return createCorsResponse(uniqueManufacturers, 200, req);
    }

    // GET /oid-mappings/lookup - Lookup OID by value
    if (req.method === 'GET' && mappingId === 'lookup') {
      const oid = url.searchParams.get('oid');
      if (!oid) {
        return createCorsResponse({ error: 'OID parameter required' }, 400, req);
      }

      const { data: mapping, error } = await admin
        .from('oid_mappings')
        .select('*')
        .eq('oid', oid)
        .single();

      if (error) {
        return createCorsResponse(
          {
            oid,
            name: 'Unknown',
            found: false,
          },
          200,
          req,
        );
      }

      return createCorsResponse({ ...mapping, found: true }, 200, req);
    }

    // GET /oid-mappings/:id - Get single mapping
    if (req.method === 'GET' && mappingId && !subResource) {
      const { data: mapping, error } = await admin
        .from('oid_mappings')
        .select('*')
        .eq('id', mappingId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'OID mapping not found' }, 404, req);
      }

      return createCorsResponse(mapping, 200, req);
    }

    // POST /oid-mappings/test - Test an OID mapping against a device
    // Live SNMP polling is not available in the Deno edge runtime, so this
    // returns a degrade-tolerant, shape-compatible result (per-OID statuses +
    // summary) that the OidManagement page renders.
    if (req.method === 'POST' && mappingId === 'test') {
      let body: any = {};
      try {
        body = await req.json();
      } catch (_e) {
        body = {};
      }

      const ipAddress = body.ipAddress || body.ip_address || null;
      const oids: Record<string, string> =
        body.oids && typeof body.oids === 'object' ? body.oids : {};
      const oidEntries = Object.entries(oids);

      const results: Record<string, any> = {};
      for (const [key, oid] of oidEntries) {
        results[key] = {
          oid: oid as string,
          status: 'error',
          value: null,
          error: 'Live SNMP polling is not available in this environment',
        };
      }

      const total = oidEntries.length;
      const successful = 0;
      const summary = {
        total,
        successful,
        failed: total - successful,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      };

      return createCorsResponse(
        {
          success: false,
          degraded: true,
          message: 'Live SNMP polling is not available in this environment',
          mappingId,
          ipAddress,
          results,
          summary,
          testedAt: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // POST /oid-mappings/export - Export the tenant's mappings as JSON
    if (req.method === 'POST' && mappingId === 'export') {
      let body: any = {};
      try {
        body = await req.json();
      } catch (_e) {
        body = {};
      }
      const manufacturer = body.manufacturer || url.searchParams.get('manufacturer');

      let query = admin.from('oid_mappings').select('*').order('name', { ascending: true });
      if (manufacturer) query = query.eq('manufacturer', manufacturer);

      const { data: exportMappings, error } = await query;

      if (error) {
        console.error('Error exporting OID mappings:', error);
        return createCorsResponse(
          {
            degraded: true,
            version: '1.0',
            exportedAt: new Date().toISOString(),
            count: 0,
            mappings: [],
          },
          200,
          req,
        );
      }

      return createCorsResponse(
        {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          count: exportMappings?.length || 0,
          mappings: exportMappings || [],
        },
        200,
        req,
      );
    }

    // POST /oid-mappings/import OR /oid-mappings/bulk - Bulk import OID mappings
    if (req.method === 'POST' && (mappingId === 'import' || mappingId === 'bulk')) {
      const body = await req.json();
      const mappings = body.mappings;

      if (!Array.isArray(mappings)) {
        return createCorsResponse({ error: 'mappings array required' }, 400, req);
      }

      const mappingsData = mappings.map((m: any) => ({
        oid: m.oid,
        name: m.name,
        description: m.description,
        category: m.category,
        manufacturer: m.manufacturer,
        data_type: m.dataType || m.data_type || 'string',
        unit: m.unit,
        is_global: m.isGlobal || m.is_global || false,
        tenant_id: m.isGlobal || m.is_global ? null : tenantId,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data: inserted, error } = await admin
        .from('oid_mappings')
        .upsert(mappingsData, { onConflict: 'oid' })
        .select();

      if (error) {
        console.error('Error importing OID mappings:', error);
        return createCorsResponse(
          {
            success: false,
            degraded: true,
            summary: { imported: 0, skipped: 0, errors: mappings.length },
            error: 'Failed to import OID mappings',
          },
          200,
          req,
        );
      }

      const importedCount = inserted?.length || 0;
      return createCorsResponse(
        {
          success: true,
          imported: importedCount,
          mappings: inserted,
          summary: {
            imported: importedCount,
            skipped: mappings.length - importedCount,
            errors: 0,
          },
        },
        201,
        req,
      );
    }

    // POST /oid-mappings - Create new OID mapping
    if (req.method === 'POST' && !mappingId) {
      const body = await req.json();

      const mappingData = {
        oid: body.oid,
        name: body.name,
        description: body.description,
        category: body.category,
        manufacturer: body.manufacturer,
        data_type: body.dataType || body.data_type || 'string',
        unit: body.unit,
        is_global: body.isGlobal || body.is_global || false,
        tenant_id: body.isGlobal ? null : tenantId,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: mapping, error } = await admin
        .from('oid_mappings')
        .insert(mappingData)
        .select()
        .single();

      if (error) {
        console.error('Error creating OID mapping:', error);
        return createCorsResponse(
          { error: 'Failed to create OID mapping', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(mapping, 201, req);
    }

    // PUT /oid-mappings/:id - Update OID mapping
    if (req.method === 'PUT' && mappingId && !subResource) {
      const body = await req.json();

      const { data: mapping, error } = await admin
        .from('oid_mappings')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mappingId)
        .select()
        .single();

      if (error) {
        console.error('Error updating OID mapping:', error);
        return createCorsResponse({ error: 'Failed to update OID mapping' }, 500, req);
      }

      return createCorsResponse(mapping, 200, req);
    }

    // DELETE /oid-mappings/:id - Delete OID mapping
    if (req.method === 'DELETE' && mappingId) {
      const { error } = await admin.from('oid_mappings').delete().eq('id', mappingId);

      if (error) {
        console.error('Error deleting OID mapping:', error);
        return createCorsResponse({ error: 'Failed to delete OID mapping' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'OID mapping deleted' }, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in oid-mappings function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
