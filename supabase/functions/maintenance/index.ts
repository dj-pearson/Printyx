// Maintenance Edge Function
// Handles preventive maintenance scheduling and management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[1]; // /maintenance/schedules, /maintenance/upcoming, etc.
    const resourceId = pathParts[2];

    // GET /maintenance/schedules - List maintenance schedules
    if (req.method === 'GET' && endpoint === 'schedules') {
      const equipmentId =
        url.searchParams.get('equipmentId') || url.searchParams.get('equipment_id');
      const status = url.searchParams.get('status');

      let query = admin
        .from('maintenance_schedules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('next_due_date', { ascending: true });

      if (equipmentId) query = query.eq('equipment_id', equipmentId);
      if (status) query = query.eq('status', status);

      const { data: schedules, error } = await query;

      if (error) {
        console.error('Error fetching maintenance schedules:', error);
        return createCorsResponse({ error: 'Failed to fetch schedules' }, 500, req);
      }

      return createCorsResponse(schedules || [], 200, req);
    }

    // GET /maintenance/upcoming - Get upcoming maintenance tasks
    if (req.method === 'GET' && endpoint === 'upcoming') {
      const days = parseInt(url.searchParams.get('days') || '30');
      const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const { data: upcoming, error } = await admin
        .from('maintenance_schedules')
        .select(
          `
          *,
          equipment:equipment_id (
            id,
            name,
            serial_number,
            model
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .lte('next_due_date', futureDate)
        .eq('status', 'active')
        .order('next_due_date', { ascending: true });

      if (error) {
        console.error('Error fetching upcoming maintenance:', error);
        return createCorsResponse({ error: 'Failed to fetch upcoming maintenance' }, 500, req);
      }

      return createCorsResponse(upcoming || [], 200, req);
    }

    // GET /maintenance/overdue - Get overdue maintenance tasks
    if (req.method === 'GET' && endpoint === 'overdue') {
      const today = new Date().toISOString();

      const { data: overdue, error } = await admin
        .from('maintenance_schedules')
        .select(
          `
          *,
          equipment:equipment_id (
            id,
            name,
            serial_number,
            model
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .lt('next_due_date', today)
        .eq('status', 'active')
        .order('next_due_date', { ascending: true });

      if (error) {
        console.error('Error fetching overdue maintenance:', error);
        return createCorsResponse({ error: 'Failed to fetch overdue maintenance' }, 500, req);
      }

      return createCorsResponse(overdue || [], 200, req);
    }

    // GET /maintenance/history - Get maintenance history
    if (req.method === 'GET' && endpoint === 'history') {
      const equipmentId =
        url.searchParams.get('equipmentId') || url.searchParams.get('equipment_id');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      let query = admin
        .from('maintenance_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (equipmentId) query = query.eq('equipment_id', equipmentId);

      const { data: history, error } = await query;

      if (error) {
        console.error('Error fetching maintenance history:', error);
        return createCorsResponse({ error: 'Failed to fetch history' }, 500, req);
      }

      return createCorsResponse(history || [], 200, req);
    }

    // GET /maintenance/stats - Get maintenance statistics
    if (req.method === 'GET' && endpoint === 'stats') {
      const today = new Date().toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get counts
      const { count: totalSchedules } = await admin
        .from('maintenance_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      const { count: overdueCount } = await admin
        .from('maintenance_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .lt('next_due_date', today);

      const { count: completedThisMonth } = await admin
        .from('maintenance_records')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('completed_at', thirtyDaysAgo);

      return createCorsResponse(
        {
          totalSchedules: totalSchedules || 0,
          overdueCount: overdueCount || 0,
          completedThisMonth: completedThisMonth || 0,
          complianceRate: totalSchedules
            ? Math.round(((totalSchedules - (overdueCount || 0)) / totalSchedules) * 100)
            : 100,
        },
        200,
        req,
      );
    }

    // GET /maintenance/schedules/:id - Get single schedule
    if (req.method === 'GET' && endpoint === 'schedules' && resourceId) {
      const { data: schedule, error } = await admin
        .from('maintenance_schedules')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Schedule not found' }, 404, req);
      }

      return createCorsResponse(schedule, 200, req);
    }

    // POST /maintenance/schedules - Create maintenance schedule
    if (req.method === 'POST' && endpoint === 'schedules') {
      const body = await req.json();

      const scheduleData = {
        tenant_id: tenantId,
        equipment_id: body.equipmentId || body.equipment_id,
        name: body.name,
        description: body.description,
        maintenance_type: body.maintenanceType || body.maintenance_type || 'preventive',
        frequency: body.frequency || 'monthly',
        frequency_value: body.frequencyValue || body.frequency_value || 1,
        next_due_date: body.nextDueDate || body.next_due_date || new Date().toISOString(),
        last_completed_date: body.lastCompletedDate || body.last_completed_date,
        assigned_to: body.assignedTo || body.assigned_to,
        estimated_duration: body.estimatedDuration || body.estimated_duration,
        checklist: body.checklist || [],
        status: 'active',
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: schedule, error } = await admin
        .from('maintenance_schedules')
        .insert(scheduleData)
        .select()
        .single();

      if (error) {
        console.error('Error creating maintenance schedule:', error);
        return createCorsResponse({ error: 'Failed to create schedule', details: error }, 500, req);
      }

      return createCorsResponse(schedule, 201, req);
    }

    // PUT /maintenance/schedules/:id - Update schedule
    if (req.method === 'PUT' && endpoint === 'schedules' && resourceId) {
      const body = await req.json();

      const { data: schedule, error } = await admin
        .from('maintenance_schedules')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating maintenance schedule:', error);
        return createCorsResponse({ error: 'Failed to update schedule' }, 500, req);
      }

      return createCorsResponse(schedule, 200, req);
    }

    // POST /maintenance/schedules/:id/complete - Mark maintenance as complete
    if (
      req.method === 'POST' &&
      endpoint === 'schedules' &&
      resourceId &&
      pathParts[3] === 'complete'
    ) {
      const body = await req.json();

      // Get the schedule
      const { data: schedule } = await admin
        .from('maintenance_schedules')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (!schedule) {
        return createCorsResponse({ error: 'Schedule not found' }, 404, req);
      }

      // Create maintenance record
      const recordData = {
        tenant_id: tenantId,
        schedule_id: resourceId,
        equipment_id: schedule.equipment_id,
        maintenance_type: schedule.maintenance_type,
        completed_by: user.id,
        completed_at: new Date().toISOString(),
        notes: body.notes,
        parts_used: body.partsUsed || body.parts_used || [],
        labor_hours: body.laborHours || body.labor_hours,
        cost: body.cost,
        created_at: new Date().toISOString(),
      };

      const { data: record, error: recordError } = await admin
        .from('maintenance_records')
        .insert(recordData)
        .select()
        .single();

      if (recordError) {
        console.error('Error creating maintenance record:', recordError);
        return createCorsResponse({ error: 'Failed to complete maintenance' }, 500, req);
      }

      // Calculate next due date based on frequency
      let nextDueDate = new Date();
      switch (schedule.frequency) {
        case 'daily':
          nextDueDate.setDate(nextDueDate.getDate() + (schedule.frequency_value || 1));
          break;
        case 'weekly':
          nextDueDate.setDate(nextDueDate.getDate() + 7 * (schedule.frequency_value || 1));
          break;
        case 'monthly':
          nextDueDate.setMonth(nextDueDate.getMonth() + (schedule.frequency_value || 1));
          break;
        case 'quarterly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 3 * (schedule.frequency_value || 1));
          break;
        case 'yearly':
          nextDueDate.setFullYear(nextDueDate.getFullYear() + (schedule.frequency_value || 1));
          break;
      }

      // Update schedule with new due date
      await admin
        .from('maintenance_schedules')
        .update({
          last_completed_date: new Date().toISOString(),
          next_due_date: nextDueDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId);

      return createCorsResponse(
        {
          record,
          nextDueDate: nextDueDate.toISOString(),
          message: 'Maintenance completed successfully',
        },
        200,
        req,
      );
    }

    // DELETE /maintenance/schedules/:id - Delete schedule
    if (req.method === 'DELETE' && endpoint === 'schedules' && resourceId) {
      const { error } = await admin
        .from('maintenance_schedules')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting maintenance schedule:', error);
        return createCorsResponse({ error: 'Failed to delete schedule' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Schedule deleted' }, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in maintenance function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
