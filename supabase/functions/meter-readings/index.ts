// Meter Readings Edge Function
// Handles equipment meter readings for billing
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
    const readingId = pathParts[1];

    // GET /meter-readings - List readings
    if (req.method === 'GET' && !readingId) {
      const equipmentId =
        url.searchParams.get('equipmentId') || url.searchParams.get('equipment_id');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const startDate = url.searchParams.get('startDate') || url.searchParams.get('start_date');
      const endDate = url.searchParams.get('endDate') || url.searchParams.get('end_date');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = (page - 1) * limit;

      let query = admin
        .from('meter_readings')
        .select(
          `
          *,
          equipment:equipment(id, serial_number, model_number, manufacturer),
          customer:business_records!meter_readings_customer_id_fkey(id, company_name),
          created_by_user:users!meter_readings_created_by_fkey(id, first_name, last_name)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('reading_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (equipmentId) {
        query = query.eq('equipment_id', equipmentId);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (startDate) {
        query = query.gte('reading_date', startDate);
      }

      if (endDate) {
        query = query.lte('reading_date', endDate);
      }

      const { data: readings, error, count } = await query;

      if (error) {
        console.error('Error fetching meter readings:', error);
        return createCorsResponse({ error: 'Failed to fetch meter readings' }, 500, req);
      }

      return createCorsResponse(
        {
          data: readings || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /meter-readings/:id - Get single reading
    if (req.method === 'GET' && readingId) {
      const { data: reading, error } = await admin
        .from('meter_readings')
        .select(
          `
          *,
          equipment:equipment(id, serial_number, model_number, manufacturer, customer_id),
          customer:business_records!meter_readings_customer_id_fkey(id, company_name, primary_contact_name),
          created_by_user:users!meter_readings_created_by_fkey(id, first_name, last_name, email)
        `,
        )
        .eq('id', readingId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching meter reading:', error);
        return createCorsResponse({ error: 'Meter reading not found' }, 404, req);
      }

      return createCorsResponse(reading, 200, req);
    }

    // POST /meter-readings - Create reading
    if (req.method === 'POST') {
      const body = await req.json();

      // Calculate usage if previous reading provided
      let blackUsage = body.blackUsage || body.black_usage;
      let colorUsage = body.colorUsage || body.color_usage;

      if (body.previousBlackReading !== undefined) {
        const currentBlack = body.blackCount || body.black_count || 0;
        blackUsage = currentBlack - body.previousBlackReading;
      }

      if (body.previousColorReading !== undefined) {
        const currentColor = body.colorCount || body.color_count || 0;
        colorUsage = currentColor - body.previousColorReading;
      }

      const readingData = {
        tenant_id: tenantId,
        equipment_id: body.equipmentId || body.equipment_id,
        customer_id: body.customerId || body.customer_id,
        reading_date: body.readingDate || body.reading_date || new Date().toISOString(),
        black_count: body.blackCount || body.black_count || 0,
        color_count: body.colorCount || body.color_count || 0,
        black_usage: blackUsage || 0,
        color_usage: colorUsage || 0,
        reading_type: body.readingType || body.reading_type || 'manual',
        notes: body.notes || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: reading, error } = await admin
        .from('meter_readings')
        .insert(readingData)
        .select()
        .single();

      if (error) {
        console.error('Error creating meter reading:', error);
        return createCorsResponse(
          { error: 'Failed to create meter reading', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(reading, 201, req);
    }

    // PATCH /meter-readings/:id - Update reading
    if ((req.method === 'PATCH' || req.method === 'PUT') && readingId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        readingDate: 'reading_date',
        blackCount: 'black_count',
        colorCount: 'color_count',
        blackUsage: 'black_usage',
        colorUsage: 'color_usage',
        readingType: 'reading_type',
        notes: 'notes',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: reading, error } = await admin
        .from('meter_readings')
        .update(updateData)
        .eq('id', readingId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating meter reading:', error);
        return createCorsResponse({ error: 'Failed to update meter reading' }, 500, req);
      }

      return createCorsResponse(reading, 200, req);
    }

    // DELETE /meter-readings/:id - Delete reading
    if (req.method === 'DELETE' && readingId) {
      const { error } = await admin
        .from('meter_readings')
        .delete()
        .eq('id', readingId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting meter reading:', error);
        return createCorsResponse({ error: 'Failed to delete meter reading' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Meter reading deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in meter-readings function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
