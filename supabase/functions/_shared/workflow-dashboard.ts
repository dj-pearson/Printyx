// Workflow automation dashboard aggregation (PROD-014).
//
// PostgREST expresses no GROUP BY, SUM or AVG, so the edge function fetches
// bounded row sets and every rollup happens here. Keeping it pure - rows and
// `now` in, dashboard out, no Deno or Node API - means the arithmetic is unit
// testable from vitest without a database or an edge runtime.
//
// Two rules the shape has to obey, both learned the expensive way on this
// codebase:
//
//  1. Fields the page has no column for return a zero, an empty array or a
//     neutral string - never a plausible-looking number. The Express handler
//     this replaces returned 47 processes, 68.1% automation and $127,890.50
//     saved for every tenant, all of it invented. An empty dashboard for a
//     tenant with no workflows is the correct answer.
//  2. Every field either page dereferences is present. WorkflowAutomation.tsx
//     calls status.toLowerCase() and priority.toLowerCase() unguarded, so a
//     missing key is a render crash, not a blank cell.

export type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type VersionRow = { id: string; workflow_id: string; version: number };

export type TriggerRow = {
  id: string;
  workflow_id: string;
  type: string;
  event_name: string | null;
  webhook_path: string | null;
  enabled: boolean;
};

export type ScheduleRow = { trigger_id: string; cron_expression: string | null };

export type ConditionRow = {
  trigger_id: string | null;
  left_operand: string;
  operator: string;
  right_operand: string | null;
};

export type StepRow = {
  id: string;
  workflow_id: string;
  name: string;
  action_type: string;
  config: unknown;
  order_index: number;
};

