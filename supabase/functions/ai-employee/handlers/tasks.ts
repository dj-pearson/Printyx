// Employee tasks — /ai-employee/ai-employees/tasks + /ai-employees/:id/tasks + /:id/performance
// Replaces server/routes/ai-employee-routes.ts::121-207.
// Task execution logic (Claude calls) lives in ../_execute.ts.

import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { z } from 'https://esm.sh/zod@3.22.4';
import type { HandlerCtx } from '../_context.ts';
import { TASK_TYPE_TO_EMPLOYEE_TYPE } from '../_templates.ts';
import { executeTask } from '../_execute.ts';
import { createLogger } from '../../_shared/logger.ts';

const log = createLogger('ai-employee-tasks');

const assignTaskSchema = z.object({
  employeeId: z.string().uuid().optional(),
  taskType: z.string().min(1),
  taskTitle: z.string().min(1),
  taskDescription: z.string().optional().default(''),
  taskPriority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  taskContext: z.record(z.unknown()).optional(),
  inputData: z.record(z.unknown()).optional(),
  dueDate: z.string().datetime().optional(),
});

async function findBestEmployee(
  db: HandlerCtx['db'],
  tenantId: string,
  taskType: string,
): Promise<string | null> {
  const preferredType = TASK_TYPE_TO_EMPLOYEE_TYPE[taskType] ?? 'sales_assistant';
  const { data } = await db
    .from('ai_employees')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('employee_type', preferredType)
    .eq('status', 'active')
    .order('success_rate', { ascending: false })
    .order('total_tasks_completed', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function handleTasks(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  // pathParts[0] === 'ai-employees'
  const [_resource, seg1, seg2] = pathParts;

  // POST /ai-employees/tasks — create a task
  if (method === 'POST' && seg1 === 'tasks') {
    let body;
    try {
      body = await validateBody(assignTaskSchema, req);
    } catch (err) {
      return errorResponse(400, 'Invalid task payload', req, {
        code: 'VALIDATION',
        details: (err as { issues?: unknown }).issues,
        requestId,
      });
    }

    const employeeId =
      body.employeeId ?? (await findBestEmployee(db, auth.tenantId, body.taskType));

    if (!employeeId) {
      return errorResponse(400, 'No suitable AI employee available for this task type', req, {
        code: 'NO_EMPLOYEE',
        details: { taskType: body.taskType },
        requestId,
      });
    }

    const { data: task, error } = await db
      .from('ai_employee_tasks')
      .insert({
        tenant_id: auth.tenantId,
        employee_id: employeeId,
        task_type: body.taskType,
        task_title: body.taskTitle,
        task_description: body.taskDescription,
        task_priority: body.taskPriority ?? 'medium',
        task_context: body.taskContext ?? {},
        input_data: body.inputData ?? {},
        due_date: body.dueDate ?? null,
        status: 'assigned',
      })
      .select('*')
      .single();

    if (error) {
      return errorResponse(500, 'Failed to assign task', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    // Kick off execution without blocking the response. Deno isolates can
    // run this to completion as long as the overall invocation stays alive;
    // for longer jobs, a pg_cron poller should pick up 'assigned' rows instead.
    executeTask(db, task.id, auth.tenantId).catch((err) => {
      log.error({ taskId: task.id, err: String(err) }, 'task_execution_failed');
    });

    return jsonResponse(
      { success: true, data: task, message: 'Task assigned successfully' },
      201,
      req,
      requestId,
    );
  }

  // GET /ai-employees/:employeeId/tasks
  if (method === 'GET' && seg1 && seg2 === 'tasks') {
    const employeeId = seg1;
    const status = ctx.url.searchParams.get('status');

    let query = db
      .from('ai_employee_tasks')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('employee_id', employeeId)
      .order('assigned_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return errorResponse(500, 'Failed to fetch employee tasks', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(
      { success: true, data: data ?? [], count: data?.length ?? 0 },
      200,
      req,
      requestId,
    );
  }

  // GET /ai-employees/:employeeId/performance?days=30
  if (method === 'GET' && seg1 && seg2 === 'performance') {
    const employeeId = seg1;
    const days = Number(ctx.url.searchParams.get('days') ?? '30');

    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data, error } = await db
      .from('ai_employee_tasks')
      .select('status, quality_score, execution_time_minutes, ai_confidence_score')
      .eq('tenant_id', auth.tenantId)
      .eq('employee_id', employeeId)
      .gte('assigned_at', since);

    if (error) {
      return errorResponse(500, 'Failed to fetch performance', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const total = rows.length;
    const completed = rows.filter((r) => r.status === 'completed').length;
    const failed = rows.filter((r) => r.status === 'failed').length;

    const avg = (key: string): number => {
      const vals = rows.map((r) => Number(r[key])).filter((v) => Number.isFinite(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    return jsonResponse(
      {
        success: true,
        data: {
          total_tasks: total,
          completed_tasks: completed,
          failed_tasks: failed,
          avg_quality_score: avg('quality_score'),
          avg_execution_time: avg('execution_time_minutes'),
          avg_confidence: avg('ai_confidence_score'),
          days,
        },
      },
      200,
      req,
      requestId,
    );
  }

  return null;
}
