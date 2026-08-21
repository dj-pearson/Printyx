// Workflow Automation Edge Function (PROD-014)
//
// Serves /api/workflow-automation/dashboard, read by AutopilotDashboard.tsx and
// WorkflowAutomation.tsx. Both worked in dev and returned 404 in production,
// because getApiUrl() rewrites /api/x to functions.printyx.net/x with no
// Express fallback and no function existed here.
//
// The Express handler was not the port source. server/routes-workflow-automation.ts
// is the unregistered dead mock CLAUDE.md names, and the two handlers that DO
// register (routes-workflow-mobile.ts:360, routes-sample-data.ts:1801) return
// hardcoded figures - 47 processes, a 68.1% automation rate, $127,890.50 saved -
// identical for every tenant. Shipping that to production would have been worse
// than the 404, because the pages render whatever arrives with no mock fallback
// to fall back to.
//
// So this reads the real CRMX-008 runtime tables instead
// (shared/workflow-automation-schema.ts). Rollups live in
// _shared/workflow-dashboard.ts because PostgREST expresses no GROUP BY, SUM or
// AVG; that module is pure and is unit tested from vitest.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { buildWorkflowDashboard } from '../_shared/workflow-dashboard.ts';

// Bounded fetches - the aggregation is in memory, so these cap what one
// dashboard request can pull. Executions dominate; 5000 covers a busy tenant's
// recent history and the trend only charts 14 days.
const MAX_EXECUTIONS = 5000;
const MAX_EXECUTION_STEPS = 20000;

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'workflow-automation');
    const resource = parts[0];

    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return createCorsResponse({ message: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string | undefined) ||
      (user.app_metadata?.tenant_id as string | undefined) ||
      (user.user_metadata?.tenantId as string | undefined) ||
      (user.user_metadata?.tenant_id as string | undefined);
    if (!tenantId) {
      return createCorsResponse({ message: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();

    if (req.method === 'GET' && resource === 'dashboard') {
      // workflows and workflow_executions carry tenant_id; the child tables
      // (versions, triggers, steps, conditions, execution steps) do not, so
      // they are scoped by the parent ids fetched here. Fetching workflows
      // first is what makes that scoping tenant-safe.
      const { data: workflows, error: wfError } = await admin
        .from('workflows')
        .select(
          'id, name, description, category, status, current_version_id, created_at, updated_at',
        )
        .eq('tenant_id', tenantId)
        .eq('is_template', false)
        .order('updated_at', { ascending: false });
      if (wfError) {
        return createCorsResponse(
          { message: 'Failed to load workflows', detail: wfError.message },
          500,
          req,
        );
      }

      const workflowIds = (workflows ?? []).map((w: any) => w.id);

      // A tenant with no workflows gets the same shape with empty collections,
      // not a 404 and not an error - .in() on an empty list is a wasted round
      // trip, so those queries are skipped.
      const [versions, triggers, steps, executions, templates] = await Promise.all([
        workflowIds.length
          ? admin
              .from('workflow_versions')
              .select('id, workflow_id, version')
              .in('workflow_id', workflowIds)
          : Promise.resolve({ data: [] as any[] }),
        workflowIds.length
          ? admin
              .from('workflow_triggers')
              .select('id, workflow_id, type, event_name, webhook_path, enabled')
              .in('workflow_id', workflowIds)
          : Promise.resolve({ data: [] as any[] }),
        workflowIds.length
          ? admin
              .from('workflow_steps_automation')
              .select('id, workflow_id, name, action_type, config, order_index')
              .in('workflow_id', workflowIds)
          : Promise.resolve({ data: [] as any[] }),
        admin
          .from('workflow_executions')
          .select('id, workflow_id, status, error, started_at, completed_at, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(MAX_EXECUTIONS),
        admin
          .from('workflow_templates')
          .select(
            'id, name, description, category, definition, complexity, estimated_time_saved, usage_count, featured',
          )
          .order('featured', { ascending: false })
          .order('usage_count', { ascending: false })
          .limit(100),
      ]);

      const triggerIds = (triggers.data ?? []).map((t: any) => t.id);
      const executionIds = (executions.data ?? []).map((e: any) => e.id);

      const [schedules, conditions, executionSteps] = await Promise.all([
        triggerIds.length
          ? admin
              .from('trigger_schedules')
              .select('trigger_id, cron_expression')
              .in('trigger_id', triggerIds)
          : Promise.resolve({ data: [] as any[] }),
        triggerIds.length
          ? admin
              .from('workflow_conditions')
              .select('trigger_id, left_operand, operator, right_operand')
              .in('trigger_id', triggerIds)
          : Promise.resolve({ data: [] as any[] }),
        executionIds.length
          ? admin
              .from('workflow_execution_steps')
              .select('execution_id, step_id, status, started_at, completed_at, created_at')
              .in('execution_id', executionIds)
              .limit(MAX_EXECUTION_STEPS)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const dashboard = buildWorkflowDashboard({
        workflows: (workflows ?? []) as any,
        versions: (versions.data ?? []) as any,
        triggers: (triggers.data ?? []) as any,
        schedules: (schedules.data ?? []) as any,
        conditions: (conditions.data ?? []) as any,
        steps: (steps.data ?? []) as any,
        executions: (executions.data ?? []) as any,
        executionSteps: (executionSteps.data ?? []) as any,
        templates: (templates.data ?? []) as any,
        now: new Date(),
      });

      return createCorsResponse(dashboard, 200, req);
    }

    return createCorsResponse({ message: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Error in workflow-automation function:', error);
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