export type ExecutionRow = {
  id: string;
  workflow_id: string;
  status: string;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type ExecutionStepRow = {
  execution_id: string;
  step_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  definition: unknown;
  complexity: string | null;
  estimated_time_saved: number | null;
  usage_count: number;
  featured: boolean;
};

export type DashboardInput = {
  workflows: WorkflowRow[];
  versions: VersionRow[];
  triggers: TriggerRow[];
  schedules: ScheduleRow[];
  conditions: ConditionRow[];
  steps: StepRow[];
  executions: ExecutionRow[];
  executionSteps: ExecutionStepRow[];
  templates: TemplateRow[];
  now: Date;
};

// Executions end in one of these; queued/running/paused are still in flight.
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
// Steps have their own enum - no 'cancelled', and a 'skipped' step is neither
// a success nor a failure, so it stays out of the success-rate denominator.
const STEP_FINISHED = new Set(['completed', 'failed']);

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Seconds between started_at and completed_at, or null if either is missing. */
function durationSeconds(startedAt: string | null, completedAt: string | null): number | null {
  if (!startedAt || !completedAt) return null;
  const a = Date.parse(startedAt);
  const b = Date.parse(completedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 1000);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

/** YYYY-MM-DD in UTC. Used for the day buckets on the execution trend. */
export function utcDay(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

/**
 * The trend the page charts: one bucket per day for the last `days` days,
 * including days with no executions, oldest first.
 */
export function executionTrends(
  executions: ExecutionRow[],
  now: Date,
  days = 14,
): Array<{ date: string; executions: number; successRate: number }> {
  const byDay = groupBy(executions, (e) => utcDay(e.created_at));
  const out: Array<{ date: string; executions: number; successRate: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = utcDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
    const rows = byDay.get(day) ?? [];
    const finished = rows.filter((r) => TERMINAL.has(r.status));
    const succeeded = finished.filter((r) => r.status === 'completed');
    out.push({
      date: day,
      executions: rows.length,
      successRate: pct(succeeded.length, finished.length),
    });
  }
  return out;
}

/**
 * Failure counts by the first line of the error text. Grouping on the raw
 * message would produce one bucket per execution once ids and timestamps are
 * interpolated into it, so the leading line is truncated to 120 characters.
 */
export function errorAnalysis(
  executions: ExecutionRow[],
): Array<{ errorType: string; count: number; percentage: number; trend: string }> {
  const failed = executions.filter((e) => e.status === 'failed');
  const counts = new Map<string, number>();
  for (const e of failed) {
    const label = (e.error ?? '').split('\n')[0].trim().slice(0, 120) || 'Unspecified error';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([errorType, count]) => ({
      errorType,
      count,
      percentage: pct(count, failed.length),
      // No historical comparison is stored, so the direction is unknown
      // rather than guessed.
      trend: 'unknown',
    }));
}

export function buildWorkflowDashboard(input: DashboardInput) {
  const { workflows, versions, triggers, schedules, conditions, steps, executions } = input;
  const { executionSteps, templates, now } = input;

  const versionById = new Map(versions.map((v) => [v.id, v]));
  const execsByWorkflow = groupBy(executions, (e) => e.workflow_id);
  const triggersByWorkflow = groupBy(triggers, (t) => t.workflow_id);
  const stepsByWorkflow = groupBy(steps, (s) => s.workflow_id);
  const scheduleByTrigger = new Map(schedules.map((s) => [s.trigger_id, s]));
  const conditionsByTrigger = groupBy(
    conditions.filter((c) => c.trigger_id),
    (c) => c.trigger_id as string,
  );
  const execStepsByStepId = groupBy(executionSteps, (s) => s.step_id);

  // ── overview ────────────────────────────────────────────────────────
  const finished = executions.filter((e) => TERMINAL.has(e.status));
  const succeeded = finished.filter((e) => e.status === 'completed');
  const failedExecs = finished.filter((e) => e.status === 'failed');
  const today = utcDay(now);
  const executionDurations = executions
    .map((e) => durationSeconds(e.started_at, e.completed_at))
    .filter((d): d is number => d !== null);

  const lastExecution =
    executions.length > 0
      ? executions
          .map((e) => e.created_at)
          .sort()
          .slice(-1)[0]
      : null;

  const automationOverview = {
    totalWorkflows: workflows.length,
    activeWorkflows: workflows.filter((w) => w.status === 'active').length,
    pausedWorkflows: workflows.filter((w) => w.status === 'paused').length,
    // A workflow is not itself "failed" - the status enum is
    // draft/active/paused/archived - so this counts workflows whose most
    // recent execution failed, which is what the card is asking.
    failedWorkflows: workflows.filter((w) => {
      const runs = (execsByWorkflow.get(w.id) ?? [])
        .filter((e) => TERMINAL.has(e.status))
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      return runs.length > 0 && runs[runs.length - 1].status === 'failed';
    }).length,
    successRate: pct(succeeded.length, finished.length),
    executionsToday: executions.filter((e) => utcDay(e.created_at) === today).length,
    // No column records operator minutes displaced by a run, and inventing a
    // per-run figure is how the handler this replaces produced its numbers.
    timeSaved: 0,
    errorRate: pct(failedExecs.length, finished.length),
    averageExecutionTime: mean(executionDurations),
    // Would need a denominator of automatable processes, which nothing counts.
    automationCoverage: 0,
    lastExecution,
  };

  // ── per-workflow ────────────────────────────────────────────────────
  const activeWorkflows = workflows.map((w) => {
    const runs = execsByWorkflow.get(w.id) ?? [];
    const runsFinished = runs.filter((e) => TERMINAL.has(e.status));
    const runsSucceeded = runsFinished.filter((e) => e.status === 'completed');
    const durations = runs
      .map((e) => durationSeconds(e.started_at, e.completed_at))
      .filter((d): d is number => d !== null);
    const wfTriggers = triggersByWorkflow.get(w.id) ?? [];
    const version = w.current_version_id ? versionById.get(w.current_version_id) : undefined;

    return {
      id: w.id,
      name: w.name,
      description: w.description ?? '',
      category: w.category ?? 'Uncategorized',
      status: w.status,
      // Display label for the "trigger" column. Multiple triggers collapse to
      // the first; the full list is on `triggers` below.
      trigger: wfTriggers[0]?.event_name ?? wfTriggers[0]?.type ?? 'manual',
      // workflows has no priority column. 'unset' falls through both
      // getPriorityColor and getStatusColor to their neutral default instead
      // of crashing on undefined.toLowerCase().
      priority: 'unset',
      version: version ? String(version.version) : '1',
      createdAt: w.created_at,
      lastModified: w.updated_at,
      lastExecution:
        runs.length > 0
          ? runs
              .map((e) => e.created_at)
              .sort()
              .slice(-1)[0]
          : null,
      executionCount: runs.length,
      successRate: pct(runsSucceeded.length, runsFinished.length),
      averageExecutionTime: mean(durations),
      estimatedTimeSaved: 0,
      steps: (stepsByWorkflow.get(w.id) ?? [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => {
          const stepRuns = (execStepsByStepId.get(s.id) ?? [])
            .slice()
            .sort((a, b) => a.created_at.localeCompare(b.created_at));
          const stepFinished = stepRuns.filter((r) => STEP_FINISHED.has(r.status));
          const stepOk = stepFinished.filter((r) => r.status === 'completed');
          return {
            id: s.id,
            name: s.name,
            type: s.action_type,
            // Steps carry no status of their own - only their executions do,
            // so this reports the most recent run's outcome.
            status: stepRuns.length > 0 ? stepRuns[stepRuns.length - 1].status : 'pending',
            config: s.config ?? {},
            successRate: pct(stepOk.length, stepFinished.length),
            avgExecutionTime: mean(
              stepRuns
                .map((r) => durationSeconds(r.started_at, r.completed_at))
                .filter((d): d is number => d !== null),
            ),
          };
        }),
      triggers: wfTriggers.map((t) => ({
        type: t.type,
        event: t.event_name ?? undefined,
        schedule: scheduleByTrigger.get(t.id)?.cron_expression ?? undefined,
        conditions: (conditionsByTrigger.get(t.id) ?? []).map((c) => ({
          field: c.left_operand,
          operator: c.operator,
          value: c.right_operand,
        })),
      })),
      metrics: {
        totalExecutions: runs.length,
        successfulExecutions: runsSucceeded.length,
        failedExecutions: runsFinished.filter((e) => e.status === 'failed').length,
        timeToComplete: mean(durations),
        // No cost model is stored against a workflow or a step.
        costSavings: 0,
      },
    };
  });

  // ── templates ───────────────────────────────────────────────────────
  const workflowTemplates = templates.map((t) => {
    const definition = (t.definition ?? {}) as Record<string, unknown>;
    const defSteps = Array.isArray(definition.steps) ? (definition.steps as unknown[]) : [];
    return {
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description ?? '',
      // usage_count is the only adoption signal the table carries; it backs
      // both counters rather than one of them being made up.
      popularity: t.usage_count,
      installations: t.usage_count,
      // No rating column. 0 renders as unrated instead of a fabricated score.
      rating: 0,
      complexity: t.complexity ?? 'unset',
      // estimated_time_saved is minutes saved per month, not setup minutes.
      estimatedSetupTime: 0,
      estimatedTimeSaved: t.estimated_time_saved ?? 0,
      featured: t.featured,
      features: Array.isArray(definition.features) ? (definition.features as string[]) : [],
      steps: defSteps.map((s) =>
        typeof s === 'object' && s !== null && 'name' in s ? String((s as any).name) : String(s),
      ),
      integrations: Array.isArray(definition.integrations)
        ? (definition.integrations as string[])
        : [],
    };
  });

  // ── rules engine ────────────────────────────────────────────────────
  // There is no rules table. workflow_conditions is the nearest real thing:
  // each condition gates a trigger, so it is reported as a rule against the
  // workflow that owns that trigger. Counts are real; the per-rule execution
  // history the page wants is not stored anywhere.
  const triggerById = new Map(triggers.map((t) => [t.id, t]));
  const workflowById = new Map(workflows.map((w) => [w.id, w]));
  const rules = conditions
    .filter((c) => c.trigger_id && triggerById.has(c.trigger_id))
    .map((c, i) => {
      const trigger = triggerById.get(c.trigger_id as string)!;
      const workflow = workflowById.get(trigger.workflow_id);
      return {
        id: `${c.trigger_id}:${i}`,
        name: `${c.left_operand} ${c.operator} ${c.right_operand ?? ''}`.trim(),
        category: workflow?.category ?? 'Uncategorized',
        status: trigger.enabled ? 'active' : 'paused',
        priority: 'unset',
        description: workflow ? `Gates ${workflow.name}` : 'Gates a trigger',
        trigger: trigger.event_name ?? trigger.type,
        conditions: [{ field: c.left_operand, operator: c.operator, value: c.right_operand }],
        actions: [],
        executionCount: 0,
        successRate: 0,
        lastExecuted: null,
      };
    });

  const ruleCategories = [...groupBy(rules, (r) => r.category).entries()].map(
    ([category, rows]) => ({
      category,
      count: rows.length,
      performance: 0,
    }),
  );

  const rulesEngine = {
    totalRules: rules.length,
    activeRules: rules.filter((r) => r.status === 'active').length,
    ruleCategories,
    rules,
  };

  // ── analytics ───────────────────────────────────────────────────────
  const performanceAnalytics = {
    executionTrends: executionTrends(executions, now),
    topPerformingWorkflows: activeWorkflows
      .filter((w) => w.executionCount > 0)
      .sort((a, b) => b.successRate - a.successRate || b.executionCount - a.executionCount)
      .slice(0, 5)
      .map((w) => ({
        name: w.name,
        successRate: w.successRate,
        executions: w.executionCount,
        timeSaved: 0,
      })),
    errorAnalysis: errorAnalysis(executions),
    businessImpact: {
      totalTimeSaved: 0,
      totalCostSavings: 0,
      errorReduction: 0,
      customerSatisfactionIncrease: 0,
      processEfficiencyGain: 0,
    },
  };

  return {
    automationOverview,
    activeWorkflows,
    workflowTemplates,
    rulesEngine,
    performanceAnalytics,
    // Named so a reader of the response can tell an empty dashboard from a
    // broken one, and so nobody re-derives these from the zeros above.
    unbacked: [
      'timeSaved / estimatedTimeSaved / totalTimeSaved: no column records operator minutes displaced by a run',
      'automationCoverage: no denominator of automatable processes is stored',
      'costSavings / totalCostSavings: no cost model is attached to a workflow or step',
      'priority: workflows has no priority column',
      'template rating and estimatedSetupTime: workflow_templates has neither column',
      'rulesEngine per-rule executionCount/successRate/lastExecuted: conditions are not executed independently, so nothing records them',
      'businessImpact errorReduction / customerSatisfactionIncrease / processEfficiencyGain: no baseline is stored to compare against',
    ],
  };
}
