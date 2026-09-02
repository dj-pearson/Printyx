/**
 * The sales-to-operations handoff (WF-C-06).
 *
 * NOTHING REACHABLE EXISTED. Three real tables ship in shared/sales-handoff-schema.ts
 * and migration 0000 - sales_handoff_checklists, handoff_task_templates,
 * handoff_tasks - and server/routes-sales-handoff.ts served them correctly with no
 * caller anywhere. Meanwhile supabase/functions/sales-handoffs, which production
 * would actually reach, queried `sales_handoffs`: a relation named by no schema, no
 * migration and no other file in the tree, so all six of its endpoints were a
 * 42P01. Operations had no queue, and the Book Order button on contracts.tsx
 * navigated to /purchase-orders?contractId= where the id was rendered as text and
 * dropped.
 *
 * This module holds the decisions; the callers do the IO. Both hosts that create a
 * handoff are Deno (the proposals accept path and the pipeline-config stage move),
 * so one copy serves both.
 *
 * THE TEMPLATE IS BOOTSTRAPPED, NOT ASSUMED. handoff_task_templates is one of the
 * tables nothing has ever written, so "instantiate tasks from the template" would
 * produce an empty checklist on every tenant. A default template is created on
 * first use, marked is_default, as a real editable row - the same lazy bootstrap
 * pipeline-config uses. Its NOT NULL columns are all supplied, because the bug
 * COP-M07 found in exactly that pattern was a bootstrap that omitted one and could
 * therefore never succeed.
 */

export const HANDOFF_TYPES = ['new_customer', 'expansion', 'renewal', 'migration'] as const;
export type HandoffType = (typeof HANDOFF_TYPES)[number];

export const HANDOFF_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'blocked', 'skipped'] as const;

export interface TemplateTask {
  taskName: string;
  description: string;
  assignToRole: string;
  category: string;
  isRequired: boolean;
  orderIndex: number;
  dueInDays: number;
}

/**
 * The starting checklist. These are the steps a copier dealer works between a
 * signature and a working machine; each is a thing a person does, not a number
 * anything measures, so shipping a default is a starting point rather than a
 * fabricated fact. Every one is editable once the row exists.
 */
