// PROD-014: arithmetic lock on the workflow-automation dashboard rollups.
//
// The module under test is pure by design - PostgREST expresses no GROUP BY,
// SUM or AVG, so every number the dashboard shows is computed in TypeScript
// from fetched rows. That makes it exactly the code worth asserting on, and it
// runs here with no database and no edge runtime.
import { describe, it, expect } from 'vitest';
import {
  buildWorkflowDashboard,
  executionTrends,
  errorAnalysis,
  utcDay,
  type DashboardInput,
  type ExecutionRow,
} from '../../../supabase/functions/_shared/workflow-dashboard';

const NOW = new Date('2026-08-20T12:00:00.000Z');

function exec(over: Partial<ExecutionRow> & { id: string }): ExecutionRow {
  return {
    workflow_id: 'wf-1',
    status: 'completed',
    error: null,
    started_at: '2026-08-20T10:00:00.000Z',
    completed_at: '2026-08-20T10:00:30.000Z',
    created_at: '2026-08-20T10:00:00.000Z',
    ...over,
  };
}

function input(over: Partial<DashboardInput> = {}): DashboardInput {
  return {
    workflows: [],
    versions: [],
    triggers: [],
    schedules: [],
    conditions: [],
    steps: [],
    executions: [],
    executionSteps: [],
    templates: [],
    now: NOW,
    ...over,
  };
}

