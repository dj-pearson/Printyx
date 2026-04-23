// Mileage — reports (mileage_reports), records (technician_mileage),
// vehicles (vehicle_assignments). Rates + IRS-log stubbed (no tables).
//
// Paths (dispatcher passes full parts starting with one of these):
//   /records[/...]       — technician_mileage
//   /auto-generate       — POST stub (GPS → records pipeline)
//   /summary             — aggregate across period
//   /reports[/...]       — mileage_reports CRUD + submit/approve/reject
//   /rates[/...]         — stub (no mileage_rates table)
//   /irs-log[/...]       — stub (no irs_mileage_log table)
//   /vehicles[/...]      — vehicle_assignments CRUD

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { dbErr } from '../_crud.ts';

export async function handleMileage(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];

  if (first === 'records') {
    return await handleRecords(req, { ...ctx, pathParts: pathParts.slice(1) });
  }

  if (first === 'auto-generate' && method === 'POST') {
    // Stub — would use location_history to synthesize mileage records.
    return jsonResponse(
      {
        stub: true,
        generated: 0,
        message:
          'GPS-to-mileage auto-generate needs location_history aggregation by day + tenant. Deferred to follow-up.',
      },
      200,
      req,
      requestId,
    );
  }

  if (first === 'summary' && method === 'GET') {
    const startDate = url.searchParams.get('startDate') ?? url.searchParams.get('start_date');
    const endDate = url.searchParams.get('endDate') ?? url.searchParams.get('end_date');
    let q = db.from('technician_mileage').select('*').eq('tenant_id', auth.tenantId);
    if (startDate) q = q.gte('date', startDate);
    if (endDate) q = q.lte('date', endDate);
    const { data, error } = await q.limit(10000);
    if (error) return dbErr(req, requestId, 'Failed to fetch summary', error);
    const rows = (data ?? []) as Array<{
      total_miles: string | null;
      business_miles: string | null;
      reimbursement_amount: string | null;
    }>;
    const num = (v: string | null) => parseFloat(v ?? '0');
    return jsonResponse(
      {
        count: rows.length,
        totalMiles: Number(rows.reduce((s, r) => s + num(r.total_miles), 0).toFixed(2)),
        businessMiles: Number(rows.reduce((s, r) => s + num(r.business_miles), 0).toFixed(2)),
        reimbursement: Number(rows.reduce((s, r) => s + num(r.reimbursement_amount), 0).toFixed(2)),
      },
      200,
      req,
      requestId,
    );
  }

  if (first === 'reports') {
    return await handleReports(req, { ...ctx, pathParts: pathParts.slice(1) });
  }

  if (first === 'rates') {
    // No mileage_rates table — return static 2024 IRS business rate.
    if (method === 'GET') {
      return jsonResponse(
        {
          stub: true,
          rates: [
            { type: 'business', ratePerMile: 0.67, effectiveDate: '2024-01-01' },
            { type: 'medical', ratePerMile: 0.21, effectiveDate: '2024-01-01' },
            { type: 'charitable', ratePerMile: 0.14, effectiveDate: '2024-01-01' },
          ],
        },
        200,
        req,
        requestId,
      );
    }
    if (method === 'POST') {
      return errorResponse(501, 'Mileage rates not yet persisted', req, {
        code: 'NOT_IMPLEMENTED',
        details: 'Requires mileage_rates table — deferred.',
        requestId,
      });
    }
  }

  if (first === 'irs-log') {
    return jsonResponse(
      {
        stub: true,
        entries: [],
        message:
          'IRS log requires an irs_mileage_log table. Records are derivable from technician_mileage — deferred.',
      },
      200,
      req,
      requestId,
    );
  }

  if (first === 'vehicles') {
    return await handleVehicles(req, { ...ctx, pathParts: pathParts.slice(1) });
  }

  return null;
}

// ─── Records (technician_mileage) ────────────────────────────────────────────

