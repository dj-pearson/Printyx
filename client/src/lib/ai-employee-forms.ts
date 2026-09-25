/**
 * AI Employee create and assign payloads (round 220).
 *
 * Both buttons on /ai-employees had no handler while the endpoints behind them
 * existed: POST /ai-employees creates a row from a template in the catalogue
 * GET /ai-employees/templates serves, and POST /ai-employees/tasks assigns a
 * task and starts it. These build exactly the bodies those two zod schemas
 * accept (supabase/functions/ai-employee/handlers/{employees,tasks}.ts), so a
 * form cannot send a key the server would reject or silently ignore.
 */

export interface AiEmployeeTemplate {
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
  expertiseAreas?: string[];
  autonomyLevel?: string;
}

const AUTONOMY = ['supervised', 'semi_autonomous', 'autonomous'] as const;
type Autonomy = (typeof AUTONOMY)[number];

export interface CreateEmployeeBody {
  employeeName: string;
  employeeType: string;
  employeeRole: string;
  aiCapabilities: string[];
  aiExpertiseAreas: string[];
  autonomyLevel: Autonomy;
}

/** null when the form cannot be sent: no template, or a blank name. */
export function createEmployeeBody(
  template: AiEmployeeTemplate | null | undefined,
  name: string,
): CreateEmployeeBody | null {
  const employeeName = name.trim();
  if (!template || !employeeName) return null;
  // An autonomy the enum does not carry would 400; the template's own value
  // wins, otherwise the least autonomous one, never a guess upward.
  const autonomyLevel = (AUTONOMY as readonly string[]).includes(template.autonomyLevel ?? '')
    ? (template.autonomyLevel as Autonomy)
    : 'supervised';
  return {
    employeeName: employeeName.slice(0, 255),
    employeeType: template.id,
    employeeRole: template.name,
    aiCapabilities: template.capabilities ?? [],
    aiExpertiseAreas: template.expertiseAreas ?? [],
    autonomyLevel,
  };
}

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface AssignTaskBody {
  employeeId: string;
  taskType: string;
  taskTitle: string;
  taskDescription: string;
  taskPriority: TaskPriority;
}

/** null when the form cannot be sent: no employee, no type, or a blank title. */
export function assignTaskBody(
  employeeId: string | null | undefined,
  input: { taskType: string; taskTitle: string; taskDescription: string; taskPriority: string },
): AssignTaskBody | null {
  const taskTitle = input.taskTitle.trim();
  const taskType = input.taskType.trim();
  if (!employeeId || !taskTitle || !taskType) return null;
  const taskPriority = (TASK_PRIORITIES as readonly string[]).includes(input.taskPriority)
    ? (input.taskPriority as TaskPriority)
    : 'medium';
  return {
    employeeId,
    taskType,
    taskTitle,
    taskDescription: input.taskDescription.trim(),
    taskPriority,
  };
}
