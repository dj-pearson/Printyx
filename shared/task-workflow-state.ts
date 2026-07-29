/**
 * Task workflow state machine — PURE decision logic (TWF-### / EDGE-024).
 *
 * The stage math that decides what a workflow does next: which stage is
 * current, whether a stage is finished, and what the step statuses look like
 * after a completion / advance / regress. Extracted from
 * server/services/task-workflow/engine.ts so the Express engine and the
 * `task-workflows` edge function make the SAME decisions, and so those
 * decisions are pinned by server/tests/unit/task-workflow-state.test.ts.
 *
 * SAME ARRANGEMENT AS shared/contract-pnl-math.ts and shared/quote-math.ts:
 * Deno cannot import from `shared/`, so the edge function replicates these
 * functions inline. KEEP THE TWO IN SYNC.
 *
 * DELIBERATELY FREE OF I/O. Every function here takes step rows and returns a
 * decision or a new array — no db, no notifications, no clock. That is what
 * makes the transitions testable without a database, and it is why the risky
 * half of the port (the state machine) can be verified while the mechanical
 * half (the writes) is reviewed by eye.
 */

/** A step's status is terminal when it no longer blocks its stage. */
export const TERMINAL_STEP_STATUSES: ReadonlySet<string> = new Set(['completed', 'skipped']);

/** The subset of a step row the state machine actually reasons about. */
export interface StateStep {
  id: string;
  stageIndex: number;
  status: string;
}

export function isTerminal(status: string): boolean {
  return TERMINAL_STEP_STATUSES.has(status);
}

/** Steps belonging to one stage. */
export function stepsInStage<T extends StateStep>(steps: T[], stageIndex: number): T[] {
  return steps.filter((s) => s.stageIndex === stageIndex);
}

/**
 * Lowest stageIndex that still has a non-terminal step; -1 when every step is
 * terminal (i.e. the workflow is finished).
 *
 * -1 is a SENTINEL, not an error: callers branch on `>= 0` to decide between
 * activating the next stage and completing the workflow, and it is also written
 * to workflows.currentStageIndex on completion.
 */
export function computeCurrentStageIndex<T extends StateStep>(steps: T[]): number {
  const incomplete = steps.filter((s) => !isTerminal(s.status));
  if (incomplete.length === 0) return -1;
  return Math.min(...incomplete.map((s) => s.stageIndex));
}

/** True when every step in `stageIndex` is terminal. An EMPTY stage counts as done. */
export function isStageComplete<T extends StateStep>(steps: T[], stageIndex: number): boolean {
  return stepsInStage(steps, stageIndex).every((s) => isTerminal(s.status));
}

/** Step statuses after marking one step completed. Pure — returns a new array. */
export function applyStepCompletion<T extends StateStep>(steps: T[], stepId: string): T[] {
  return steps.map((s) => (s.id === stepId ? { ...s, status: 'completed' } : s));
}

/**
 * Step statuses after a PM advances past `stageIndex`: every NON-TERMINAL step
 * in that stage becomes 'skipped'. Already-completed steps keep their status —
 * advancing must not rewrite history.
 */
export function applyStageSkip<T extends StateStep>(steps: T[], stageIndex: number): T[] {
  return steps.map((s) =>
    s.stageIndex === stageIndex && !isTerminal(s.status) ? { ...s, status: 'skipped' } : s,
  );
}

/**
 * Step statuses after a PM regresses to `toStageIndex`: every step at or after
 * that stage resets to 'pending', INCLUDING completed ones — that is the point
 * of sending work back for revisions.
 */
export function applyRegress<T extends StateStep>(steps: T[], toStageIndex: number): T[] {
  return steps.map((s) => (s.stageIndex >= toStageIndex ? { ...s, status: 'pending' } : s));
}

/**
 * What completing `stepId` implies, without performing it.
 *
 *   stageAdvanced — the step's stage became fully terminal
 *   nextStage     — the stage to activate next, or -1 when the workflow is done
 *   workflowDone  — nextStage < 0 (the workflow should be completed)
 *
 * Mirrors the branch in engine.completeStep so both runtimes agree on when a
 * completion cascades into an advance or finishes the workflow.
 */
export function completionOutcome<T extends StateStep>(
  steps: T[],
  stepId: string,
): { stageAdvanced: boolean; fromStage: number | null; nextStage: number; workflowDone: boolean } {
  const step = steps.find((s) => s.id === stepId);
  if (!step) return { stageAdvanced: false, fromStage: null, nextStage: -1, workflowDone: false };

  const updated = applyStepCompletion(steps, stepId);
  const stageAdvanced = isStageComplete(updated, step.stageIndex);
  const nextStage = stageAdvanced ? computeCurrentStageIndex(updated) : step.stageIndex;

  return {
    stageAdvanced,
    fromStage: step.stageIndex,
    nextStage,
    workflowDone: stageAdvanced && nextStage < 0,
  };
}

/** Steps a stage activation should switch to 'active' — the non-terminal ones. */
export function stepsToActivate<T extends StateStep>(steps: T[], stageIndex: number): T[] {
  return stepsInStage(steps, stageIndex).filter((s) => !isTerminal(s.status));
}
