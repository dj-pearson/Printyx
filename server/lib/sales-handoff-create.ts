/**
 * Testable core of the "create sales-handoff checklist (+ template tasks)"
 * flow (CR-024). The Express route runs `createHandoffWithTasks` inside a
 * `db.transaction(...)` so that a failure inserting the template tasks rolls
 * back the checklist insert — no orphan handoff with missing/partial tasks.
 *
 * The executor is typed structurally (not against Drizzle's concrete tx type)
 * so it can be driven by a fake in unit tests.
 */

export interface TemplateTaskSource {
  taskName?: string;
  description?: string;
  category?: string;
  assignToRole?: string;
  isRequired?: boolean;
  dueInDays?: number;
}

export interface BuiltHandoffTask {
  tenantId: string;
  handoffId: string;
  taskName?: string;
  description?: string;
  category?: string;
  assignedToRole?: string;
  isRequired?: boolean;
  isBlocking?: boolean;
  dueDate: Date;
}

/**
 * Map a template's task definitions into insertable handoff-task rows.
 * Pure: `now` is injected so due dates are deterministic in tests.
 */
export function buildTemplateTasks(
  tasks: TemplateTaskSource[],
  opts: { tenantId: string; handoffId: string; now: number },
): BuiltHandoffTask[] {
  const { tenantId, handoffId, now } = opts;
  return tasks.map((task) => ({
    tenantId,
    handoffId,
    taskName: task.taskName,
    description: task.description,
    category: task.category,
    assignedToRole: task.assignToRole,
    isRequired: task.isRequired,
    isBlocking: task.isRequired,
    dueDate: new Date(now + (task.dueInDays ?? 0) * 24 * 60 * 60 * 1000),
  }));
}

export interface HandoffTxExecutor {
  insert: (table: unknown) => {
    values: (rows: unknown) => {
      returning: () => Promise<Array<{ id: string }>>;
    } & Promise<unknown>;
  };
  query: {
    handoffTaskTemplates: {
      findFirst: (args: unknown) => Promise<{ tasks?: TemplateTaskSource[] | null } | undefined>;
    };
  };
}

/**
 * Insert the checklist and (optionally) its template tasks through a single
 * transaction executor. Returns the created checklist row.
 *
 * Any error thrown by the second write propagates so the enclosing
 * transaction aborts — the checklist insert is rolled back.
 */
export async function createHandoffWithTasks(
  tx: HandoffTxExecutor,
  params: {
    checklistTable: unknown;
    taskTable: unknown;
    templateWhere: (templateId: string) => unknown;
    handoffData: Record<string, unknown>;
    templateId?: string | null;
    tenantId: string;
    now: number;
  },
): Promise<{ id: string }> {
  const [handoff] = await tx.insert(params.checklistTable).values(params.handoffData).returning();

  if (params.templateId) {
    const template = await tx.query.handoffTaskTemplates.findFirst(
      params.templateWhere(params.templateId),
    );

    if (template && template.tasks) {
      const tasksToCreate = buildTemplateTasks(template.tasks, {
        tenantId: params.tenantId,
        handoffId: handoff.id,
        now: params.now,
      });

      await tx.insert(params.taskTable).values(tasksToCreate);
    }
  }

  return handoff;
}