const WORKFLOW = {
  id: 'wf-1',
  name: 'Lead routing',
  description: 'Route inbound leads',
  category: 'Sales',
  status: 'active',
  current_version_id: 'v-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

describe('buildWorkflowDashboard - empty tenant', () => {
  const empty = buildWorkflowDashboard(input());

  it('returns zeros rather than omitting the keys the pages dereference', () => {
    expect(empty.automationOverview).toEqual({
      totalWorkflows: 0,
      activeWorkflows: 0,
      pausedWorkflows: 0,
      failedWorkflows: 0,
      successRate: 0,
      executionsToday: 0,
      timeSaved: 0,
      errorRate: 0,
      averageExecutionTime: 0,
      automationCoverage: 0,
      lastExecution: null,
    });
  });

  it('divides by zero nowhere', () => {
    const numbers = JSON.stringify(empty).match(/:\s*(NaN|null)/g) ?? [];
    expect(numbers.every((m) => m.includes('null'))).toBe(true);
    expect(JSON.stringify(empty)).not.toContain('NaN');
  });

  it('still charts a full 14-day trend so the axis is not empty', () => {
    expect(empty.performanceAnalytics.executionTrends).toHaveLength(14);
    expect(empty.performanceAnalytics.executionTrends[13].date).toBe('2026-08-20');
    expect(empty.performanceAnalytics.executionTrends[0].date).toBe('2026-08-07');
    expect(empty.performanceAnalytics.executionTrends.every((t) => t.executions === 0)).toBe(true);
  });
});

describe('buildWorkflowDashboard - overview arithmetic', () => {
  it('computes success and error rates over FINISHED executions only', () => {
    // 2 completed, 1 failed, 1 still running. The running one must not drag
    // the rate down - it has not finished.
    const d = buildWorkflowDashboard(
      input({
        workflows: [WORKFLOW],
        executions: [
          exec({ id: 'e1', status: 'completed' }),
          exec({ id: 'e2', status: 'completed' }),
          exec({ id: 'e3', status: 'failed', error: 'boom' }),
          exec({ id: 'e4', status: 'running', completed_at: null }),
        ],
      }),
    );
    expect(d.automationOverview.successRate).toBe(66.7);
    expect(d.automationOverview.errorRate).toBe(33.3);
    expect(d.automationOverview.executionsToday).toBe(4);
  });

  it('counts a workflow as failed from its MOST RECENT terminal run, not any run', () => {
    const d = buildWorkflowDashboard(
      input({
        workflows: [WORKFLOW],
        executions: [
          exec({ id: 'e1', status: 'failed', created_at: '2026-08-19T10:00:00.000Z' }),
          exec({ id: 'e2', status: 'completed', created_at: '2026-08-20T10:00:00.000Z' }),
        ],
      }),
    );
    expect(d.automationOverview.failedWorkflows).toBe(0);

    const flipped = buildWorkflowDashboard(
      input({
        workflows: [WORKFLOW],
        executions: [
          exec({ id: 'e1', status: 'completed', created_at: '2026-08-19T10:00:00.000Z' }),
          exec({ id: 'e2', status: 'failed', created_at: '2026-08-20T10:00:00.000Z' }),
        ],
      }),
    );
    expect(flipped.automationOverview.failedWorkflows).toBe(1);
  });

  it('averages only executions that actually have both timestamps', () => {
    const d = buildWorkflowDashboard(
      input({
        workflows: [WORKFLOW],
        executions: [
          exec({
            id: 'e1',
            started_at: '2026-08-20T10:00:00.000Z',
            completed_at: '2026-08-20T10:00:10.000Z',
          }),
          exec({
            id: 'e2',
            started_at: '2026-08-20T10:00:00.000Z',
            completed_at: '2026-08-20T10:00:30.000Z',
          }),
          // Never started; must not count as a zero-second run.
          exec({ id: 'e3', status: 'queued', started_at: null, completed_at: null }),
        ],
      }),
    );
    expect(d.automationOverview.averageExecutionTime).toBe(20);
  });

  it('counts today in UTC, matching the created_at the database stores', () => {
    const d = buildWorkflowDashboard(
      input({
        workflows: [WORKFLOW],
        executions: [
          exec({ id: 'e1', created_at: '2026-08-20T00:00:01.000Z' }),
          exec({ id: 'e2', created_at: '2026-08-19T23:59:59.000Z' }),
        ],
      }),
    );
    expect(d.automationOverview.executionsToday).toBe(1);
    expect(utcDay(NOW)).toBe('2026-08-20');
  });

  it('reports counts by workflow status', () => {
    const d = buildWorkflowDashboard(
      input({
        workflows: [
          { ...WORKFLOW, id: 'a', status: 'active' },
          { ...WORKFLOW, id: 'b', status: 'paused' },
          { ...WORKFLOW, id: 'c', status: 'draft' },
          { ...WORKFLOW, id: 'd', status: 'archived' },
        ],
      }),
    );
    expect(d.automationOverview.totalWorkflows).toBe(4);
    expect(d.automationOverview.activeWorkflows).toBe(1);
    expect(d.automationOverview.pausedWorkflows).toBe(1);
  });
});

describe('buildWorkflowDashboard - per-workflow shape', () => {
  const d = buildWorkflowDashboard(
    input({
      workflows: [WORKFLOW],
      versions: [{ id: 'v-1', workflow_id: 'wf-1', version: 7 }],
      triggers: [
        {
          id: 't-1',
          workflow_id: 'wf-1',
          type: 'event',
          event_name: 'record.created',
          webhook_path: null,
          enabled: true,
        },
      ],
      schedules: [{ trigger_id: 't-1', cron_expression: '0 9 * * 1' }],
      conditions: [
        {
          trigger_id: 't-1',
          left_operand: 'record.status',
          operator: 'equals',
          right_operand: 'new',
        },
      ],
      steps: [
        {
          id: 's-2',
          workflow_id: 'wf-1',
          name: 'Notify rep',
          action_type: 'email',
          config: { to: '{{owner}}' },
          order_index: 2,
        },
        {
          id: 's-1',
          workflow_id: 'wf-1',
          name: 'Score lead',
          action_type: 'calculation',
          config: {},
          order_index: 1,
        },
      ],
      executions: [exec({ id: 'e1' }), exec({ id: 'e2', status: 'failed', error: 'SMTP refused' })],
      executionSteps: [
        {
          execution_id: 'e1',
          step_id: 's-1',
          status: 'completed',
          started_at: '2026-08-20T10:00:00.000Z',
          completed_at: '2026-08-20T10:00:04.000Z',
          created_at: '2026-08-20T10:00:00.000Z',
        },
        {
          execution_id: 'e2',
          step_id: 's-1',
          status: 'failed',
          started_at: '2026-08-20T10:00:00.000Z',
          completed_at: '2026-08-20T10:00:06.000Z',
          created_at: '2026-08-20T11:00:00.000Z',
        },
        // A skipped step is neither a success nor a failure. s-1 gets one too,
        // so the rate below can tell 1/2 apart from 1/3 - without it, both
        // treatments of 'skipped' produce the same number and the assertion
        // proves nothing.
        {
          execution_id: 'e2',
          step_id: 's-2',
          status: 'skipped',
          started_at: null,
          completed_at: null,
          created_at: '2026-08-20T11:00:01.000Z',
        },
        {
          execution_id: 'e2',
          step_id: 's-1',
          status: 'skipped',
          started_at: null,
          completed_at: null,
          created_at: '2026-08-20T10:30:00.000Z',
        },
      ],
    }),
  );
  const wf = d.activeWorkflows[0];

  it('orders steps by order_index, not fetch order', () => {
    expect(wf.steps.map((s) => s.name)).toEqual(['Score lead', 'Notify rep']);
  });

  it('takes the version number from the current version row', () => {
    expect(wf.version).toBe('7');
  });

  it('joins schedule and conditions onto the trigger', () => {
    expect(wf.triggers).toEqual([
      {
        type: 'event',
        event: 'record.created',
        schedule: '0 9 * * 1',
        conditions: [{ field: 'record.status', operator: 'equals', value: 'new' }],
      },
    ]);
    expect(wf.trigger).toBe('record.created');
  });

  it('excludes skipped steps from the step success rate', () => {
    const notify = wf.steps.find((s) => s.id === 's-2')!;
    // One run, skipped: 0 finished, so 0 rather than 0/0.
    expect(notify.successRate).toBe(0);
    expect(notify.status).toBe('skipped');

    const score = wf.steps.find((s) => s.id === 's-1')!;
    expect(score.successRate).toBe(50);
    expect(score.avgExecutionTime).toBe(5);
  });

  it('reports the latest step run by created_at, not array position', () => {
    expect(wf.steps.find((s) => s.id === 's-1')!.status).toBe('failed');
  });

  it('supplies a neutral priority because workflows has no priority column', () => {
    // WorkflowAutomation.tsx calls priority.toLowerCase() unguarded.
    expect(typeof wf.priority).toBe('string');
    expect(wf.priority).toBe('unset');
  });

  it('rolls per-workflow metrics off the same executions', () => {
    expect(wf.metrics).toEqual({
      totalExecutions: 2,
      successfulExecutions: 1,
      failedExecutions: 1,
      timeToComplete: 30,
      costSavings: 0,
    });
    expect(wf.successRate).toBe(50);
  });
});

describe('executionTrends', () => {
  it('buckets by UTC day and fills gaps', () => {
    const rows = [
      exec({ id: 'a', created_at: '2026-08-20T01:00:00.000Z' }),
      exec({ id: 'b', created_at: '2026-08-20T23:00:00.000Z', status: 'failed' }),
      exec({ id: 'c', created_at: '2026-08-18T12:00:00.000Z' }),
    ];
    const trend = executionTrends(rows, NOW, 4);
    expect(trend.map((t) => t.date)).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);
    expect(trend.map((t) => t.executions)).toEqual([0, 1, 0, 2]);
    expect(trend[3].successRate).toBe(50);
    expect(trend[2].successRate).toBe(0);
  });
});

