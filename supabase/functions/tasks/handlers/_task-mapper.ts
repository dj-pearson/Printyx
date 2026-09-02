/**
 * Mapping a task request body onto real columns (WF-P-08).
 *
 * Split out of tasks.ts so it can be tested: that file imports _shared/http.ts,
 * which reads Deno.env at module load, and vitest cannot run it.
 *
 * The task row a request body describes.
 *
 * WF-P-08. Two things were wrong here.
 *
 * customer_id was NEVER READ OR WRITTEN, though the column has existed since
 * migration 0002 - so a task could not be attached to the account it concerned,
 * and there was no deal or handoff link at all. Every task was a floating to-do
 * with an assignee and no subject.
 *
 * And five of the columns it DID write do not exist. Migration 0002 dropped
 * parent_task_id, start_date, dependencies, watchers and custom_fields (along
 * with time_tracked, comment_count and attachment_count), and this mapper kept
 * setting them. PostgREST rejects an unknown column with PGRST204, so a caller
 * sending any one of them failed the WHOLE write - a task with a parentTaskId
 * could not be created at all. check:phantom-cols could not see it: the mapper
 * builds its row dynamically through `r[col] = v`, and that guard reads inline
 * object literals and named payload variables, not computed keys.
 *
 * Those five are reported in `unpersisted` rather than silently dropped, so a
 * caller that still sends one learns the field went nowhere.
 */
export const UNPERSISTED_TASK_FIELDS: Record<string, string> = {
  parentTaskId: 'tasks.parent_task_id was dropped in migration 0002',
  startDate: 'tasks.start_date was dropped in migration 0002',
  dependencies: 'tasks.dependencies was dropped in migration 0002',
  watchers: 'tasks.watchers was dropped in migration 0002',
  customFields: 'tasks.custom_fields was dropped in migration 0002',
};

export function unpersistedTaskFields(body: Record<string, unknown>): string[] {
  return Object.entries(UNPERSISTED_TASK_FIELDS)
    .filter(([camel]) => body[camel] !== undefined || body[toSnake(camel)] !== undefined)
    .map(([, reason]) => reason);
}

function toSnake(camel: string): string {
  return camel.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function mapTask(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  if (body.title !== undefined) r.title = body.title;
  if (body.description !== undefined) r.description = body.description;
  if (body.status !== undefined) r.status = body.status;
  if (body.priority !== undefined) r.priority = body.priority;
  set('assigned_to', 'assignedTo', 'assigned_to');
  // WF-P-08: what the task is about. null is meaningful - it detaches the task
  // from a record - so these use `in` rather than `?? undefined`.
  for (const [col, camel] of [
    ['project_id', 'projectId'],
    ['customer_id', 'customerId'],
    ['deal_id', 'dealId'],
    ['handoff_id', 'handoffId'],
  ] as const) {
    if (camel in body) r[col] = body[camel];
    else if (col in body) r[col] = body[col];
  }
  set('due_date', 'dueDate', 'due_date');
  set('estimated_hours', 'estimatedHours', 'estimated_hours');
  set('actual_hours', 'actualHours', 'actual_hours');
  set('completion_percentage', 'completionPercentage', 'completion_percentage');
  if (body.tags !== undefined) r.tags = body.tags;
  set('completed_at', 'completedAt', 'completed_at');
  return r;
}