export const DEFAULT_HANDOFF_TASKS: Record<HandoffType, TemplateTask[]> = {
  new_customer: [
    {
      taskName: 'Confirm signed contract and payment terms',
      description: 'Check the executed contract against what was quoted.',
      assignToRole: 'billing',
      category: 'billing',
      isRequired: true,
      orderIndex: 1,
      dueInDays: 1,
    },
    {
      taskName: 'Handoff meeting with the sales rep',
      description: 'Walk operations through the deal: who bought, why, and what was promised.',
      assignToRole: 'implementation',
      category: 'account_setup',
      isRequired: true,
      orderIndex: 2,
      dueInDays: 3,
    },
    {
      taskName: 'Site survey',
      description: 'Confirm power, network, space and access at the install address.',
      assignToRole: 'tech',
      category: 'technical',
      isRequired: true,
      orderIndex: 3,
      dueInDays: 7,
    },
    {
      taskName: 'Order the equipment',
      description: 'Raise the purchase order for what the contract sold.',
      assignToRole: 'implementation',
      category: 'technical',
      isRequired: true,
      orderIndex: 4,
      dueInDays: 5,
    },
    {
      taskName: 'Schedule installation',
      description: 'Book the install date with the customer and the technician.',
      assignToRole: 'implementation',
      category: 'technical',
      isRequired: true,
      orderIndex: 5,
      dueInDays: 14,
    },
    {
      taskName: 'Set up billing',
      description: 'Create the billing record, meter schedule and invoice contact.',
      assignToRole: 'billing',
      category: 'billing',
      isRequired: true,
      orderIndex: 6,
      dueInDays: 14,
    },
    {
      taskName: 'End-user training',
      description: 'Train the named users on the machines they will use.',
      assignToRole: 'csm',
      category: 'training',
      isRequired: false,
      orderIndex: 7,
      dueInDays: 21,
    },
  ],
  expansion: [
    {
      taskName: 'Confirm the added equipment against the existing contract',
      description: 'Check whether this amends the contract or starts a new one.',
      assignToRole: 'billing',
      category: 'billing',
      isRequired: true,
      orderIndex: 1,
      dueInDays: 2,
    },
    {
      taskName: 'Site survey for the new units',
      description: 'Confirm power, network and space where the additions will go.',
      assignToRole: 'tech',
      category: 'technical',
      isRequired: true,
      orderIndex: 2,
      dueInDays: 7,
    },
    {
      taskName: 'Order the equipment',
      description: 'Raise the purchase order for the added units.',
      assignToRole: 'implementation',
      category: 'technical',
      isRequired: true,
      orderIndex: 3,
      dueInDays: 5,
    },
    {
      taskName: 'Schedule installation',
      description: 'Book the install with the customer and the technician.',
      assignToRole: 'implementation',
      category: 'technical',
      isRequired: true,
      orderIndex: 4,
      dueInDays: 14,
    },
    {
      taskName: 'Update the billing schedule',
      description: 'Add the new meters and rates to the existing billing run.',
      assignToRole: 'billing',
      category: 'billing',
      isRequired: true,
      orderIndex: 5,
      dueInDays: 14,
    },
  ],
  renewal: [
    {
      taskName: 'Confirm the renewal terms against the expiring contract',
      description: 'Check rates, volumes and term against what is ending.',
      assignToRole: 'billing',
      category: 'billing',
      isRequired: true,
      orderIndex: 1,
      dueInDays: 2,
    },
    {
      taskName: 'Decide the fleet: keep, refresh or return',
      description: 'Agree with the customer what happens to the machines on the old term.',
      assignToRole: 'csm',
      category: 'account_setup',
      isRequired: true,
      orderIndex: 2,
      dueInDays: 7,
    },
    {
      taskName: 'Update the billing schedule',
      description: 'Move the account onto the renewed rates on the right date.',
      assignToRole: 'billing',
      category: 'billing',
      isRequired: true,
      orderIndex: 3,
      dueInDays: 10,
    },
  ],
  migration: [
    {
      taskName: 'Inventory the incumbent fleet',
      description: 'Record what is being replaced, including serials and meter reads.',
      assignToRole: 'tech',
      category: 'technical',
      isRequired: true,
      orderIndex: 1,
      dueInDays: 5,
    },
    {
      taskName: 'Agree the removal plan',
      description: 'Who collects the old machines, when, and who settles the buyout.',
      assignToRole: 'implementation',
      category: 'technical',
      isRequired: true,
      orderIndex: 2,
      dueInDays: 7,
    },
    {
      taskName: 'Order the replacement equipment',
      description: 'Raise the purchase order for the incoming fleet.',
      assignToRole: 'implementation',
      category: 'technical',
      isRequired: true,
      orderIndex: 3,
      dueInDays: 5,
    },
    {
      taskName: 'Schedule the swap',
      description: 'Book installation and removal so the customer is never without a machine.',
      assignToRole: 'implementation',
      category: 'technical',
      isRequired: true,
      orderIndex: 4,
      dueInDays: 14,
    },
    {
      taskName: 'Set up billing and close the old contract',
      description: 'Start the new schedule and final-bill the one it replaces.',
      assignToRole: 'billing',
      category: 'billing',
      isRequired: true,
      orderIndex: 5,
      dueInDays: 14,
    },
  ],
};

export function normalizeHandoffType(value: unknown): HandoffType | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return (HANDOFF_TYPES as readonly string[]).includes(v) ? (v as HandoffType) : null;
}

/**
 * Which kind of handoff this sale is. Derived from the deal's motion when the
 * deal carries one (COP-M04 added dealMotion) and from whether the customer
 * already has a contract otherwise - not defaulted to new_customer, which would
 * hand an existing account the wrong checklist.
 */