describe('errorAnalysis', () => {
  it('groups failures by the first line and sorts by count', () => {
    const rows = [
      exec({ id: 'a', status: 'failed', error: 'SMTP refused\n  at send (mailer.ts:41)' }),
      exec({ id: 'b', status: 'failed', error: 'SMTP refused\n  at send (mailer.ts:41)' }),
      exec({ id: 'c', status: 'failed', error: 'Timeout waiting for webhook' }),
      exec({ id: 'd', status: 'completed' }),
    ];
    expect(errorAnalysis(rows)).toEqual([
      { errorType: 'SMTP refused', count: 2, percentage: 66.7, trend: 'unknown' },
      { errorType: 'Timeout waiting for webhook', count: 1, percentage: 33.3, trend: 'unknown' },
    ]);
  });

  it('labels a failure with no error text rather than grouping it under empty string', () => {
    expect(errorAnalysis([exec({ id: 'a', status: 'failed', error: null })])[0].errorType).toBe(
      'Unspecified error',
    );
  });
});

describe('templates', () => {
  it('maps real columns and refuses to invent a rating', () => {
    const d = buildWorkflowDashboard(
      input({
        templates: [
          {
            id: 'tpl-1',
            name: 'Renewal autopilot',
            description: 'Track renewals',
            category: 'Customer Success',
            definition: {
              steps: [{ name: 'Find expiring' }, { name: 'Draft quote' }],
              features: ['Churn scoring'],
              integrations: ['email'],
            },
            complexity: 'moderate',
            estimated_time_saved: 480,
            usage_count: 12,
            featured: true,
          },
        ],
      }),
    );
    expect(d.workflowTemplates[0]).toEqual({
      id: 'tpl-1',
      name: 'Renewal autopilot',
      category: 'Customer Success',
      description: 'Track renewals',
      popularity: 12,
      installations: 12,
      rating: 0,
      complexity: 'moderate',
      estimatedSetupTime: 0,
      estimatedTimeSaved: 480,
      featured: true,
      features: ['Churn scoring'],
      steps: ['Find expiring', 'Draft quote'],
      integrations: ['email'],
    });
  });

  it('tolerates a definition that is not the shape it hoped for', () => {
    const d = buildWorkflowDashboard(
      input({
        templates: [
          {
            id: 'tpl-2',
            name: 'Legacy',
            description: null,
            category: 'Service',
            definition: 'not an object',
            complexity: null,
            estimated_time_saved: null,
            usage_count: 0,
            featured: false,
          },
        ],
      }),
    );
    expect(d.workflowTemplates[0].steps).toEqual([]);
    expect(d.workflowTemplates[0].features).toEqual([]);
    expect(d.workflowTemplates[0].complexity).toBe('unset');
  });
});

describe('unbacked fields are declared, not disguised', () => {
  it('names every figure the schema cannot support', () => {
    const d = buildWorkflowDashboard(input());
    const joined = d.unbacked.join(' ');
    for (const field of [
      'timeSaved',
      'automationCoverage',
      'costSavings',
      'priority',
      'rating',
      'businessImpact',
    ]) {
      expect(joined).toContain(field);
    }
  });
});
