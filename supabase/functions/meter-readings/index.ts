// Meter Readings Edge Function
// Handles equipment meter readings for billing
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { applyUserScope, resolveScope } from '../_shared/scope.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /meter-readings, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'meter-readings');
    const readingId = parts[0];

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

      // Resolved BEFORE the readings query is built, so this handler still runs
      // one PostgREST chain at a time.
      //
      // A reading names its equipment, not its customer — meter_readings has no
      // customer_id column and no FK to business_records, so the old
      // .eq('customer_id') filter and the customer embed were both errors that
      // took the whole list query down. equipment.customer_id is the real link.
      let customerEquipmentIds: string[] | null = null;
      if (customerId) {
        const { data: customerEquipment } = await admin
          .from('equipment')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('customer_id', customerId);
        customerEquipmentIds = (customerEquipment ?? []).map((e: { id: string }) => e.id);
        if (customerEquipmentIds.length === 0) {
          return createCorsResponse({ data: [], total: 0, page, limit }, 200, req);
        }
      }

      let query = admin
        .from('meter_readings')
        .select(
          `
          *,
          equipment:equipment(id, serial_number, model_number, manufacturer, customer_id),
          created_by_user:users!meter_readings_created_by_fkey(id, first_name, last_name)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('reading_date', { ascending: false })
        .range(offset, offset + limit - 1);

      // WF-R-04. A reading names a user twice - the technician who took it and
      // whoever entered it - and either makes it theirs. Readings with neither
      // set stay visible above `own` scope: an import fills this table and its
      // rows carry no person at all.
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
      });
      query = applyUserScope(query, ['technician_id', 'created_by'], scope);

      if (equipmentId) {
        query = query.eq('equipment_id', equipmentId);
      }

      if (customerEquipmentIds) {
        query = query.in('equipment_id', customerEquipmentIds);
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

      // MeterReadings.tsx posts bwMeterReading / colorMeterReading (the real
      // column names, per the BATCH 8 page fix); blackCount / colorCount are the
      // older shape and are still accepted.
      const blackReading = body.bwMeterReading ?? body.blackCount ?? body.black_count ?? 0;
      const colorReading = body.colorMeterReading ?? body.colorCount ?? body.color_count ?? 0;

      if (body.previousBlackReading !== undefined) {
        blackUsage = blackReading - body.previousBlackReading;
      }

      if (body.previousColorReading !== undefined) {
        colorUsage = colorReading - body.previousColorReading;
      }

      // Six of the eight names this payload used were not columns —
      // customer_id, black_count, color_count, black_usage, color_usage and
      // reading_type — so every create was a 42703. Only customer_id was visible
      // to check:phantom-cols, because the payload is a named variable. The real
      // meter columns are bw_/color_meter_reading, the deltas are
      // black_/color_copies, the previous readings have their own columns, and
      // the how-collected field is reading_method.
      const readingData = {
        tenant_id: tenantId,
        equipment_id: body.equipmentId || body.equipment_id,
        contract_id: body.contractId ?? body.contract_id ?? null,
        reading_date: body.readingDate || body.reading_date || new Date().toISOString(),
        bw_meter_reading: blackReading,
        color_meter_reading: colorReading,
        previous_black_meter: body.previousBlackReading ?? null,
        previous_color_meter: body.previousColorReading ?? null,
        black_copies: blackUsage || 0,
        color_copies: colorUsage || 0,
        reading_method: body.readingType || body.reading_type || body.readingMethod || 'manual',
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
