/**
 * Creating a handoff, in one place (WF-C-06).
 *
 * Three call sites need it and all three are Deno: the POST endpoint on the
 * sales-handoffs function, proposal acceptance, and the closed-won stage move.
 * The decisions are in ./sales-handoff.ts; this does the IO around them.
 *
 * IT IS IDEMPOTENT ON THE CONTRACT. Acceptance and the closed-won move fire from
 * the same sale seconds apart - a proposal accepted online moves the deal to won
 * AND creates the contract - so without this check operations would get the same
 * handoff twice on every deal, which is worse than getting none.
 */

import {
  buildHandoffChecklist,
  DEFAULT_HANDOFF_TASKS,
  defaultTemplateRow,
  instantiateHandoffTasks,
  type HandoffType,
  type TemplateTask,
} from './sales-handoff.ts';

// deno-lint-ignore no-explicit-any
type Admin = any;

export interface CreateHandoffInput {
  tenantId: string;
  customerId: string;
  contractId?: string | null;
  opportunityId?: string | null;
  salesRepId: string;
  salesRepName?: string | null;
  handoffType: HandoffType;
  contractSummary?: Record<string, unknown> | null;
  salesNotes?: string | null;
  createdBy?: string | null;
}

export interface CreateHandoffResult {
  handoff: Record<string, unknown> | null;
  taskCount: number;
  /** Set when an existing handoff was returned instead of a new one. */
  existing?: boolean;
  error?: string;
}

/** The tenant's template for this type, bootstrapping a default when it has none. */
export async function ensureHandoffTemplate(
  admin: Admin,
  tenantId: string,
  handoffType: HandoffType,
  createdBy: string | null,
): Promise<TemplateTask[]> {
  /**
   * SEC-EDGE-001 round 91: THE TIEBREAK IS THE POINT. `is_default` alone left the
   * winner to whatever order Postgres happened to return once a tenant had two
   * default rows for one handoff type - which the create path allowed, because it
   * accepted isDefault: true without clearing the others. That is the
   * renewal-playbooks shape: arbitrary selection wearing matching logic's
   * clothes. The edge function clears other defaults now, and this orders by
   * updated_at and then id so the answer is deterministic whatever the table
   * holds - a reader should not depend on every writer having behaved.
   */
  const { data: templates } = await admin
    .from('handoff_task_templates')
    .select('id, tasks, is_default, is_active')
    .eq('tenant_id', tenantId)
    .eq('handoff_type', handoffType)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(1);

  const existing = templates?.[0];
  const storedTasks = Array.isArray(existing?.tasks) ? (existing.tasks as TemplateTask[]) : null;
  if (storedTasks && storedTasks.length > 0) return storedTasks;

  /**
   * AN EMPTY ARRAY IS TRUTHY, so `if (existing?.tasks)` handed operations a
   * checklist with nothing on it and reported success - a queue nobody can work,
   * indistinguishable from one nobody has got to. A template with no tasks is
   * not a usable template.
   *
   * What it must NOT do is bootstrap: a row already exists, so inserting another
   * on every handoff would pile up duplicates for as long as the empty one stays
   * active. The default tasks are returned without a write, and the row is left
   * alone because the tenant may be midway through authoring it.
   */
  if (existing) return DEFAULT_HANDOFF_TASKS[handoffType];

  const row = defaultTemplateRow(tenantId, handoffType, createdBy);
  const { data: created, error } = await admin
    .from('handoff_task_templates')
    .insert(row)
    .select('tasks')
    .single();

  // A template that could not be stored still yields the tasks: an operations
  // queue with a checklist beats one with an empty list because a side table
  // write failed.
  if (error || !created) return row.tasks as TemplateTask[];
  return created.tasks as TemplateTask[];
}

export async function createHandoff(
  admin: Admin,
  input: CreateHandoffInput,
): Promise<CreateHandoffResult> {
  // See the header: acceptance and the closed-won move fire from the same sale.
  if (input.contractId) {
    const { data: already } = await admin
      .from('sales_handoff_checklists')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('contract_id', input.contractId)
      .limit(1);
    if (already?.[0]) return { handoff: already[0], taskCount: 0, existing: true };
  }

  const { data: handoff, error } = await admin
    .from('sales_handoff_checklists')
    .insert(buildHandoffChecklist(input))
    .select()
    .single();

  if (error || !handoff) {
    console.error('Error creating sales handoff:', error);
    return { handoff: null, taskCount: 0, error: 'Failed to create sales handoff' };
  }

  const tasks = await ensureHandoffTemplate(
    admin,
    input.tenantId,
    input.handoffType,
    input.createdBy ?? input.salesRepId,
  );
  const rows = instantiateHandoffTasks(tasks, String(handoff.id), input.tenantId);

  if (rows.length > 0) {
    const { error: taskError } = await admin.from('handoff_tasks').insert(rows);
    if (taskError) {
      // CR-024 established on the Express side that a checklist with no tasks is
      // a partial write reported as success, and made the two writes one
      // transaction. PostgREST cannot do that across two inserts, so the
      // equivalent here is a compensating delete: the alternative is an empty
      // handoff in operations' queue that looks worked-through because every one
      // of its zero tasks is done.
      console.error('Error creating handoff tasks:', taskError);
      await admin
        .from('sales_handoff_checklists')
        .delete()
        .eq('id', handoff.id)
        .eq('tenant_id', input.tenantId);
      return { handoff: null, taskCount: 0, error: 'Failed to create the handoff tasks' };
    }
  }

  return { handoff, taskCount: rows.length };
}
