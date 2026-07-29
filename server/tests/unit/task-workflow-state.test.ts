import { describe, it, expect } from 'vitest';
import {
  TERMINAL_STEP_STATUSES,
  isTerminal,
  stepsInStage,
  computeCurrentStageIndex,
  isStageComplete,
  applyStepCompletion,
  applyStageSkip,
  applyRegress,
  completionOutcome,
  stepsToActivate,
  type StateStep,
} from '@shared/task-workflow-state';

/**
 * EDGE-024. These decide what a running workflow does next — which stage is
 * current, whether completing a step cascades into an advance, and what a
 * regress resets. They exist in TWO runtimes: shared/task-workflow-state.ts
 * (imported by server/services/task-workflow/engine.ts) and an inline replica
 * in supabase/functions/task-workflows/. This suite pins the transitions so the
 * replica has an exact specification, and so a Node-side drift fails CI.
 */
const step = (id: string, stageIndex: number, status: string): StateStep => ({
  id,
  stageIndex,
  status,
});

describe('task-workflow-state', () => {
  describe('terminal statuses', () => {
    it('treats completed and skipped as terminal, nothing else', () => {
      expect([...TERMINAL_STEP_STATUSES].sort()).toEqual(['completed', 'skipped']);
      expect(isTerminal('completed')).toBe(true);
      expect(isTerminal('skipped')).toBe(true);
      expect(isTerminal('active')).toBe(false);
      expect(isTerminal('pending')).toBe(false);
      // 'blocked' is NOT terminal — a blocked step still holds its stage open.
      expect(isTerminal('blocked')).toBe(false);
    });
  });

  describe('computeCurrentStageIndex', () => {
    it('returns the lowest stage with a non-terminal step', () => {
      const steps = [step('a', 0, 'completed'), step('b', 1, 'active'), step('c', 2, 'pending')];
      expect(computeCurrentStageIndex(steps)).toBe(1);
    });

    it('returns -1 when every step is terminal', () => {
      // The completion sentinel: callers branch on >= 0 to choose between
      // activating the next stage and finishing the workflow.
      expect(computeCurrentStageIndex([step('a', 0, 'completed'), step('b', 1, 'skipped')])).toBe(
        -1,
      );
    });

    it('returns -1 for an empty workflow rather than throwing', () => {
      // Math.min() of an empty array is Infinity, so the empty guard is
      // load-bearing, not decorative.
      expect(computeCurrentStageIndex([])).toBe(-1);
    });

    it('ignores stage ORDER in the array and uses the minimum index', () => {
      const steps = [step('c', 5, 'pending'), step('a', 2, 'active')];
      expect(computeCurrentStageIndex(steps)).toBe(2);
    });

    it('does not assume stage indexes are contiguous', () => {
      expect(computeCurrentStageIndex([step('a', 0, 'completed'), step('b', 7, 'pending')])).toBe(
        7,
      );
    });
  });

  describe('isStageComplete', () => {
    it('is true only when every step in the stage is terminal', () => {
      const steps = [step('a', 0, 'completed'), step('b', 0, 'skipped'), step('c', 1, 'active')];
      expect(isStageComplete(steps, 0)).toBe(true);
      expect(isStageComplete(steps, 1)).toBe(false);
    });

    it('treats a stage with no steps as complete', () => {
      // every() on an empty array is true, and that is the behaviour we want:
      // a gap in stage numbering must not stall the workflow forever.
      expect(isStageComplete([step('a', 0, 'active')], 3)).toBe(true);
    });
  });

  describe('applyStepCompletion', () => {
    it('marks only the named step and leaves the input untouched', () => {
      const steps = [step('a', 0, 'active'), step('b', 0, 'active')];
      const out = applyStepCompletion(steps, 'a');
      expect(out.map((s) => s.status)).toEqual(['completed', 'active']);
      expect(steps.map((s) => s.status)).toEqual(['active', 'active']); // pure
    });
  });

  describe('applyStageSkip (PM advance)', () => {
    it('skips the non-terminal steps of that stage only', () => {
      const steps = [step('a', 0, 'active'), step('b', 0, 'pending'), step('c', 1, 'pending')];
      expect(applyStageSkip(steps, 0).map((s) => s.status)).toEqual([
        'skipped',
        'skipped',
        'pending',
      ]);
    });

    it('does NOT rewrite already-completed steps', () => {
      // Advancing past a stage must not turn real completions into skips —
      // that would falsify the audit trail of who actually did the work.
      const steps = [step('a', 0, 'completed'), step('b', 0, 'active')];
      expect(applyStageSkip(steps, 0).map((s) => s.status)).toEqual(['completed', 'skipped']);
    });
  });

  describe('applyRegress', () => {
    it('resets everything at or after the target stage to pending', () => {
      const steps = [step('a', 0, 'completed'), step('b', 1, 'completed'), step('c', 2, 'active')];
      expect(applyRegress(steps, 1).map((s) => s.status)).toEqual([
        'completed',
        'pending',
        'pending',
      ]);
    });

    it('DOES reset completed steps — that is the point of sending work back', () => {
      // Contrast with applyStageSkip, which preserves completions. Regress is
      // destructive on purpose; getting these two backwards would either lose
      // completed work or make a revision request do nothing.
      const steps = [step('a', 2, 'completed')];
      expect(applyRegress(steps, 2)[0].status).toBe('pending');
    });
  });

  describe('completionOutcome', () => {
    it('does not advance while a sibling step in the stage is open', () => {
      const steps = [step('a', 0, 'active'), step('b', 0, 'active')];
      expect(completionOutcome(steps, 'a')).toMatchObject({
        stageAdvanced: false,
        fromStage: 0,
        nextStage: 0,
        workflowDone: false,
      });
    });

    it('advances to the next stage when the last step of a stage completes', () => {
      const steps = [step('a', 0, 'active'), step('b', 1, 'pending')];
      expect(completionOutcome(steps, 'a')).toMatchObject({
        stageAdvanced: true,
        fromStage: 0,
        nextStage: 1,
        workflowDone: false,
      });
    });

    it('reports the workflow done when the final step completes', () => {
      const steps = [step('a', 0, 'completed'), step('b', 1, 'active')];
      expect(completionOutcome(steps, 'b')).toMatchObject({
        stageAdvanced: true,
        nextStage: -1,
        workflowDone: true,
      });
    });

    it('skips over an already-terminal stage when finding the next one', () => {
      const steps = [step('a', 0, 'active'), step('b', 1, 'skipped'), step('c', 2, 'pending')];
      expect(completionOutcome(steps, 'a').nextStage).toBe(2);
    });

    it('is inert for an unknown step id', () => {
      expect(completionOutcome([step('a', 0, 'active')], 'nope')).toMatchObject({
        stageAdvanced: false,
        fromStage: null,
        workflowDone: false,
      });
    });
  });

  describe('stepsToActivate', () => {
    it('returns the non-terminal steps of the stage', () => {
      const steps = [
        step('a', 1, 'pending'),
        step('b', 1, 'blocked'),
        step('c', 1, 'completed'),
        step('d', 2, 'pending'),
      ];
      expect(stepsToActivate(steps, 1).map((s) => s.id)).toEqual(['a', 'b']);
    });

    it('returns nothing for a fully terminal stage, so no re-notification fires', () => {
      expect(stepsToActivate([step('a', 0, 'completed')], 0)).toEqual([]);
    });
  });

  describe('stepsInStage', () => {
    it('filters by stage index', () => {
      const steps = [step('a', 0, 'active'), step('b', 1, 'active')];
      expect(stepsInStage(steps, 1).map((s) => s.id)).toEqual(['b']);
    });
  });
});
