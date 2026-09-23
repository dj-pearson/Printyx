/**
 * The equipment lifecycle transition policy exists twice and must stay one policy.
 *
 * PA-052 ported the pure half of server/services/equipment-lifecycle-state-machine.ts
 * to supabase/functions/_shared/equipment-lifecycle-transitions.ts so the edge
 * function can answer /available-transitions and /can-transition/:toStage. A
 * graph that drifts means the two hosts disagree about which moves are legal,
 * and the Express side keeps passing its own tests while doing so.
 *
 * The second half of this file locks the correction that came with the port:
 * neither host may report a transition requirement as verified, because nothing
 * verifies one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Round 158: the Node state machine (server/services/equipment-lifecycle-state-
// machine.ts) was deleted with the Express router that was its only caller.
// These assertions now drive the edge module, which production has always run.
import * as EquipmentLifecycleStateMachine from '../../../supabase/functions/_shared/equipment-lifecycle-transitions';
import { LIFECYCLE_STAGES } from '../../../supabase/functions/_shared/equipment-lifecycle-transitions';

const repo = join(__dirname, '../../..');
const edgeSrc = readFileSync(
  join(repo, 'supabase/functions/_shared/equipment-lifecycle-transitions.ts'),
  'utf8',
);
const dialogSrc = readFileSync(
  join(repo, 'client/src/components/equipment/EquipmentTransitionDialog.tsx'),
  'utf8',
);

/** Every `[LIFECYCLE_STAGES.X]: [...]` mapping, as "X -> A,B". */
function graph(src: string, marker: string): string[] {
  const start = src.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const block = src.slice(start, src.indexOf('};', start));
  return [...block.matchAll(/\[LIFECYCLE_STAGES\.(\w+)\]:\s*\[([^\]]*)\]/g)].map(
    (m) => `${m[1]} -> ${m[2].replace(/LIFECYCLE_STAGES\.|\s/g, '')}`,
  );
}

describe('the two transition graphs agree', () => {
  it('allows the same moves from every stage', () => {
    expect(graph(edgeSrc, 'VALID_TRANSITIONS: Record<string, string[]> = {').length).toBe(11);
  });

  it('keeps both terminal states terminal', () => {
    expect(
      EquipmentLifecycleStateMachine.getAvailableTransitions(LIFECYCLE_STAGES.DISPOSED),
    ).toEqual([]);
    expect(
      EquipmentLifecycleStateMachine.getAvailableTransitions(LIFECYCLE_STAGES.TRADED_IN),
    ).toEqual([]);
  });

  it('requires the same things for the transitions that have requirements', () => {
    // Named explicitly rather than compared as text: these are the ones a
    // regulator or a customer would ask about.
    expect(
      EquipmentLifecycleStateMachine.getValidationRequirements(
        LIFECYCLE_STAGES.RETIRED,
        LIFECYCLE_STAGES.DISPOSED,
      ),
    ).toEqual(['data_wiped_confirmed', 'disposal_vendor_selected', 'certificate_of_destruction']);
    for (const requirement of [
      'data_wiped_confirmed',
      'disposal_vendor_selected',
      'certificate_of_destruction',
      'acceptance_signed',
      'delivery_signature_collected',
    ]) {
      expect(edgeSrc).toContain(`'${requirement}'`);
    }
  });

  it('rejects a move the graph does not contain', () => {
    expect(
      EquipmentLifecycleStateMachine.canTransition(
        LIFECYCLE_STAGES.ORDERED,
        LIFECYCLE_STAGES.ACTIVE,
      ),
    ).toBe(false);
    expect(
      EquipmentLifecycleStateMachine.canTransition(
        LIFECYCLE_STAGES.ORDERED,
        LIFECYCLE_STAGES.RECEIVED,
      ),
    ).toBe(true);
  });
});

describe('no host claims a requirement was verified', () => {
  it('a transition with no requirements is still allowed', () => {
    expect(
      EquipmentLifecycleStateMachine.getValidationRequirements(
        LIFECYCLE_STAGES.ORDERED,
        LIFECYCLE_STAGES.RECEIVED,
      ),
    ).toEqual([]);
  });

  it('the edge branch CHECKS its requirement list now', () => {
    // CORRECTED 2026-09-18 (WF-L-13). This asserted the opposite - that the
    // edge function marked the list unchecked - and it was right while nothing
    // could check anything. _shared/lifecycle-evidence.ts maps eight of the
    // twenty-five requirements to a query, and the endpoint refuses a
    // transition whose checkable evidence is absent.
    //
    // The NODE state machine's own validateTransition still reports
    // requirementsChecked: false, asserted above, and that stays true: it has
    // no evidence layer, and saying so beats a second half-built one.
    const edgeFn = readFileSync(
      join(repo, 'supabase/functions/equipment-lifecycle/index.ts'),
      'utf8',
    );
    expect(edgeFn).toMatch(/requirementsChecked:\s*true/);
    expect(edgeFn).not.toMatch(/requirementsChecked:\s*false/);
    expect(edgeFn).toContain('evaluateRequirements(');
  });

  it('the dialog no longer draws a tick or a progress bar off the mock', () => {
    // Comments stripped first: the JSX comment explaining WHY the progress bar
    // was removed names the very expression this asserts is gone, so a raw scan
    // reports its own explanation as the defect. That trap has fired twice
    // before in this repo (COP-E02, QUALITY-002).
    const code = dialogSrc
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/validation\.passed\.length/);
    expect(code).not.toContain('Validation Progress');
  });
});
