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

    // tenantId gates access only. oid_mappings is a SHARED reference catalogue
    // with no tenant_id column, so nothing below is tenant-scoped; is_custom is
    // what separates user-authored rows from the shipped presets.
    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /oid-mappings, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'oid-mappings');
    const mappingId = parts[0]; // /oid-mappings/:id
    const subResource = parts[1];

    // GET /oid-mappings - List all OID mappings
    if (req.method === 'GET' && !mappingId) {
      const manufacturer = url.searchParams.get('manufacturer');
      const search = url.searchParams.get('search');

      // oid_mappings is a per-manufacturer BUNDLE: one row carries a whole
      // `oids` jsonb map ({ tonerBlack: '1.3.6.1...', totalCounter: '...' }).
      // This handler was written for a flat one-row-per-OID table with
      // name/oid/category/unit/data_type columns, none of which exist, so
      // ordering, filtering and searching were all 42703s. OidManagement.tsx
      // already speaks the real shape (manufacturer/modelSeries/mappingName/
      // oids/isDefault/isCustom), which is what this now serves.
      let query = admin.from('oid_mappings').select('*').order('mapping_name', { ascending: true });

      if (manufacturer) query = query.eq('manufacturer', manufacturer);
      if (search) {
        const safe = search.replace(/[,()]/g, ' ').trim();
        if (safe) {
          query = query.or(
            `mapping_name.ilike.%${safe}%,manufacturer.ilike.%${safe}%,model_series.ilike.%${safe}%`,
          );
        }
      }

      const { data: mappings, error } = await query;

      if (error) {
        console.error('Error fetching OID mappings:', error);
        return createCorsResponse({ error: 'Failed to fetch OID mappings' }, 500, req);
      }

      return createCorsResponse(mappings || [], 200, req);
    }

    // GET /oid-mappings/categories - no such axis on this table.
    //
    // There is no category column; mappings are grouped by manufacturer and
    // model_series. This returned [] rather than erroring, which reads as "no
    // categories exist" instead of "categories are not a thing here".
    if (req.method === 'GET' && mappingId === 'categories') {
      return createCorsResponse(
        {
          error: 'OID mappings are not categorised',
          code: 'OID_MAPPINGS_HAVE_NO_CATEGORY',
          details:
            'oid_mappings groups by manufacturer and model_series. Use /oid-mappings/manufacturers.',
        },
        501,
        req,
      );
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

      // There is no `oid` column to match on — each row holds an `oids` jsonb
      // MAP, so a reverse lookup means finding the row whose map contains this
      // value. PostgREST cannot express that, so the scan happens here.
      const { data: allMappings, error } = await admin.from('oid_mappings').select('*');

      if (error) {
        return createCorsResponse({ oid, name: 'Unknown', found: false }, 200, req);
      }

      for (const mapping of allMappings ?? []) {
        const oids = (mapping.oids ?? {}) as Record<string, string>;
        const key = Object.keys(oids).find((k) => oids[k] === oid);
        if (key) {
          // `name` is the key inside the bundle that carries this OID, which is
          // the closest thing this table has to the old flat name column.
          return createCorsResponse({ ...mapping, name: key, found: true }, 200, req);
        }
      }

      return createCorsResponse({ oid, name: 'Unknown', found: false }, 200, req);
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

    // POST /oid-mappings - Create new OID mapping
    if (req.method === 'POST' && !mappingId) {
      const body = await req.json();

      // Every name in the old payload was a phantom except manufacturer and
      // description. Note created_by: it is an INTEGER user_id column, and this
      // handler only has a Supabase UUID, so it is left null rather than
      // stuffed with a value of the wrong type.
      const mappingData = {
        manufacturer: body.manufacturer,
        model_series: body.modelSeries ?? body.model_series ?? null,
        mapping_name: body.mappingName ?? body.mapping_name ?? body.name,
        oids: body.oids ?? {},
        description: body.description ?? null,
        is_default: body.isDefault ?? body.is_default ?? false,
        // Anything created through this endpoint is user-authored by definition.
        is_custom: true,
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

      // CR-002 intended to stop one tenant overwriting another's mapping by
      // scoping to tenant_id. oid_mappings HAS NO tenant_id column, so that
      // filter was a 42703 and the protection it describes never existed — the
      // update simply always failed. This table is a shared reference catalogue
      // (manufacturer OID bundles) with an explicit is_custom flag, so the
      // guard that IS available is refusing to touch the shipped presets.
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const editable: Record<string, string> = {
        manufacturer: 'manufacturer',
        modelSeries: 'model_series',
        model_series: 'model_series',
        mappingName: 'mapping_name',
        mapping_name: 'mapping_name',
        oids: 'oids',
        description: 'description',
        isDefault: 'is_default',
        is_default: 'is_default',
      };
      for (const [key, col] of Object.entries(editable)) {
        if (body[key] !== undefined) updateData[col] = body[key];
      }

      const { data: mapping, error } = await admin
        .from('oid_mappings')
        .update(updateData)
        .eq('id', mappingId)
        .eq('is_custom', true)
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
      // Same as the update above: there is no tenant_id to scope by, so the
      // available guard is is_custom — system presets are not deletable.
      const { error } = await admin
        .from('oid_mappings')
        .delete()
        .eq('id', mappingId)
        .eq('is_custom', true);

      if (error) {
        console.error('Error deleting OID mapping:', error);
        return createCorsResponse({ error: 'Failed to delete OID mapping' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'OID mapping deleted' }, 200, req);
    }

    // POST /oid-mappings/bulk - Bulk import OID mappings
    if (req.method === 'POST' && mappingId === 'bulk') {
      const body = await req.json();
      const { mappings } = body;

      if (!Array.isArray(mappings)) {
        return createCorsResponse({ error: 'mappings array required' }, 400, req);
      }

      const mappingsData = mappings.map((m: any) => ({
        manufacturer: m.manufacturer,
        model_series: m.modelSeries ?? m.model_series ?? null,
        mapping_name: m.mappingName ?? m.mapping_name ?? m.name,
        oids: m.oids ?? {},
        description: m.description ?? null,
        is_default: m.isDefault ?? m.is_default ?? false,
        is_custom: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Plain insert, not upsert: the old onConflict: 'oid' named a column that
      // does not exist, and there is no unique key on this table to conflict on.
      const { data: inserted, error } = await admin
        .from('oid_mappings')
        .insert(mappingsData)
        .select();

      if (error) {
        console.error('Error bulk importing OID mappings:', error);
        return createCorsResponse({ error: 'Failed to import OID mappings' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          imported: inserted?.length || 0,
          mappings: inserted,
        },
        201,
        req,
      );
    }

    // POST /oid-mappings/export (EDGE-002h)
    //
    // OidManagement.tsx posts { manufacturer? } and downloads the result. This
    // is the same read as the list endpoint, optionally narrowed - kept as POST
    // because that is what the page sends.
    if (req.method === 'POST' && mappingId === 'export') {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      let query = admin.from('oid_mappings').select('*').order('manufacturer', { ascending: true });
      if (body.manufacturer) query = query.eq('manufacturer', body.manufacturer as string);

      const { data: mappings, error } = await query;

      if (error) {
        console.error('Error exporting OID mappings:', error);
        return createCorsResponse({ error: 'Failed to export OID mappings' }, 500, req);
      }

      return createCorsResponse(
        {
          exportedAt: new Date().toISOString(),
          manufacturer: (body.manufacturer as string) ?? null,
          count: (mappings ?? []).length,
          mappings: mappings ?? [],
        },
        200,
        req,
      );
    }

    // POST /oid-mappings/import
    //
    // The page posts { mappings[], overwriteExisting }. Without the flag this
    // is the same insert as /bulk; with it, an existing row for the same
    // manufacturer + mapping_name is replaced rather than duplicated. There is
    // no unique key on this table, so the replace is an explicit delete before
    // insert rather than an upsert.
    if (req.method === 'POST' && mappingId === 'import') {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      const incoming = body.mappings;

      if (!Array.isArray(incoming)) {
        return createCorsResponse({ error: 'mappings array required' }, 400, req);
      }

      const overwrite = Boolean(body.overwriteExisting);
      const now = new Date().toISOString();

      const rows = incoming.map((m: any) => ({
        manufacturer: m.manufacturer,
        model_series: m.modelSeries ?? m.model_series ?? null,
        mapping_name: m.mappingName ?? m.mapping_name ?? m.name,
        oids: m.oids ?? {},
        description: m.description ?? null,
        is_default: m.isDefault ?? m.is_default ?? false,
        is_custom: true,
        created_at: now,
        updated_at: now,
      }));

      let replaced = 0;
      if (overwrite) {
        for (const row of rows) {
          if (!row.manufacturer || !row.mapping_name) continue;
          // Only user-authored rows are replaceable; shipped presets are not,
          // matching the guard on update and delete.
          const { data: removed } = await admin
            .from('oid_mappings')
            .delete()
            .eq('manufacturer', row.manufacturer)
            .eq('mapping_name', row.mapping_name)
            .eq('is_custom', true)
            .select('id');
          replaced += (removed ?? []).length;
        }
      }

      const { data: inserted, error } = await admin.from('oid_mappings').insert(rows).select();

      if (error) {
        console.error('Error importing OID mappings:', error);
        return createCorsResponse(
          { error: 'Failed to import OID mappings', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse(
        { success: true, imported: (inserted ?? []).length, replaced, mappings: inserted },
        201,
        req,
      );
    }

    // POST /oid-mappings/test - NOT POSSIBLE FROM AN EDGE FUNCTION.
    //
    // The page posts { ipAddress, oids, snmpCommunity, snmpVersion } and expects
    // each OID to be polled against that device. That is an SNMP walk: UDP to
    // port 161 on a host inside the customer's network. Edge functions get
    // outbound HTTP(S) only, and the device is not reachable from the internet
    // anyway - this needs the on-prem monitoring agent, which is what
    // printyx-client exists for.
    //
    // Refusing beats both the 404 it returns today and any attempt to fake a
    // result, since the page reports a success RATE and a technician would act
    // on it.
    if (req.method === 'POST' && mappingId === 'test') {
      return createCorsResponse(
        {
          error: 'OID testing cannot run from an edge function',
          code: 'SNMP_REQUIRES_LOCAL_AGENT',
          details:
            'Testing an OID means an SNMP request over UDP/161 to a device on the customer ' +
            'network. Edge functions have outbound HTTP(S) only and no route to that host. The ' +
            'on-prem monitoring agent (printyx-client) is the component that can poll it.',
        },
        501,
        req,
      );
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
