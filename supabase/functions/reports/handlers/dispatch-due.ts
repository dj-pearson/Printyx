/**
 * POST /reports/schedule/dispatch-due — the scheduled-report sweep.
 *
 * THIS PATH HAD NO HANDLER. `drizzle/cron/reports.sql` has posted here every
 * fifteen minutes since it shipped, and the reports dispatcher routes
 * `/<reportId>/schedule` (createSchedule) and nothing named `dispatch-due`, so
 * every tick hit a 404 and no scheduled report has ever fired. A cron job
 * pointing at a path that does not exist is worse than no cron job: the README
 * inventory lists it, so a reader concludes the schedule runs.
 *
 * WHAT IT CAN AND CANNOT DO. Report generation and email delivery are not
 * implemented anywhere in this tree - the reporting engine's own /execute
 * records `execute_degraded: PostgREST cannot run dynamic SQL`, and its /export
 * answers with a null filePath. So this sweep does NOT pretend to deliver. It
 * does the two things that are true and useful:
 *
 *   1. Records one honest FAILED execution per due schedule, carrying
 *      DELIVERY_DEGRADED, so the degradation becomes visible in the execution
 *      history instead of living only in an HTTP response body nothing stores.
 *   2. Advances `next_run`. Without this a schedule's next run sits in the past
 *      for ever, and the dashboard prints a date that has already gone by as
 *      though a run were imminent - which reads as "about to happen" rather
 *      than "this will never happen".
 *
 * It deliberately does not increment `run_count`: the dashboard renders that as
 * "N sent" and sums it into a Delivered card, so counting an undelivered run
 * inflates a figure about mail nobody received.
 */
import { jsonResponse, errorResponse } from '../../_shared/http.ts';
import { fetchAllRows } from '../../_shared/paged-select.ts';
import {
  DELIVERY_DEGRADED_CODE,
  DELIVERY_DEGRADED_MESSAGE,
  DELIVERY_DEGRADED_REASON,
  calculateNextRun,
} from './scheduled.ts';

type Row = Record<string, unknown>;

export async function dispatchDueSchedules(
  req: Request,
  db: {
    from: (t: string) => any;
  },
  requestId: string,
): Promise<Response> {
  const now = new Date();
  const nowIso = now.toISOString();

  // Cross-tenant by construction: pg_cron carries no tenant, and `next_run` is
  // a per-row deadline, so one query covers every tenant with no loop over them
  // and no enumeration to drift.
  let due: Row[];
  try {
    due = await fetchAllRows<Row>(() =>
      db
        .from('report_schedules')
        .select(
          'id, tenant_id, name, report_definition_id, cron_expression, export_format, parameters, filters, created_by',
        )
        .eq('is_active', true)
        .not('next_run', 'is', null)
        .lte('next_run', nowIso)
        .order('next_run'),
    );
  } catch (err) {
    return errorResponse(503, 'Could not list due schedules', req, {
      code: 'DUE_QUERY_FAILED',
      requestId,
      details: { message: (err as Error)?.message ?? 'unknown' },
    });
  }

  let recorded = 0;
  let advanced = 0;
  const failures: { id: string; error: string }[] = [];

  // Sequentially: this runs every fifteen minutes with nothing waiting on it,
  // and a due set is normally small. A tenant that throws is recorded and
  // stepped over rather than aborting the rest.
  for (const row of due) {
    const id = String(row.id ?? '');
    try {
      const { error: execError } = await db.from('report_executions').insert({
        tenant_id: row.tenant_id,
        report_definition_id: row.report_definition_id,
        // The scheduler is not a person. `user_id` is nullable and the schedule
        // records who created it, so the row says who OWNS the schedule rather
        // than naming somebody who did not press anything.
        user_id: row.created_by ?? null,
        schedule_id: row.id,
        parameters: row.parameters ?? {},
        filters: row.filters ?? {},
        export_format: row.export_format,
        status: 'failed',
        started_at: nowIso,
        completed_at: nowIso,
        execution_time_ms: 0,
        error_message: DELIVERY_DEGRADED_MESSAGE,
        error_code: DELIVERY_DEGRADED_CODE,
      });
      if (execError) throw new Error(execError.message);
      recorded += 1;

      // Advanced with the SAME function the CRUD paths use, so a swept schedule
      // and an edited one cannot land on different next-run semantics.
      const next = calculateNextRun(String(row.cron_expression || '0 9 * * *'));
      const { error: updError } = await db
        .from('report_schedules')
        .update({
          last_run: nowIso,
          last_status: 'failed',
          next_run: next.toISOString(),
          updated_at: nowIso,
        })
        .eq('id', row.id)
        // Scoped to the row's own tenant as well as its id: an update reaching
        // across tenants is what SEC-TENANT-005 is about, and a sweep with no
        // tenant of its own is exactly where that is easy to forget.
        .eq('tenant_id', row.tenant_id);
      if (updError) throw new Error(updError.message);
      advanced += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[REPORTS] schedule ${id} dispatch failed:`, message);
      failures.push({ id, error: message });
    }
  }

  return jsonResponse(
    {
      due: due.length,
      recorded,
      advanced,
      failed: failures.length,
      failures,
      delivered: 0,
      degraded: {
        delivery: true,
        reason: DELIVERY_DEGRADED_REASON,
      },
    },
    // A sweep where every due schedule failed is not a success with a detail
    // field.
    due.length > 0 && failures.length === due.length ? 500 : 200,
    req,
    requestId,
  );
}
