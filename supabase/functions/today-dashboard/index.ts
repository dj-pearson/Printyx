// Today Dashboard Edge Function
// Handles today's dashboard data
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { mergeCrewDay } from '../_shared/delivery-scheduling.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { startOfUtcDay, startOfNextUtcDay } from '../_shared/date-months.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

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

    // DATE-LOCAL-002: setHours(0,0,0,0) is LOCAL midnight, and tasks.due_date
    // holds a calendar date stored at UTC midnight, so the bound was off by
    // the host's offset. Both ends come from the shared helpers now and the
    // upper one is exclusive.
    const now = new Date();
    const todayIso = startOfUtcDay(now).toISOString();
    const tomorrowIso = startOfNextUtcDay(now).toISOString();

    // GET /today-dashboard - Get today's dashboard data
    if (req.method === 'GET') {
      // WF-L-06: TODAY'S APPOINTMENTS ARE DELIVERIES AND INSTALLS.
      //
      // This read `appointments`, a table with no schema, no migration and no
      // writer anywhere - so `.data` came back null, the `|| []` below turned
      // that into an empty list, and the iOS app's Today screen has shown zero
      // appointments for every tenant since it shipped. A missing relation that
      // reads as "nothing scheduled" is the AUDIT-028 shape, and it is worse
      // here than a 500 would have been.
      //
      // delivery_schedules and installation_schedules are the real tables and
      // they are what a dealer's day is made of. scheduled_date holds a
      // calendar date at UTC midnight, so the window is a day boundary and the
      // upper bound is exclusive (DATE-LOCAL-002).
      const [deliveryRows, installRows] = await Promise.all([
        admin
          .from('delivery_schedules')
          .select('id, equipment_id, customer_id, scheduled_date, time_window, status, driver_id')
          .eq('tenant_id', tenantId)
          .gte('scheduled_date', todayIso)
          .lt('scheduled_date', tomorrowIso),
        admin
          .from('installation_schedules')
          .select(
            'id, equipment_id, customer_id, scheduled_date, estimated_duration, status, technician_id',
          )
          .eq('tenant_id', tenantId)
          .gte('scheduled_date', todayIso)
          .lt('scheduled_date', tomorrowIso),
      ]);

      const appointments = mergeCrewDay(deliveryRows.data ?? [], installRows.data ?? []);

      // WF-L-06 fixed the appointments half of this handler and stopped there.
      // The other five reads had the same defect, and every one of them
      // discarded its error, so each failure reached the iOS Today screen as a
      // zero or an empty list - the shape the comment above already calls
      // worse than a 500 would have been. All five proven against the Drizzle
      // declarations, not inferred:
      //
      //   `activities`             no such table in any schema (42P01). Activity
      //                            lives in business_record_activities, which is
      //                            what /dashboards/today already reads.
      //   `leads`                  no such table. A lead is a business_records
      //                            row with record_type = 'lead' (COP-B00).
      //   `deal_desk_requests`     no such table. deal-desk writes
      //                            approval_requests, and its pending set is
      //                            ['pending', 'in_review'] everywhere it asks.
      //   `users.full_name`        users has first_name/last_name. The embed
      //                            took the whole activity query down with it.
      //   tasks.status = 'pending' the column and the table are both real and
      //                            the value is not: the vocabulary is
      //                            todo/in_progress/completed/cancelled, so
      //                            this matched no row that has ever existed.
      //
      // That last one is the one nothing here can catch. A literal compared to
      // a real column on a real table typechecks, satisfies check:phantom-cols
      // and is simply never true - the only way to find it is to read what the
      // writers store.
      //
      // The window was wrong too, in a way that cancelled out: `.or()` is a
      // DISJUNCTION, so "due_date >= today OR due_date < tomorrow" is true of
      // every task carrying a due date at all. It read as a day filter and was
      // not one; the status filter was the only thing keeping the list empty.
      const OUTSTANDING_TASK_STATUSES = ['todo', 'in_progress'];

      // A family that fails is NAMED rather than zeroed. Independently caught
      // so one missing relation cannot blank the whole screen (AUDIT-028), and
      // reported on the response so a zero means zero.
      const degraded: string[] = [];
      async function family<T>(
        name: string,
        run: () => Promise<{ data: T[] | null; error: unknown }>,
      ) {
        try {
          const { data, error } = await run();
          if (error) {
            console.error(`today-dashboard: ${name} failed`, error);
            degraded.push(name);
            return null;
          }
          return data ?? [];
        } catch (err) {
          console.error(`today-dashboard: ${name} threw`, err);
          degraded.push(name);
          return null;
        }
      }

      const [tasks, overdueTasks, recentActivities, pendingApprovals, newLeads] = await Promise.all(
        [
          family<any>('tasks', () =>
            admin
              .from('tasks')
              .select('*')
              .eq('tenant_id', tenantId)
              .in('status', OUTSTANDING_TASK_STATUSES)
              .gte('due_date', todayIso)
              .lt('due_date', tomorrowIso),
          ),
          family<any>('overdueTasks', () =>
            admin
              .from('tasks')
              .select('*')
              .eq('tenant_id', tenantId)
              .in('status', OUTSTANDING_TASK_STATUSES)
              .lt('due_date', todayIso),
          ),
          // Raw rows: the iOS ActivityItem decoder already maps activity_type,
          // subject, notes, business_record_id and created_by off exactly this
          // table, so nothing client-side changes.
          family<any>('recentActivities', () =>
            admin
              .from('business_record_activities')
              .select(
                'id, activity_type, subject, description, business_record_id, company_id, completed_date, due_date, scheduled_date, created_by, created_at',
              )
              .eq('tenant_id', tenantId)
              .order('created_at', { ascending: false })
              .limit(10),
          ),
          family<any>('pendingApprovals', () =>
            admin
              .from('approval_requests')
              .select('*')
              .eq('tenant_id', tenantId)
              .in('status', ['pending', 'in_review']),
          ),
          family<any>('newLeads', () =>
            admin
              .from('business_records')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('record_type', 'lead')
              .gte('created_at', todayIso)
              .lt('created_at', tomorrowIso),
          ),
        ],
      );

      const wonDeals = await fetchAllRows<any>(() =>
        admin
          .from('deals')
          // AUDIT-037: `deals` has amount and actual_close_date, not value and
          // closed_at, so this 42703'd and today's revenue was always 0 - a
          // number the dashboard printed with no way to tell it apart from a
          // genuinely quiet morning.
          .select('amount')
          .eq('tenant_id', tenantId)
          .eq('status', 'won')
          .gte('actual_close_date', todayIso),
      );

      const todayRevenue =
        wonDeals?.reduce((sum: number, d: any) => sum + Number(d.amount ?? 0), 0) || 0;

      // A COUNT OF A FAMILY THAT DID NOT LOAD IS NOT ZERO. `family()` answers
      // null when its read failed, and that travels as null rather than 0 -
      // the iOS model already types every count as optional, so this decodes
      // unchanged while the payload stops asserting an empty day it cannot
      // measure. `degraded` names whichever families are missing.
      const countOf = (rows: unknown[] | null) => (rows === null ? null : rows.length);

      return createCorsResponse(
        {
          date: todayIso,
          appointments: appointments || [],
          appointmentCount: appointments?.length || 0,
          tasks: tasks || [],
          taskCount: countOf(tasks),
          overdueTasks: overdueTasks || [],
          overdueCount: countOf(overdueTasks),
          recentActivities: recentActivities || [],
          pendingApprovals: pendingApprovals || [],
          pendingApprovalCount: countOf(pendingApprovals),
          metrics: {
            newLeads: countOf(newLeads),
            todayRevenue,
            dealsWon: wonDeals?.length || 0,
          },
          degraded,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in today-dashboard function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
