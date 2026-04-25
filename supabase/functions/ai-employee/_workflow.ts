// Workflow runner — ported from server/services/ai-employee-service.ts::578-668.
//
// Iterates the workflow's `workflow_steps` and runs each one. A step is either:
//   - assigned to an AI employee (employee_assignments[step.step] !== 'system')
//     → run the same Claude-backed task execution as a regular task. We
//        short-circuit the create-task → poll-for-completion dance the Express
//        version did: edge invocations are short-lived, and waiting on a row
//        we just inserted is wasteful when we can run the executor inline.
//   - a system step → record a placeholder result and move on.
//
// Output of each step is fed forward as `previousResults` in the next step's
// task_context so multi-step prompts can chain.

import type { SupabaseClient } from '../_shared/db.ts';
import { performTaskExecution } from './_execute.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('ai-employee-workflow');

interface WorkflowStep {
  step: string;
  description?: string;
  [key: string]: unknown;
}

interface CompletedStep {
  step: string;
  result: Record<string, unknown>;
  qualityScore: number;
  success: boolean;
  errors?: string[];
}

export async function executeWorkflow(
  db: SupabaseClient,
  executionId: string,
  tenantId: string,
): Promise<void> {
  try {
    const { data: execution, error: execErr } = await db
      .from('ai_workflow_executions')
      .select('id, workflow_id, input_data')
      .eq('id', executionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (execErr || !execution) {
      log.error({ executionId, err: execErr?.message }, 'execution_not_found');
      return;
    }

    if (!execution.workflow_id) {
      await db
        .from('ai_workflow_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: { error: 'workflow_id missing on execution row' },
        })
        .eq('id', executionId);
      return;
    }

    const { data: workflow, error: wfErr } = await db
      .from('ai_employee_workflows')
      .select('workflow_steps, employee_assignments')
      .eq('id', execution.workflow_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (wfErr || !workflow) {
      await db
        .from('ai_workflow_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: {
            error: 'Workflow definition not found',
            workflowId: execution.workflow_id,
          },
        })
        .eq('id', executionId);
      return;
    }

    const steps = parseJsonArray<WorkflowStep>(workflow.workflow_steps);
    const assignments = parseJsonObject(workflow.employee_assignments);
    const inputData = parseJsonObject(execution.input_data);
    const t0 = Date.now();

    const completedSteps: CompletedStep[] = [];
    let stepsFailed = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      await db
        .from('ai_workflow_executions')
        .update({
          current_step_index: i,
          current_step_name: step.step,
        })
        .eq('id', executionId);

      const assignedEmployeeId = assignments[step.step];
      const isSystemStep = !assignedEmployeeId || assignedEmployeeId === 'system';

      if (isSystemStep) {
        completedSteps.push({
          step: step.step,
          result: { message: `System step ${step.step} completed` },
          qualityScore: 100,
          success: true,
        });
        continue;
      }

      // AI-employee step: run the same executor used by direct task assignment,
      // passing prior step output as previousResults.
      try {
        const result = await performTaskExecution({
          task_type: step.step,
          task_title: `Workflow Step: ${step.step}`,
          task_description: step.description ?? null,
          task_context: {
            workflowExecutionId: executionId,
            stepIndex: i,
            previousResults: completedSteps,
            employeeId: assignedEmployeeId,
          },
          input_data: inputData,
        });

        completedSteps.push({
          step: step.step,
          result: result.result,
          qualityScore: result.qualityScore,
          success: result.success,
          errors: result.errors,
        });
        if (!result.success) stepsFailed += 1;
      } catch (err) {
        log.error({ executionId, step: step.step, err: String(err) }, 'workflow_step_failed');
        stepsFailed += 1;
        completedSteps.push({
          step: step.step,
          result: { error: String(err) },
          qualityScore: 0,
          success: false,
          errors: [String(err)],
        });
      }
    }

    const totalMinutes = Math.max(1, Math.round((Date.now() - t0) / 60_000));
    const allSucceeded = stepsFailed === 0 && completedSteps.length === steps.length;

    await db
      .from('ai_workflow_executions')
      .update({
        status: allSucceeded ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
        final_result: { steps: completedSteps, success: allSucceeded },
        steps_completed: completedSteps.filter((s) => s.success).length,
        steps_failed: stepsFailed,
        total_execution_time_minutes: totalMinutes,
      })
      .eq('id', executionId);
  } catch (err) {
    log.error({ executionId, err: String(err) }, 'workflow_execution_crashed');
    await db
      .from('ai_workflow_executions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_details: { error: String(err) },
      })
      .eq('id', executionId);
  }
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      // fall through
    }
  }
  return {};
}
