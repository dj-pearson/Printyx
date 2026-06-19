// Equipment Edge Function
// Handles equipment/assets management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

// Helper: Batch-enrich records with customer names from business_records
async function enrichWithCustomerNames(admin: any, records: any[]) {
  if (!records || records.length === 0) return records;
  const customerIds = [...new Set(records.map((r: any) => r.customer_id).filter(Boolean))];
  if (customerIds.length === 0) return records;

  const { data: customers } = await admin
    .from('business_records')
    .select('id, company_name, primary_contact_name')
    .in('id', customerIds);

  const customerMap = new Map<string, any>((customers || []).map((c: any) => [c.id, c]));
  return records.map((r: any) => ({
    ...r,
    customer_name: customerMap.get(r.customer_id)?.company_name || null,
    customer: customerMap.get(r.customer_id) || null,
  }));
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt: string | undefined = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

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
    const { parts } = normalizePath(url.pathname, 'equipment');
    const equipmentId = parts[0];
    const subResource = parts[1];

    // GET /equipment/:id/meter-readings - Meter reading history for one machine.
    // Frontend (components/customer/CustomerEquipment.tsx) reads camelCase:
    // { id, equipmentId, readingDate, currentMeterCount, previousMeterCount,
    //   printVolume, colorPages, blackWhitePages, readingType }
    if (req.method === 'GET' && equipmentId && subResource === 'meter-readings') {
      const { data: readings, error } = await admin
        .from('meter_readings')
        .select('*')
        .eq('equipment_id', equipmentId)
        .eq('tenant_id', tenantId)
        .order('reading_date', { ascending: false })
        .limit(50);

      if (error) {
        // Table/columns missing — degrade to empty so the dialog renders cleanly.
        console.error('Error fetching meter readings:', error);
        return createCorsResponse([], 200, req);
      }

      const mapped = ((readings || []) as any[]).map((r) => {
        const bw = num(r.bw_meter_reading);
        const color = num(r.color_meter_reading);
        const prevBw = num(r.previous_black_meter);
        const prevColor = num(r.previous_color_meter);
        const blackCopies = num(r.black_copies);
        const colorCopies = num(r.color_copies);
        return {
          id: r.id,
          equipmentId: r.equipment_id,
          readingDate: r.reading_date,
          currentMeterCount: bw + color,
          previousMeterCount: prevBw + prevColor,
          printVolume: blackCopies + colorCopies,
          colorPages: colorCopies,
          blackWhitePages: blackCopies,
          readingType: r.reading_method || r.collection_method || 'manual',
        };
      });

      return createCorsResponse(mapped, 200, req);
    }

    // GET /equipment/:id/status - Real-time-ish status poll for one machine.
    // Frontend (hooks/useRealTimeData.ts useEquipmentStatus) just consumes JSON;
    // there is no dedicated equipment-status/IoT table keyed by equipment.id, so
    // we DERIVE status from the equipment row + latest meter reading.
    if (req.method === 'GET' && equipmentId && subResource === 'status') {
      const { data: eq, error } = await admin
        .from('equipment')
        .select('id, equipment_status, last_service_date, next_service_due_date, updated_at')
        .eq('id', equipmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !eq) {
        // No row / table drift — degrade honestly with an "unknown" status payload.
        return createCorsResponse(
          {
            equipmentId,
            status: 'unknown',
            online: false,
            lastReadingDate: null,
            currentMeterCount: null,
            lastUpdated: new Date().toISOString(),
            degraded: true,
          },
          200,
          req,
        );
      }

      const { data: latest } = await admin
        .from('meter_readings')
        .select('reading_date, bw_meter_reading, color_meter_reading')
        .eq('equipment_id', equipmentId)
        .eq('tenant_id', tenantId)
        .order('reading_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const status = (eq as any).equipment_status || 'unknown';
      const lr = latest as any;

      return createCorsResponse(
        {
          equipmentId: (eq as any).id,
          status,
          online: status === 'active',
          lastServiceDate: (eq as any).last_service_date || null,
          nextServiceDueDate: (eq as any).next_service_due_date || null,
          lastReadingDate: lr?.reading_date || null,
          currentMeterCount: lr ? num(lr.bw_meter_reading) + num(lr.color_meter_reading) : null,
          lastUpdated: (eq as any).updated_at || new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // GET /equipment - List equipment
    if (req.method === 'GET' && !equipmentId) {
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const status = url.searchParams.get('status');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = (page - 1) * limit;

      let query = admin
        .from('equipment')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('install_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (status) {
        query = query.eq('equipment_status', status);
      }

      if (search) {
        query = query.or(
          `serial_number.ilike.%${search}%,model_number.ilike.%${search}%,manufacturer.ilike.%${search}%,asset_tag.ilike.%${search}%`,
        );
      }

      const { data: equipment, error, count } = await query;

      if (error) {
        console.error('Error fetching equipment:', error);
        return createCorsResponse({ error: 'Failed to fetch equipment' }, 500, req);
      }

      // Enrich with customer names
      const enriched = await enrichWithCustomerNames(admin, equipment || []);
      return createCorsResponse(
        {
          data: enriched,
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /equipment/:id - Get single equipment
    if (req.method === 'GET' && equipmentId) {
      const { data: equipmentData, error } = await admin
        .from('equipment')
        .select('*')
        .eq('id', equipmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching equipment:', error);
        return createCorsResponse({ error: 'Equipment not found' }, 404, req);
      }

      // Enrich with customer info
      let equipment = equipmentData;
      if (equipmentData?.customer_id) {
        const { data: customer } = await admin
          .from('business_records')
          .select(
            'id, company_name, primary_contact_name, primary_contact_email, primary_contact_phone, address_line1, city, state',
          )
          .eq('id', equipmentData.customer_id)
          .single();
        equipment = { ...equipmentData, customer: customer || null };
      }

      // Get service history
      const { data: serviceHistory } = await admin
        .from('service_tickets')
        .select('id, ticket_number, status, created_at, resolved_at')
        .eq('equipment_id', equipmentId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      return createCorsResponse({ ...equipment, serviceHistory: serviceHistory || [] }, 200, req);
    }

    // POST /equipment - Create equipment
    if (req.method === 'POST') {
      const body = await req.json();

      const equipmentData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        serial_number: body.serialNumber || body.serial_number,
        model_number: body.modelNumber || body.model_number || null,
        manufacturer: body.manufacturer || null,
        description: body.description || null,
        asset_tag: body.assetTag || body.asset_tag || null,
        location_description: body.locationDescription || body.location_description || null,
        install_date: body.installDate || body.install_date || null,
        ip_address: body.ipAddress || body.ip_address || null,
        meter_type: body.meterType || body.meter_type || null,
        is_color_capable:
          body.isColorCapable !== undefined
            ? body.isColorCapable
            : body.is_color_capable !== undefined
              ? body.is_color_capable
              : false,
        equipment_status: body.equipmentStatus || body.equipment_status || 'active',
        purchase_price: body.purchasePrice || body.purchase_price || null,
        monthly_payment: body.monthlyPayment || body.monthly_payment || null,
        lease_expires_date: body.leaseExpiresDate || body.lease_expires_date || null,
        warranty_expires_date: body.warrantyExpiresDate || body.warranty_expires_date || null,
        service_contract_number: body.serviceContractNumber || body.service_contract_number || null,
        last_service_date: body.lastServiceDate || body.last_service_date || null,
        next_service_due_date: body.nextServiceDueDate || body.next_service_due_date || null,
        external_equipment_id: body.externalEquipmentId || body.external_equipment_id || null,
        external_customer_id: body.externalCustomerId || body.external_customer_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: equipment, error } = await admin
        .from('equipment')
        .insert(equipmentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating equipment:', error);
        return createCorsResponse(
          { error: 'Failed to create equipment', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(equipment, 201, req);
    }

    // PATCH /equipment/:id - Update equipment
    if ((req.method === 'PATCH' || req.method === 'PUT') && equipmentId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        customerId: 'customer_id',
        serialNumber: 'serial_number',
        modelNumber: 'model_number',
        manufacturer: 'manufacturer',
        description: 'description',
        assetTag: 'asset_tag',
        locationDescription: 'location_description',
        installDate: 'install_date',
        ipAddress: 'ip_address',
        meterType: 'meter_type',
        isColorCapable: 'is_color_capable',
        equipmentStatus: 'equipment_status',
        purchasePrice: 'purchase_price',
        monthlyPayment: 'monthly_payment',
        leaseExpiresDate: 'lease_expires_date',
        warrantyExpiresDate: 'warranty_expires_date',
        serviceContractNumber: 'service_contract_number',
        lastServiceDate: 'last_service_date',
        nextServiceDueDate: 'next_service_due_date',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: equipment, error } = await admin
        .from('equipment')
        .update(updateData)
        .eq('id', equipmentId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating equipment:', error);
        return createCorsResponse({ error: 'Failed to update equipment' }, 500, req);
      }

      return createCorsResponse(equipment, 200, req);
    }

    // DELETE /equipment/:id - Delete equipment
    if (req.method === 'DELETE' && equipmentId) {
      const { error } = await admin
        .from('equipment')
        .delete()
        .eq('id', equipmentId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting equipment:', error);
        return createCorsResponse({ error: 'Failed to delete equipment' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Equipment deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in equipment function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
