// Workflows — /ai-employee/ai-employees/workflows[/execute]
// Replaces server/routes/ai-employee-routes.ts::213-259 + service::555-668.

import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { z } from 'https://esm.sh/zod@3.22.4';
import type { HandlerCtx } from '../_context.ts';
import { createLogger } from '../../_shared/logger.ts';
import { executeWorkflow } from '../_workflow.ts';

const log = createLogger('ai-employee-workflows');

const executeSchema = z.object({
  workflowId: z.string().uuid(),
  inputData: z.record(z.unknown()).optional(),
  triggeredBy: z.string().optional(),
  triggerData: z.record(z.unknown()).optional(),
});

export async function handleWorkflows(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  // pathParts: ['ai-employees', 'workflows', ...]
  const sub = pathParts[2];

  // POST /ai-employees/workflows/execute
  if (method === 'POST' && sub === 'execute') {
    let body;
    try {
      body = await validateBody(executeSchema, req);
    } catch (err) {
      return errorResponse(400, 'Invalid workflow execution payload', req, {
        code: 'VALIDATION',
        details: (err as { issues?: unknown }).issues,
        requestId,
      });
    }

    const { data: execution, error } = await db
      .from('ai_workflow_executions')
      .insert({
        tenant_id: auth.tenantId,
        workflow_id: body.workflowId,
        triggered_by: body.triggeredBy ?? 'api_call',
        trigger_data: body.triggerData ?? {},
        input_data: body.inputData ?? {},
        status: 'running',
      })
      .select('id')
      .single();

    if (error) {
      return errorResponse(500, 'Failed to start workflow execution', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    log.info({ executionId: execution.id, workflowId: body.workflowId }, 'workflow_started');

    // Run the step-by-step executor in the background. It updates the
    // execution row through running → completed|failed as steps run; clients
    // poll the execution to observe progress.
    executeWorkflow(db, execution.id, auth.tenantId).catch((err) => {
      log.error({ executionId: execution.id, err: String(err) }, 'workflow_dispatch_failed');
    });

    return jsonResponse(
      {
        success: true,
        data: { executionId: execution.id },
        message: 'Workflow execution started',
      },
      201,
      req,
      requestId,
    );
  }

  // GET /ai-employees/workflows — list active workflows
  if (method === 'GET' && sub === undefined) {
    const workflowType = ctx.url.searchParams.get('workflowType');

    let query = db
      .from('ai_employee_workflows')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (workflowType) query = query.eq('workflow_type', workflowType);

    const { data, error } = await query;
    if (error) {
      return errorResponse(500, 'Failed to fetch workflows', req, {
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

  return null;
}