async function handleRecords(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const id = pathParts[0];

  if (method === 'GET' && !id) {
    let q = db.from('technician_mileage').select('*').eq('tenant_id', auth.tenantId);
    const technicianId =
      url.searchParams.get('technicianId') ?? url.searchParams.get('technician_id');
    const startDate = url.searchParams.get('startDate') ?? url.searchParams.get('start_date');
    const endDate = url.searchParams.get('endDate') ?? url.searchParams.get('end_date');
    if (technicianId) q = q.eq('technician_id', technicianId);
    if (startDate) q = q.gte('date', startDate);
    if (endDate) q = q.lte('date', endDate);
    q = q.order('date', { ascending: false }).limit(1000);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch records', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row: Record<string, unknown> = {
      tenant_id: auth.tenantId,
      technician_id: body.technicianId ?? body.technician_id,
      date: body.date,
      total_miles: body.totalMiles ?? body.total_miles,
      business_miles: body.businessMiles ?? body.business_miles ?? body.totalMiles ?? 0,
      personal_miles: body.personalMiles ?? body.personal_miles ?? 0,
      commute_miles: body.commuteMiles ?? body.commute_miles ?? 0,
      start_odometer: body.startOdometer ?? body.start_odometer ?? null,
      end_odometer: body.endOdometer ?? body.end_odometer ?? null,
      number_of_trips: body.numberOfTrips ?? body.number_of_trips ?? null,
      number_of_stops: body.numberOfStops ?? body.number_of_stops ?? null,
      route_ids: body.routeIds ?? body.route_ids ?? null,
      ticket_ids: body.ticketIds ?? body.ticket_ids ?? null,
      vehicle_id: body.vehicleId ?? body.vehicle_id ?? null,
      notes: body.notes ?? null,
      verification_method: body.verificationMethod ?? body.verification_method ?? 'manual',
    };
    if (!row.technician_id || !row.date || row.total_miles === undefined) {
      return errorResponse(400, 'technician_id, date, total_miles required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('technician_mileage').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create record', error);
    return jsonResponse(data, 201, req, requestId);
  }

  return null;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

async function handleReports(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const id = pathParts[0];
  const action = pathParts[1];

  // POST /reports/:id/(submit|approve|reject)
  if (method === 'POST' && id && action) {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now };
    if (action === 'submit') {
      update.report_status = 'submitted';
      update.submitted_at = now;
      update.submitted_by = auth.userId;
    } else if (action === 'approve') {
      update.report_status = 'approved';
      update.approved_at = now;
      update.approved_by = auth.userId;
    } else if (action === 'reject') {
      const body = (await req.json().catch(() => ({}))) as { reason?: string };
      update.report_status = 'rejected';
      update.rejection_reason = body.reason ?? null;
    } else {
      return errorResponse(400, `Unknown action: ${action}`, req, {
        code: 'UNKNOWN_ACTION',
        requestId,
      });
    }
    const { data, error } = await db
      .from('mileage_reports')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, `Failed to ${action} report`, error);
    if (!data) return errorResponse(404, 'Report not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'GET' && !id) {
    const { data, error } = await db
      .from('mileage_reports')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('period_end', { ascending: false })
      .limit(500);
    if (error) return dbErr(req, requestId, 'Failed to fetch reports', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id) {
    const { data, error } = await db
      .from('mileage_reports')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch report', error);
    if (!data) return errorResponse(404, 'Report not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row: Record<string, unknown> = {
      tenant_id: auth.tenantId,
      report_number: body.reportNumber ?? body.report_number,
      report_type: body.reportType ?? body.report_type,
      period_start: body.periodStart ?? body.period_start,
      period_end: body.periodEnd ?? body.period_end,
      technician_id: body.technicianId ?? body.technician_id ?? null,
      total_miles: body.totalMiles ?? body.total_miles ?? 0,
      business_miles: body.businessMiles ?? body.business_miles ?? 0,
      personal_miles: body.personalMiles ?? body.personal_miles ?? null,
      total_reimbursement: body.totalReimbursement ?? body.total_reimbursement ?? null,
      total_trips: body.totalTrips ?? body.total_trips ?? null,
      daily_breakdown: body.dailyBreakdown ?? body.daily_breakdown ?? null,
      report_status: 'draft',
      created_by: auth.userId,
    };
    if (!row.report_number || !row.report_type || !row.period_start || !row.period_end) {
      return errorResponse(
        400,
        'report_number, report_type, period_start, period_end required',
        req,
        {
          code: 'VALIDATION_ERROR',
          requestId,
        },
      );
    }
    const { data, error } = await db.from('mileage_reports').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create report', error);
    return jsonResponse(data, 201, req, requestId);
  }

  return null;
}

// ─── Vehicles (vehicle_assignments) ──────────────────────────────────────────

async function handleVehicles(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const id = pathParts[0];

  if (method === 'GET' && !id) {
    const { data, error } = await db
      .from('vehicle_assignments')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('is_active', true)
      .order('vehicle_name', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch vehicles', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row: Record<string, unknown> = {
      tenant_id: auth.tenantId,
      vehicle_name: body.vehicleName ?? body.vehicle_name,
      vehicle_type: body.vehicleType ?? body.vehicle_type,
      make: body.make ?? null,
      model: body.model ?? null,
      year: body.year ?? null,
      plate_number: body.plateNumber ?? body.plate_number ?? null,
      vin: body.vin ?? null,
      assigned_to_technician_id:
        body.assignedToTechnicianId ?? body.assigned_to_technician_id ?? null,
      assignment_start_date:
        body.assignmentStartDate ?? body.assignment_start_date ?? new Date().toISOString(),
      assignment_end_date: body.assignmentEndDate ?? body.assignment_end_date ?? null,
      current_odometer: body.currentOdometer ?? body.current_odometer ?? null,
      estimated_mpg: body.estimatedMpg ?? body.estimated_mpg ?? null,
      fuel_type: body.fuelType ?? body.fuel_type ?? null,
    };
    if (!row.vehicle_name || !row.vehicle_type) {
      return errorResponse(400, 'vehicle_name and vehicle_type required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('vehicle_assignments').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create vehicle', error);
    return jsonResponse(data, 201, req, requestId);
  }

  return null;
}
