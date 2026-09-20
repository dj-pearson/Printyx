// Technician Management Edge Function
// Handles technician profiles, skills, and availability
//
// ROW-SCOPED IS NOT GATED (SEC-EDGE-001 AC4, round 92). The roster READ narrows
// to the caller through technicians.user_id (WF-R-07), and check:edge-rbac
// therefore files this function as row-scoped - which is a statement about
// which rows you can see, and says nothing about whether you may write. All
// five writes here - creating a technician, editing one, adding a skill,
// setting availability, and DELETING a record - had no role check at all.
//
// The predecessor inventory this round built is what surfaced it:
// server/routes-technician-management.ts gates exactly these on
// PERMISSIONS.SERVICE.TECHNICIAN.MANAGE while its reads take .VIEW, and that
// code IS seeded, so the split was deliberate and satisfiable rather than one
// of SEC-EDGE-002's unsatisfiable gates. That router is still mounted and the
// prefix is NOT proxied, so dev has been the safe host and production the open
// one - the dev/prod split running in its worse direction.
//
// SUPERVISOR mirrors /technician-management in navigation-permissions.ts
// (minLevel 3, service.schedule.manage) and matches the Express intent, so it
// constrains nobody who can already open the page. Reads stay open: row
// scoping is the right control for a roster and the gate belongs on the branch
// that changes it.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { applyUserScope, resolveScope } from '../_shared/scope.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { startOfNextUtcDay, startOfUtcDay } from '../_shared/date-months.ts';
import { buildTechnicianSchedule } from '../_shared/technician-schedule.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel, type AuthContext } from '../_shared/rbac.ts';

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const requireSupervisor = () =>
      requireRoleLevel(
        {
          userId: user.id,
          tenantId,
          email: user.email,
          jwt: jwt ?? '',
          supabaseUser: user,
        } as AuthContext,
        ROLE_LEVEL.SUPERVISOR,
      );

    // Only an RbacError is a role refusal; anything else is rethrown so a
    // database outage does not read as "your role is too low".
    const denySupervisor = (err: unknown) => {
      if (!(err instanceof RbacError)) throw err;
      return createCorsResponse(
        {
          error: 'Changing the technician roster requires a supervisor role',
          code: 'INSUFFICIENT_ROLE',
          details: err.details,
        },
        403,
        req,
      );
    };

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'technician-management');
    const techId = parts[0];
    const subResource = parts[1];

    // GET /technician-management - List technicians
    if (req.method === 'GET' && !techId) {
      const status = url.searchParams.get('status');
      const skillId = url.searchParams.get('skillId');

      // technicians stores first_name/last_name and is_active/is_available —
      // there is no full_name and no status column, and `users` has no full_name
      // either, so the embed, the ordering and the filter were all 42703s. The
      // technician list simply never loaded.
      let query = admin
        .from('technicians')
        .select(
          `
          *,
          user:user_id (
            id,
            email,
            first_name,
            last_name
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      // WF-R-07: the roster is scoped through `technicians.user_id`, the link to
      // `users`, so a supervisor sees their crew and a manager their location -
      // the same tier ladder every other list uses. A technician (level 1-2) sees
      // their own row and the contractors with no user_id, which are unowned and
      // therefore shared; the dispatch and assignment screens that need the whole
      // roster are level 3 and above, which is what makes this safe to narrow.
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
        requestedScope: url.searchParams.get('scope'),
      });
      query = applyUserScope(query, 'user_id', scope);

      if (status) query = query.eq('is_active', status === 'active');

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
        .eq('is_active', true)
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
      try {
        requireSupervisor();
      } catch (err) {
        return denySupervisor(err);
      }

      const body = await req.json();

      // Six of this payload's names were phantom: full_name, status,
      // overtime_rate, max_jobs_per_day, service_radius_miles and home_location.
      // Only full_name and status were visible to check:phantom-cols, the
      // payload being a named variable, so every create was a 42703.
      const fullName = String(body.fullName || body.full_name || '').trim();
      const [derivedFirst, ...derivedRest] = fullName.split(/\s+/);
      const capacityFields = [
        'overtimeRate',
        'overtime_rate',
        'maxJobsPerDay',
        'max_jobs_per_day',
        'serviceRadiusMiles',
        'service_radius_miles',
      ];
      const unpersisted = capacityFields.some((f) => body[f] !== undefined)
        ? [
            'overtimeRate / maxJobsPerDay / serviceRadiusMiles: technicians has no ' +
              'capacity columns (it carries skills, certifications, working_hours and hourly_rate)',
          ]
        : [];

      const techData = {
        tenant_id: tenantId,
        user_id: body.userId || body.user_id,
        first_name: body.firstName || body.first_name || derivedFirst || null,
        last_name: body.lastName || body.last_name || derivedRest.join(' ') || '',
        email: body.email,
        phone: body.phone,
        employee_id: body.employeeId || body.employee_id,
        // status was a string ('active'); the column is the boolean is_active.
        is_active: (body.status ?? 'active') === 'active',
        is_available: body.isAvailable !== false,
        hourly_rate: body.hourlyRate || body.hourly_rate,
        skills: body.skills ?? null,
        certifications: body.certifications ?? null,
        // home_location has no column; current_location is where a technician's
        // position is kept.
        current_location: body.homeLocation || body.home_location || null,
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

      return createCorsResponse(
        unpersisted.length > 0 ? { ...technician, unpersisted } : technician,
        201,
        req,
      );
    }

    // PUT /technician-management/:id - Update technician
    if (req.method === 'PUT' && techId && !subResource) {
      try {
        requireSupervisor();
      } catch (err) {
        return denySupervisor(err);
      }

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
      try {
        requireSupervisor();
      } catch (err) {
        return denySupervisor(err);
      }

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
      /**
       * WF-V-07. This read `work_orders`, a table in no schema, no migration and
       * no database export here, and discarded the error into `schedule || []` -
       * so every technician's schedule was a permanent empty list at 200. See
       * _shared/technician-schedule.ts for why the three real tables cannot be
       * queried with the id this route receives.
       */
      const { data: technician } = await admin
        .from('technicians')
        .select('id, user_id')
        .eq('id', techId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!technician) {
        return createCorsResponse({ error: 'Technician not found' }, 404, req);
      }

      // A contractor with no login cannot be the subject of any of these three
      // columns, so an empty list would be a claim about their week rather than
      // about what can be looked up.
      if (!technician.user_id) {
        return createCorsResponse(
          {
            items: [],
            degraded: [],
            unbacked: [
              'This technician has no linked user account, and all three schedule ' +
                'tables key the assignee on users.id, so nothing can be matched to them.',
            ],
          },
          200,
          req,
        );
      }

      const userId = technician.user_id as string;
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      /**
       * scheduled_date is a timestamp holding a CALENDAR DATE (DATE-LOCAL-002),
       * so the bounds are snapped to day boundaries - an upper bound carrying a
       * time of day drops or admits a whole day depending on which way the
       * operator points. The upper bound is the exclusive next day rather than
       * 23:59:59, which is a real timestamp a row can exceed.
       */
      // Open-ended sentinels rather than a conditional .gte()/.lt(): applying a
      // bound only sometimes is what pushed this into a helper, and the helper
      // is what the column checker could not follow. A row outside these is not
      // a schedule entry.
      const EPOCH = '1970-01-01T00:00:00.000Z';
      const FAR_FUTURE = '9999-12-31T00:00:00.000Z';
      const from = startDate ? startOfUtcDay(new Date(startDate)).toISOString() : null;
      const to = endDate ? startOfNextUtcDay(new Date(endDate)).toISOString() : null;

      /**
       * The date bounds are applied INSIDE each chain rather than through a
       * shared helper. That is not style: check:phantom-cols resolves a column
       * literal against the table its call chain is on, and a helper taking a
       * query has no chain of its own - it read `scheduled_date` as a column of
       * `technicians`, the last .from() before it. equipment-lifecycle's crew
       * day carries the same note for the same reason. Writing code the checker
       * cannot follow is how a real 42703 gets through, so the repetition buys
       * a guard that works.
       */
      const [installations, deliveries, tickets] = await Promise.all([
        admin
          .from('installation_schedules')
          .select(
            'id, scheduled_date, status, customer_id, equipment_id, estimated_duration, installation_notes',
          )
          .eq('tenant_id', tenantId)
          .eq('technician_id', userId)
          .gte('scheduled_date', from ?? EPOCH)
          .lt('scheduled_date', to ?? FAR_FUTURE)
          .order('scheduled_date', { ascending: true }),
        admin
          .from('delivery_schedules')
          .select('id, scheduled_date, status, customer_id, equipment_id, special_instructions')
          .eq('tenant_id', tenantId)
          .eq('driver_id', userId)
          .gte('scheduled_date', from ?? EPOCH)
          .lt('scheduled_date', to ?? FAR_FUTURE)
          .order('scheduled_date', { ascending: true }),
        admin
          .from('service_tickets')
          .select(
            'id, scheduled_date, status, customer_id, equipment_id, estimated_duration, title, description',
          )
          .eq('tenant_id', tenantId)
          .eq('assigned_technician_id', userId)
          .gte('scheduled_date', from ?? EPOCH)
          .lt('scheduled_date', to ?? FAR_FUTURE)
          .order('scheduled_date', { ascending: true }),
      ]);

      const schedule = buildTechnicianSchedule([
        { kind: 'installation', rows: installations.error ? null : (installations.data ?? []) },
        { kind: 'delivery', rows: deliveries.error ? null : (deliveries.data ?? []) },
        { kind: 'service', rows: tickets.error ? null : (tickets.data ?? []) },
      ]);

      return createCorsResponse(schedule, 200, req);
    }

    // POST /technician-management/:id/availability - Update availability
    if (req.method === 'POST' && techId && subResource === 'availability') {
      try {
        requireSupervisor();
      } catch (err) {
        return denySupervisor(err);
      }

      const body = await req.json();

      const { data: technician, error } = await admin
        .from('technicians')
        // availability_notes is not a column, so setting availability failed
        // outright. The note is reported below rather than dropped in silence.
        .update({
          is_available: body.isAvailable,
          updated_at: new Date().toISOString(),
        })
        .eq('id', techId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update availability' }, 500, req);
      }

      return createCorsResponse(
        body.notes !== undefined
          ? {
              ...technician,
              unpersisted: ['notes: technicians has no availability_notes column'],
            }
          : technician,
        200,
        req,
      );
    }

    // DELETE /technician-management/:id - Delete technician
    if (req.method === 'DELETE' && techId) {
      try {
        requireSupervisor();
      } catch (err) {
        return denySupervisor(err);
      }

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
