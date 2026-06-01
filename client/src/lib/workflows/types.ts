/**
 * Task Workflow — frontend types + small helpers.
 * Mirrors shared/task-workflow-schema.ts (kept local to avoid importing server
 * Drizzle types into the client bundle).
 */

export type WorkflowStatus = 'draft' | 'active' | 'completed' | 'archived' | 'cancelled';
export type StepStatus = 'pending' | 'active' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
export type WorkflowSource = 'manual' | 'image' | 'csv' | 'xlsx' | 'template';

export interface TaskWorkflow {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  isTemplate: boolean;
  templateId: string | null;
  ownerId: string;
  projectManagerId: string | null;
  currentStageIndex: number;
  sourceType: WorkflowSource;
  sourceFileName: string | null;
  settings: Record<string, any> | null;
  createdBy: string;
  lastModifiedBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
  stepCount?: number;
  completedStepCount?: number;
}

export interface TaskWorkflowStep {
  id: string;
  tenantId: string;
  workflowId: string;
  title: string;
  details: string | null;
  stageIndex: number;
  orderIndex: number;
  assigneeUserId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  status: StepStatus;
  dueAt: string | null;
  notifiedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TaskWorkflowEvent {
  id: string;
  workflowId: string;
  stepId: string | null;
  eventType: string;
  actorUserId: string | null;
  fromStageIndex: number | null;
  toStageIndex: number | null;
  note: string | null;
  metadata: Record<string, any> | null;
  createdAt: string | null;
}

export interface WorkflowDetail {
  workflow: TaskWorkflow;
  steps: TaskWorkflowStep[];
  events?: TaskWorkflowEvent[];
}

/** A draft step as returned by the /parse endpoint, before saving. */
export interface ParsedWorkflowStep {
  title: string;
  details?: string;
  stageIndex: number;
  assigneeName?: string;
  suggestedAssigneeUserId?: string | null;
  matchConfidence?: number;
}

export interface ParsedWorkflowDraft {
  suggestedName?: string;
  sourceType: 'manual' | 'image' | 'csv' | 'xlsx';
  sourceFileName?: string;
  steps: ParsedWorkflowStep[];
  unmatchedAssignees: string[];
}

export interface OrgUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export function userLabel(u?: OrgUser | null): string {
  if (!u) return 'Unassigned';
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || u.id;
}

export function userInitials(u?: OrgUser | null): string {
  if (!u) return '?';
  const f = (u.firstName || '').charAt(0);
  const l = (u.lastName || '').charAt(0);
  const init = `${f}${l}`.trim();
  if (init) return init.toUpperCase();
  return (u.email || '?').charAt(0).toUpperCase();
}

export const STEP_STATUS_META: Record<StepStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700' },
  active: { label: 'Assigned', className: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  blocked: { label: 'Blocked', className: 'bg-red-100 text-red-800' },
  skipped: { label: 'Skipped', className: 'bg-gray-100 text-gray-500' },
};

export const WORKFLOW_STATUS_META: Record<WorkflowStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
  active: { label: 'Active', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
};

/** Group steps by stageIndex, sorted, for stage-based rendering. */
export function groupStepsByStage(
  steps: TaskWorkflowStep[],
): { stageIndex: number; steps: TaskWorkflowStep[] }[] {
  const map = new Map<number, TaskWorkflowStep[]>();
  for (const s of steps) {
    if (!map.has(s.stageIndex)) map.set(s.stageIndex, []);
    map.get(s.stageIndex)!.push(s);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([stageIndex, stageSteps]) => ({
      stageIndex,
      steps: stageSteps.sort((a, b) => a.orderIndex - b.orderIndex),
    }));
}
