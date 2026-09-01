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
import {
  EquipmentLifecycleStateMachine,
  LIFECYCLE_STAGES,
} from '../../services/equipment-lifecycle-state-machine';

const repo = join(__dirname, '../../..');
const edgeSrc = readFileSync(
  join(repo, 'supabase/functions/_shared/equipment-lifecycle-transitions.ts'),
  'utf8',
);
const nodeSrc = readFileSync(
  join(repo, 'server/services/equipment-lifecycle-state-machine.ts'),
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
    const node = graph(nodeSrc, 'VALID_TRANSITIONS: Record<string, string[]> = {');
    expect(node.length).toBe(11);
    expect(graph(edgeSrc, 'VALID_TRANSITIONS: Record<string, string[]> = {')).toEqual(node);
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
  it('the Node validator reports every requirement outstanding', async () => {
    const result = await EquipmentLifecycleStateMachine.validateTransition(
      'equipment-1',
      LIFECYCLE_STAGES.RETIRED,
      LIFECYCLE_STAGES.DISPOSED,
    );

    // It used to answer passed:true with "<requirement> verified" for each one.
    expect(result.passed).toEqual([]);
    expect(result.failed).toHaveLength(3);
    expect(result.failed.every((f) => f.passed === false)).toBe(true);
    expect(result.requirementsChecked).toBe(false);
    for (const check of result.failed) {
      expect(check.message).not.toMatch(/verified$/);
    }
  });

  it('a transition with no requirements is still allowed', () => {
    expect(
      EquipmentLifecycleStateMachine.getValidationRequirements(
        LIFECYCLE_STAGES.ORDERED,
        LIFECYCLE_STAGES.RECEIVED,
      ),
    ).toEqual([]);
  });

  it('the edge branch marks its requirement list unchecked', () => {
    const edgeFn = readFileSync(
      join(repo, 'supabase/functions/equipment-lifecycle/index.ts'),
      'utf8',
    );
    expect(edgeFn).toMatch(/requirementsChecked:\s*false/);
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
