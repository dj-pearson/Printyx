// Technician Management Edge Function
// Handles technician profiles, skills, and availability
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    const { parts } = normalizePath(url.pathname, 'technician-management');
    const techId = parts[0];
    const subResource = parts[1];

    // GET /technician-management - List technicians
    if (req.method === 'GET' && !techId) {
      const status = url.searchParams.get('status');
      const skillId = url.searchParams.get('skillId');

      let query = admin
        .from('technicians')
        .select(
          `
          *,
          user:user_id (
            id,
            email,
            full_name
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('full_name', { ascending: true });

      if (status) query = query.eq('status', status);

      const { data: technicians, error } = await query;

      if (error) {
        console.error('Error fetching technicians:', error);
        return createCorsResponse({ error: 'Failed to fetch technicians' }, 500, req);
      }

      return createCorsResponse(technicians || [], 200, req);
    }

    // GET /technician-management/available - Get available technicians
    if (req.method === 'GET' && techId === 'available') {
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
      const skillRequired = url.searchParams.get('skillId');

      let query = admin
        .from('technicians')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .eq('is_available', true);

      const { data: technicians } = await query;

      return createCorsResponse(technicians || [], 200, req);
    }

    // GET /technician-management/:id - Get single technician
    if (req.method === 'GET' && techId && !subResource) {
      const { data: technician, error } = await admin
        .from('technicians')
        .select('*')
        .eq('id', techId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Technician not found' }, 404, req);
      }

      // Get skills
      const { data: skills } = await admin
        .from('technician_skills')
        .select(
          `
          *,
          skill:skill_id (
            id,
            name,
            category
          )
        `,
        )
        .eq('technician_id', techId);

      // Get certifications
      const { data: certifications } = await admin
        .from('technician_certifications')
        .select('*')
        .eq('technician_id', techId);

      return createCorsResponse(
        {
          ...technician,
          skills: skills || [],
          certifications: certifications || [],
        },
        200,
        req,
      );
    }

    // POST /technician-management - Create technician
    if (req.method === 'POST' && !techId) {
      const body = await req.json();

      const techData = {
        tenant_id: tenantId,
        user_id: body.userId || body.user_id,
        full_name: body.fullName || body.full_name,
        email: body.email,
        phone: body.phone,
        employee_id: body.employeeId || body.employee_id,
        status: body.status || 'active',
        is_available: body.isAvailable !== false,
        hourly_rate: body.hourlyRate || body.hourly_rate,
        overtime_rate: body.overtimeRate || body.overtime_rate,
        max_jobs_per_day: body.maxJobsPerDay || body.max_jobs_per_day || 8,
        service_radius_miles: body.serviceRadiusMiles || body.service_radius_miles || 50,
        home_location: body.homeLocation || body.home_location,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: technician, error } = await admin
        .from('technicians')
        .insert(techData)
        .select()
        .single();

      if (error) {
        console.error('Error creating technician:', error);
        return createCorsResponse({ error: 'Failed to create technician' }, 500, req);
      }

      return createCorsResponse(technician, 201, req);
    }

    // PUT /technician-management/:id - Update technician
    if (req.method === 'PUT' && techId && !subResource) {
      const body = await req.json();

      const { data: technician, error } = await admin
        .from('technicians')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', techId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update technician' }, 500, req);
      }

      return createCorsResponse(technician, 200, req);
    }

    // GET /technician-management/:id/skills - Get technician skills
    if (req.method === 'GET' && techId && subResource === 'skills') {
      const { data: skills } = await admin
        .from('technician_skills')
        .select(
          `
          *,
          skill:skill_id (*)
        `,
        )
        .eq('technician_id', techId);

      return createCorsResponse(skills || [], 200, req);
    }

    // POST /technician-management/:id/skills - Add skill
    if (req.method === 'POST' && techId && subResource === 'skills') {
      const body = await req.json();

      const { data: skill, error } = await admin
        .from('technician_skills')
        .insert({
          technician_id: techId,
          skill_id: body.skillId || body.skill_id,
          proficiency_level: body.proficiencyLevel || body.proficiency_level || 'intermediate',
          certified_date: body.certifiedDate || body.certified_date,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add skill' }, 500, req);
      }

      return createCorsResponse(skill, 201, req);
    }

    // GET /technician-management/:id/schedule - Get technician schedule
    if (req.method === 'GET' && techId && subResource === 'schedule') {
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      let query = admin
        .from('work_orders')
        .select('*')
        .eq('assigned_technician_id', techId)
        .order('scheduled_date', { ascending: true });

      if (startDate) query = query.gte('scheduled_date', startDate);
      if (endDate) query = query.lte('scheduled_date', endDate);

      const { data: schedule } = await query;

      return createCorsResponse(schedule || [], 200, req);
    }

    // POST /technician-management/:id/availability - Update availability
    if (req.method === 'POST' && techId && subResource === 'availability') {
      const body = await req.json();

      const { data: technician, error } = await admin
        .from('technicians')
        .update({
          is_available: body.isAvailable,
          availability_notes: body.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', techId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update availability' }, 500, req);
      }

      return createCorsResponse(technician, 200, req);
    }

    // DELETE /technician-management/:id - Delete technician
    if (req.method === 'DELETE' && techId) {
      const { error } = await admin
        .from('technicians')
        .delete()
        .eq('id', techId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete technician' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Technician deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in technician-management function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
