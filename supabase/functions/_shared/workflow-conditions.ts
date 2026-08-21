// Workflow trigger-condition evaluation (CRMX-008 / PROD-008b).
//
// Decides whether an event payload satisfies the conditions gating a workflow
// trigger - i.e. whether an automation runs at all. Pure and import-free so both
// Deno and vitest can load it; the Express copy in
// server/services/workflow-runtime.ts is the source this was lifted from.
//
// WHY IT IS HERE: every documented trigger seam - deal.stage_changed in
// routes-deals.ts, record.created/record.updated in routes-business-records.ts -
// lives in an Express handler that the edge-function proxy shadows, so it runs
// on neither host. Dispatch has to move to the edge functions, and this is the
// half with actual logic in it.
//
// Semantics, which are load-bearing and easy to get subtly wrong:
//   - No conditions means the trigger fires. An empty list is "unconditional",
//     never "never".
//   - Conditions are grouped by conditionGroup; WITHIN a group they chain left
//     to right by each condition's own logicalOperator, and GROUPS are OR'd.
//   - The chain is a running fold, not precedence-aware: A AND B OR C reads as
//     ((A AND B) OR C). The FIRST condition's operator is ignored except for
//     NOT, because there is nothing to its left to combine with.
//   - NOT negates that one condition, then it combines as AND.

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'matches_regex';

export interface WorkflowCondition {
  conditionGroup?: string | null;
  logicalOperator?: 'AND' | 'OR' | 'NOT' | null;
  leftOperand: string;
  operator: ConditionOperator | string;
  rightOperand?: string | null;
  dataType?: string | null;
  orderIndex: number;
}

/** snake_case row from PostgREST -> the camelCase shape used here. */
export function conditionFromRow(row: Record<string, unknown>): WorkflowCondition {
  return {
    conditionGroup: (row.condition_group as string | null) ?? null,
    logicalOperator: (row.logical_operator as 'AND' | 'OR' | 'NOT' | null) ?? 'AND',
    leftOperand: String(row.left_operand ?? ''),
    operator: String(row.operator ?? ''),
    rightOperand: (row.right_operand as string | null) ?? null,
    dataType: (row.data_type as string | null) ?? null,
    orderIndex: Number(row.order_index ?? 0),
  };
}

function coerce(value: unknown, dataType?: string | null): unknown {
  if (value == null) return value;
  switch (dataType) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === true || value === 'true' || value === 1 || value === '1';
    case 'date':
      return new Date(value as string).getTime();
    default:
      return value;
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((cur, key) => (cur as never)?.[key], obj);
}

export function evaluateOne(cond: WorkflowCondition, payload: Record<string, unknown>): boolean {
  // leftOperand is a field path into the event payload. When the path resolves
  // to nothing the operand is treated as a LITERAL, which is what lets a
  // condition compare two constants.
  const rawLeft = getNestedValue(payload, cond.leftOperand);
  const left = coerce(rawLeft !== undefined ? rawLeft : cond.leftOperand, cond.dataType);
  const right = coerce(cond.rightOperand, cond.dataType);

  switch (cond.operator) {
    case 'equals':
      // Loose on purpose: rightOperand is a varchar, so a numeric payload value
      // has to match the string '5' without the caller declaring dataType.
      return left == right;
    case 'not_equals':
      return left != right;
    case 'greater_than':
      return Number(left) > Number(right);
    case 'less_than':
      return Number(left) < Number(right);
    case 'greater_than_or_equal':
      return Number(left) >= Number(right);
    case 'less_than_or_equal':
      return Number(left) <= Number(right);
    case 'contains':
      return String(left ?? '').includes(String(right ?? ''));
    case 'not_contains':
      return !String(left ?? '').includes(String(right ?? ''));
    case 'starts_with':
      return String(left ?? '').startsWith(String(right ?? ''));
    case 'ends_with':
      return String(left ?? '').endsWith(String(right ?? ''));
    case 'in':
      return String(right ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(String(left));
    case 'not_in':
      return !String(right ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(String(left));
    case 'is_null':
      // Tests the RAW resolved value, not the coerced one - otherwise the
      // literal-fallback above would make a missing field look present.
      return rawLeft == null;
    case 'is_not_null':
      return rawLeft != null;
    case 'matches_regex':
      try {
        return new RegExp(String(right)).test(String(left ?? ''));
      } catch {
        // An unparseable pattern must not fire the automation.
        return false;
      }
    default:
      // An unknown operator never fires. Failing closed matters: this gates
      // automations that send email and create orders.
      return false;
  }
}

export function evaluateConditions(
  conditions: WorkflowCondition[] | null | undefined,
  payload: Record<string, unknown>,
): boolean {
  if (!conditions || conditions.length === 0) return true;

  const groups = new Map<string, WorkflowCondition[]>();
  for (const c of conditions) {
    const key = c.conditionGroup || 'default';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const groupResults: boolean[] = [];
  for (const groupConds of groups.values()) {
    const ordered = [...groupConds].sort((a, b) => a.orderIndex - b.orderIndex);
    let acc: boolean | null = null;
    for (const cond of ordered) {
      let outcome = evaluateOne(cond, payload);
      if (cond.logicalOperator === 'NOT') outcome = !outcome;
      if (acc === null) acc = outcome;
      else if (cond.logicalOperator === 'OR') acc = acc || outcome;
      else acc = acc && outcome; // AND, and NOT which is already negated
    }
    groupResults.push(acc ?? true);
  }
  return groupResults.some(Boolean);
}
