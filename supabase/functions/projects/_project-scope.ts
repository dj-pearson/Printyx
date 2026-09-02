/**
 * What a project is, and what it covers (WF-P-07).
 *
 * Pure so vitest can load it: index.ts pulls in _shared/supabase.ts, which reads
 * Deno.env at module load.
 *
 * The interesting part is `serialsForProject`. A project has no equipment column
 * and did not get one - the units it covers are the ones ordered against its
 * contract, which is a chain WF-L-04 already built:
 *
 *   projects.contract_id -> purchase_orders.source_contract_id
 *                        -> equipment.purchase_order_id
 *
 * A project with no contract cannot answer the question at all, and says so
 * instead of returning [] - an empty list on that panel reads as "nothing was
 * ordered", which is a different and wrong statement.
 */

export const PROJECT_TYPES = ['installation', 'migration', 'expansion', 'training'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

/** sales_handoff_checklists.handoff_type -> what kind of project it produces. */
const HANDOFF_TYPE_TO_PROJECT_TYPE: Record<string, ProjectType> = {
  new_customer: 'installation',
  expansion: 'expansion',
  renewal: 'installation',
  migration: 'migration',
};

export function projectTypeForHandoff(handoffType: unknown): ProjectType {
  const key = typeof handoffType === 'string' ? handoffType.trim().toLowerCase() : '';
  return HANDOFF_TYPE_TO_PROJECT_TYPE[key] ?? 'installation';
}

export interface Milestone {
  name: string;
  description?: string;
  dueDate?: string | null;
  completedDate?: string | null;
  status: string;
}

/**
 * The phases an install goes through. A starting checklist, editable from the
 * moment it exists - the same shape WF-C-06 gives a handoff its tasks.
 */
export const DEFAULT_INSTALL_MILESTONES: readonly Milestone[] = [
  { name: 'Site survey', description: 'Confirm power, network and placement', status: 'pending' },
  { name: 'Equipment ordered', description: 'Purchase order raised and sent', status: 'pending' },
  {
    name: 'Equipment received',
    description: 'Units received and serials recorded',
    status: 'pending',
  },
  { name: 'Delivery and install', description: 'Units placed and networked', status: 'pending' },
  { name: 'User training', description: 'Key users trained on the fleet', status: 'pending' },
  { name: 'Go live', description: 'Customer signed off', status: 'pending' },
];

export function defaultMilestonesFor(projectType: string): Milestone[] {
  if (projectType === 'training') {
    return [
      { name: 'Schedule sessions', status: 'pending' },
      { name: 'Deliver training', status: 'pending' },
      { name: 'Customer sign-off', status: 'pending' },
    ];
  }
  return DEFAULT_INSTALL_MILESTONES.map((m) => ({ ...m }));
}

/** Milestones with a completedDate or a completed status. */
export function milestoneProgress(milestones: unknown): { total: number; completed: number } {
  const list = Array.isArray(milestones) ? milestones : [];
  let completed = 0;
  for (const m of list) {
    const row = m as Milestone | null;
    if (!row || typeof row !== 'object') continue;
    if (row.completedDate || String(row.status ?? '').toLowerCase() === 'completed') completed += 1;
  }
  return { total: list.length, completed };
}

/**
 * Every column `projects` has. A write is built by picking from this map, so a
 * key the table does not have never reaches PostgREST - an unknown column is a
 * PGRST204 that fails the WHOLE insert, not a dropped field.
 */
const WRITABLE: Array<[column: string, camel: string]> = [
  ['name', 'name'],
  ['description', 'description'],
  ['status', 'status'],
  ['customer_id', 'customerId'],
  ['contract_id', 'contractId'],
  ['handoff_id', 'handoffId'],
  ['project_type', 'projectType'],
  ['start_date', 'startDate'],
  ['end_date', 'endDate'],
  ['completion_percentage', 'completionPercentage'],
];

/** budget is numeric(10,2) in DOLLARS. Never multiply by 100 into it. */
export function toMoney(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

/** estimated_hours and actual_hours are integers. */
export function toWholeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Body -> row. `partial` is the PATCH shape: only keys the caller sent are
 * included, so an update never blanks a column the form did not show.
 */
export function projectRow(
  body: Record<string, unknown>,
  opts: { partial: boolean } = { partial: false },
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [column, camel] of WRITABLE) {
    const has = camel in body || column in body;
    if (!has) {
      if (!opts.partial && column === 'status') row.status = 'planning';
      continue;
    }
    // `body[camel] ?? body[column]` would turn an explicit null into undefined,
    // and an undefined key is DROPPED by both PostgREST and Drizzle - so
    // "clear the contract on this project" would silently do nothing.
    const raw = camel in body ? body[camel] : body[column];
    row[column] = raw === '' ? null : raw;
  }

  if ('budget' in body || 'estimatedBudget' in body) {
    row.budget = toMoney(body.budget ?? body.estimatedBudget);
  }
  if ('estimatedHours' in body || 'estimated_hours' in body) {
    row.estimated_hours = toWholeNumber(body.estimatedHours ?? body.estimated_hours);
  }
  if ('actualHours' in body || 'actual_hours' in body) {
    row.actual_hours = toWholeNumber(body.actualHours ?? body.actual_hours);
  }
  if ('milestones' in body) {
    row.milestones = Array.isArray(body.milestones) ? body.milestones : null;
  }

  // 'none' is what an unset shadcn Select sends; it is not a uuid.
  for (const key of ['customer_id', 'contract_id', 'handoff_id']) {
    if (row[key] === 'none') row[key] = null;
  }
  return row;
}

export interface ProjectRow {
  id: string;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  customer_id?: string | null;
  contract_id?: string | null;
  handoff_id?: string | null;
  project_type?: string | null;
  milestones?: unknown;
  start_date?: string | null;
  end_date?: string | null;
  budget?: string | number | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  created_at?: string | null;
}

export interface TaskCounts {
  taskCount: number;
  completedTaskCount: number;
}

export function taskCounts(tasks: Array<{ status?: string | null }>): TaskCounts {
  return {
    taskCount: tasks.length,
    completedTaskCount: tasks.filter((t) => t.status === 'completed').length,
  };
}

/**
 * Percent complete from the tasks, and null - not 0 - when there are none.
 * A project nobody has broken into tasks yet is not a project that is 0% done.
 */
export function completionFromTasks(counts: TaskCounts): number | null {
  if (counts.taskCount === 0) return null;
  return Math.round((counts.completedTaskCount / counts.taskCount) * 100);
}

export function mapProject(project: ProjectRow, counts: TaskCounts) {
  const milestones = Array.isArray(project.milestones) ? (project.milestones as Milestone[]) : [];
  return {
    id: project.id,
    name: project.name ?? null,
    description: project.description ?? null,
    status: project.status ?? null,
    projectType: project.project_type ?? null,
    customerId: project.customer_id ?? null,
    contractId: project.contract_id ?? null,
    handoffId: project.handoff_id ?? null,
    milestones,
    milestoneProgress: milestoneProgress(milestones),
    startDate: project.start_date ?? null,
    endDate: project.end_date ?? null,
    budget: project.budget ?? null,
    estimatedHours: project.estimated_hours ?? null,
    actualHours: project.actual_hours ?? null,
    taskCount: counts.taskCount,
    completedTaskCount: counts.completedTaskCount,
    completionPercentage: completionFromTasks(counts),
    createdAt: project.created_at ?? null,
  };
}

export interface EquipmentRow {
  id: string;
  serial_number?: string | null;
  model_number?: string | null;
  manufacturer?: string | null;
  equipment_status?: string | null;
  customer_id?: string | null;
  install_date?: string | null;
  purchase_order_id?: string | null;
}

export interface PurchaseOrderRow {
  id: string;
  po_number?: string | null;
  source_contract_id?: string | null;
}

export interface ProjectSerials {
  serials: Array<{
    id: string;
    serialNumber: string | null;
    modelNumber: string | null;
    manufacturer: string | null;
    status: string | null;
    installDate: string | null;
    poNumber: string | null;
  }>;
  unbacked: string[];
}

/**
 * The units ordered against this project's contract.
 *
 * `unbacked` names what could not be answered instead of letting an empty array
 * stand in for it: no contract on the project, or a contract with no purchase
 * order yet. Both are ordinary states early in an install and neither means
 * "no equipment".
 */
export function serialsForProject(
  project: Pick<ProjectRow, 'contract_id'>,
  data: { purchaseOrders: PurchaseOrderRow[]; equipment: EquipmentRow[] },
): ProjectSerials {
  if (!project.contract_id) {
    return {
      serials: [],
      unbacked: [
        'Equipment is derived from the purchase orders raised against the contract this project delivers, and it has no contract.',
      ],
    };
  }
  const orders = data.purchaseOrders.filter((po) => po.source_contract_id === project.contract_id);
  if (orders.length === 0) {
    return {
      serials: [],
      unbacked: ['No purchase order has been raised against this contract yet.'],
    };
  }
  const poNumberById = new Map(orders.map((po) => [po.id, po.po_number ?? null]));
  const serials = data.equipment
    .filter((e) => e.purchase_order_id && poNumberById.has(e.purchase_order_id))
    .map((e) => ({
      id: e.id,
      serialNumber: e.serial_number ?? null,
      modelNumber: e.model_number ?? null,
      manufacturer: e.manufacturer ?? null,
      status: e.equipment_status ?? null,
      installDate: e.install_date ?? null,
      poNumber: poNumberById.get(e.purchase_order_id as string) ?? null,
    }));
  const unbacked =
    serials.length === 0
      ? ['The purchase orders on this contract have not been received, so no serials exist yet.']
      : [];
  return { serials, unbacked };
}
