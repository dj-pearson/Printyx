// Devices Edge Function
// Handles printer/equipment device management
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
    const deviceId = pathParts[1];
    const action = pathParts[2];

    // GET /devices - List devices
    if (req.method === 'GET' && !deviceId) {
      const customerId = url.searchParams.get('customerId');
      const status = url.searchParams.get('status');
      const manufacturer = url.searchParams.get('manufacturer');

      let query = admin
        .from('devices')
        .select(
          `
          *,
          customer:customer_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (customerId) query = query.eq('customer_id', customerId);
      if (status) query = query.eq('status', status);
      if (manufacturer) query = query.ilike('manufacturer', `%${manufacturer}%`);

      const { data: devices, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch devices' }, 500, req);
      }

      return createCorsResponse(devices || [], 200, req);
    }

    // GET /devices/:id - Get single device
    if (req.method === 'GET' && deviceId && !action) {
      const { data: device, error } = await admin
        .from('devices')
        .select(
          `
          *,
          customer:customer_id (*)
        `,
        )
        .eq('id', deviceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Device not found' }, 404, req);
      }

      return createCorsResponse(device, 200, req);
    }

    // POST /devices - Create device
    if (req.method === 'POST' && !deviceId) {
      const body = await req.json();

      const { data: device, error } = await admin
        .from('devices')
        .insert({
          tenant_id: tenantId,
          customer_id: body.customerId || body.customer_id,
          serial_number: body.serialNumber || body.serial_number,
          manufacturer: body.manufacturer,
          model: body.model,
          device_type: body.deviceType || body.device_type || 'printer',
          ip_address: body.ipAddress || body.ip_address,
          mac_address: body.macAddress || body.mac_address,
          location: body.location,
          status: body.status || 'active',
          installed_at: body.installedAt || body.installed_at,
          warranty_expiry: body.warrantyExpiry || body.warranty_expiry,
          contract_id: body.contractId || body.contract_id,
          metadata: body.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create device' }, 500, req);
      }

      return createCorsResponse(device, 201, req);
    }

    // PUT /devices/:id - Update device
    if (req.method === 'PUT' && deviceId && !action) {
      const body = await req.json();

      const { data: device, error } = await admin
        .from('devices')
        .update({
          customer_id: body.customerId || body.customer_id,
          serial_number: body.serialNumber || body.serial_number,
          manufacturer: body.manufacturer,
          model: body.model,
          ip_address: body.ipAddress || body.ip_address,
          mac_address: body.macAddress || body.mac_address,
          location: body.location,
          status: body.status,
          warranty_expiry: body.warrantyExpiry || body.warranty_expiry,
          contract_id: body.contractId || body.contract_id,
          metadata: body.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deviceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update device' }, 500, req);
      }

      return createCorsResponse(device, 200, req);
    }

    // GET /devices/:deviceId/metrics - Get device metrics
    if (req.method === 'GET' && deviceId && action === 'metrics') {
      const period = url.searchParams.get('period') || '7d';

      const { data: metrics, error } = await admin
        .from('device_metrics')
        .select('*')
        .eq('device_id', deviceId)
        .eq('tenant_id', tenantId)
        .order('collected_at', { ascending: false })
        .limit(1000);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch device metrics' }, 500, req);
      }

      return createCorsResponse(metrics || [], 200, req);
    }

    // POST /devices/:deviceId/collect - Trigger data collection
    if (req.method === 'POST' && deviceId && action === 'collect') {
      // In production, this would trigger SNMP collection or API call
      return createCorsResponse(
        {
          success: true,
          message: 'Data collection triggered',
          deviceId,
        },
        200,
        req,
      );
    }

    // POST /devices/:id/order-toner - Create toner order
    if (req.method === 'POST' && deviceId && action === 'order-toner') {
      const body = await req.json();

      const { data: order, error } = await admin
        .from('supply_orders')
        .insert({
          tenant_id: tenantId,
          device_id: deviceId,
          order_type: 'toner',
          items: body.items || [],
          status: 'pending',
          requested_by: user.id,
          notes: body.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create toner order' }, 500, req);
      }

      return createCorsResponse(order, 201, req);
    }

    // DELETE /devices/:id - Delete device
    if (req.method === 'DELETE' && deviceId) {
      const { error } = await admin
        .from('devices')
        .delete()
        .eq('id', deviceId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete device' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Device deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in devices function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