export function handoffTypeFor(input: {
  dealMotion?: string | null;
  existingContractCount?: number | null;
}): HandoffType {
  const motion = (input.dealMotion ?? '').trim().toLowerCase();
  if (motion === 'renewal') return 'renewal';
  if (motion === 'expansion') return 'expansion';
  if (
    motion === 'fleet_refresh' ||
    motion === 'lease_rollover' ||
    motion === 'competitive_takeaway'
  )
    return 'migration';
  if (motion === 'new_logo') return 'new_customer';
  return (input.existingContractCount ?? 0) > 0 ? 'expansion' : 'new_customer';
}

/** The handoff_task_templates row to create when a tenant has none. */
export function defaultTemplateRow(
  tenantId: string,
  handoffType: HandoffType,
  createdBy: string | null,
  now = new Date().toISOString(),
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    // Every NOT NULL column, deliberately: COP-M07's lazy bootstrap omitted one
    // and could therefore never succeed on any tenant.
    template_name: `Default ${handoffType.replace(/_/g, ' ')} handoff`,
    handoff_type: handoffType,
    description: 'Created automatically on the first handoff of this type. Edit freely.',
    tasks: DEFAULT_HANDOFF_TASKS[handoffType],
    is_active: true,
    is_default: true,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
  };
}

export interface HandoffSource {
  tenantId: string;
  customerId: string;
  contractId?: string | null;
  opportunityId?: string | null;
  salesRepId: string;
  salesRepName?: string | null;
  handoffType: HandoffType;
  contractSummary?: Record<string, unknown> | null;
  salesNotes?: string | null;
}

/** The sales_handoff_checklists row. */
export function buildHandoffChecklist(
  source: HandoffSource,
  now = new Date().toISOString(),
): Record<string, unknown> {
  return {
    tenant_id: source.tenantId,
    customer_id: source.customerId,
    contract_id: source.contractId ?? null,
    opportunity_id: source.opportunityId ?? null,
    status: 'pending',
    handoff_type: source.handoffType,
    sales_rep_id: source.salesRepId,
    sales_rep_name: source.salesRepName ?? null,
    contract_summary: source.contractSummary ?? null,
    sales_notes: source.salesNotes ?? null,
    completion_percentage: 0,
    required_fields_complete: false,
    ready_for_implementation: false,
    initiated_at: now,
    created_at: now,
    updated_at: now,
  };
}

/**
 * handoff_tasks rows from a template's task list.
 *
 * dueDate is derived from dueInDays off the handoff date rather than stored as an
 * offset, because operations filters and sorts on a date. `isBlocking` mirrors
 * isRequired: a required step that is not done is precisely what should stop a
 * handoff being marked complete.
 */
export function instantiateHandoffTasks(
  tasks: TemplateTask[] | null | undefined,
  handoffId: string,
  tenantId: string,
  startedAt = new Date().toISOString(),
): Record<string, unknown>[] {
  const start = new Date(startedAt);
  return [...(tasks ?? [])]
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((task) => {
      const due = new Date(start.getTime());
      due.setUTCDate(due.getUTCDate() + Math.max(0, Number(task.dueInDays ?? 0)));
      return {
        tenant_id: tenantId,
        handoff_id: handoffId,
        task_name: task.taskName,
        description: task.description ?? null,
        category: task.category,
        assigned_to_role: task.assignToRole ?? null,
        status: 'pending',
        is_required: task.isRequired !== false,
        is_blocking: task.isRequired !== false,
        due_date: due.toISOString(),
        created_at: startedAt,
        updated_at: startedAt,
      };
    });
}

/** Percentage of tasks done, and whether the required ones all are. */
export function handoffProgress(
  tasks: Array<{ status?: string | null; is_required?: boolean | null }>,
): { completionPercentage: number; requiredComplete: boolean } {
  if (tasks.length === 0) return { completionPercentage: 0, requiredComplete: false };
  const done = (t: { status?: string | null }) =>
    t.status === 'completed' || t.status === 'skipped';
  const completed = tasks.filter(done).length;
  const required = tasks.filter((t) => t.is_required !== false);
  return {
    completionPercentage: Math.round((completed / tasks.length) * 100),
    // No required tasks at all is not "all required tasks done" - it means the
    // template said nothing was mandatory, which is a different claim.
    requiredComplete: required.length > 0 && required.every(done),
  };
}
