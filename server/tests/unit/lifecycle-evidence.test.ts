/**
 * Lifecycle requirements are evidence now, not a claim (WF-L-13).
 *
 * The transition endpoint accepted whatever the caller said, and WROTE THE
 * CLAIM DOWN: the POST mapped every requirement to
 * `{ passed: true, message: '<name> verified' }` and stored it on the
 * transition row. PA-052 had already removed that exact fabrication from the
 * two READ paths - a technician saw "Data Wiped Confirmed - verified" and
 * "Certificate Of Destruction - verified" before disposing of a machine - and
 * the write path kept doing it, on the record rather than merely on screen.
 *
 * THE DESIGN QUESTION THIS SUITE PINS. Seventeen of the twenty-five requirement
 * strings have no table, no column and no writer. Blocking on those would have
 * made every transition in the product impossible, so they are reported as
 * UNVERIFIABLE and cannot block - a gate nothing can open is not a gate, it is
 * an outage. The eight that a table CAN answer do block, and that is what makes
 * them worth something.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AWAITING_WRITER,
  CHECKABLE_REQUIREMENTS,
  EMPTY_EVIDENCE,
  evaluateRequirement,
  evaluateRequirements,
  isCheckable,
  type EvidenceBundle,
} from '../../../supabase/functions/_shared/lifecycle-evidence.ts';
import {
  TRANSITION_REQUIREMENTS,
  getValidationRequirements,
} from '../../../supabase/functions/_shared/equipment-lifecycle-transitions.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const evidence = (over: Partial<EvidenceBundle>): EvidenceBundle => ({
  ...EMPTY_EVIDENCE,
  ...over,
});

describe('an unbacked requirement is reported, never blocking', () => {
  it('answers null rather than false', () => {
    // false would mean "checked and absent", which would block. These were
    // never checkable and never will be from this schema.
    const verdict = evaluateRequirement('certificate_of_destruction', EMPTY_EVIDENCE);
    expect(verdict.satisfied).toBeNull();
    expect(verdict.evidence).toContain('not checked');
  });

  it('so a transition made entirely of them is allowed', () => {
    const report = evaluateRequirements(
      ['data_wiped_confirmed', 'disposal_vendor_selected', 'certificate_of_destruction'],
      EMPTY_EVIDENCE,
    );
    expect(report.blocked).toBe(false);
    expect(report.unverifiable).toHaveLength(3);
    expect(report.satisfied).toEqual([]);
  });

  it('and is never counted as satisfied', () => {
    const report = evaluateRequirements(['customer_trained'], EMPTY_EVIDENCE);
    expect(report.satisfied).toEqual([]);
  });
});

describe('a checkable requirement blocks when its record is absent', () => {
  it('quality_control_passed needs a COMPLETED, PASSED kitting operation', () => {
    expect(evaluateRequirement('quality_control_passed', EMPTY_EVIDENCE).satisfied).toBe(false);
    expect(
      evaluateRequirement(
        'quality_control_passed',
        evidence({ kitting: [{ operation_status: 'completed', quality_status: 'failed' }] }),
      ).satisfied,
    ).toBe(false);
    expect(
      evaluateRequirement(
        'quality_control_passed',
        evidence({ kitting: [{ operation_status: 'completed', quality_status: 'passed' }] }),
      ).satisfied,
    ).toBe(true);
  });

  it('serial_number_verified needs serials RECORDED on the operation', () => {
    expect(
      evaluateRequirement('serial_number_verified', evidence({ kitting: [{ serial_numbers: [] }] }))
        .satisfied,
    ).toBe(false);
    expect(
      evaluateRequirement(
        'serial_number_verified',
        evidence({ kitting: [{ serial_numbers: ['SN-1'] }] }),
      ).satisfied,
    ).toBe(true);
  });

  it('delivery_scheduled ignores a cancelled run', () => {
    expect(
      evaluateRequirement(
        'delivery_scheduled',
        evidence({ deliveries: [{ scheduled_date: '2026-09-18', status: 'cancelled' }] }),
      ).satisfied,
    ).toBe(false);
  });

  it('driver_assigned is separate from delivery_scheduled', () => {
    const booked = evidence({
      deliveries: [{ scheduled_date: '2026-09-18', status: 'scheduled' }],
    });
    expect(evaluateRequirement('delivery_scheduled', booked).satisfied).toBe(true);
    expect(evaluateRequirement('driver_assigned', booked).satisfied).toBe(false);
  });

  it('a delivery signature does NOT satisfy acceptance_signed', () => {
    // Two events: a driver collects one at the door, the customer accepts the
    // installed unit afterwards.
    const delivered = evidence({
      signatures: [{ signature_type: 'delivery', signer_name: 'A', signature_data_url: 'data:x' }],
    });
    expect(evaluateRequirement('delivery_signature_collected', delivered).satisfied).toBe(true);
    expect(evaluateRequirement('acceptance_signed', delivered).satisfied).toBe(false);
  });

  it('delivery_signature is the same requirement under a second name', () => {
    // The delivered -> installed list spells it without the suffix. Treating
    // them as different things would mean asking for the same signature twice.
    const delivered = evidence({
      signatures: [{ signature_type: 'delivery', signer_name: 'A', signature_data_url: 'data:x' }],
    });
    expect(evaluateRequirement('delivery_signature', delivered).satisfied).toBe(true);
  });

  it('network_configured BLOCKS now, because WF-L-10 gave it a writer', () => {
    // CORRECTED 2026-09-18 (WF-L-10). This asserted the opposite and was right
    // at the time: onboarding_network_config had no writer anywhere, so
    // blocking on it would have bricked installed -> active for every tenant.
    // The checklist create writes the form's networkConfig step now, and
    // PUT /onboarding/:id/network-config covers an on-site change, so the gate
    // can be enforced. AWAITING_WRITER is empty and kept for the next
    // requirement in that position.
    expect(AWAITING_WRITER.has('network_configured')).toBe(false);
    const report = evaluateRequirements(['network_configured'], EMPTY_EVIDENCE);
    expect(report.blocked).toBe(true);
    expect(report.missing).toEqual(['network_configured']);
    expect(report.awaitingWriter).toEqual([]);
  });

  it('and installed -> active needs it, so the whole chain is enforced', () => {
    const withoutNetwork = evaluateRequirements(
      getValidationRequirements('installed', 'active'),
      evidence({
        installations: [{ status: 'completed' }],
        signatures: [
          { signature_type: 'installation', signer_name: 'A', signature_data_url: 'data:x' },
        ],
      }),
    );
    expect(withoutNetwork.blocked).toBe(true);
    expect(withoutNetwork.missing).toEqual(['network_configured']);

    const withNetwork = evaluateRequirements(
      getValidationRequirements('installed', 'active'),
      evidence({
        installations: [{ status: 'completed' }],
        signatures: [
          { signature_type: 'installation', signer_name: 'A', signature_data_url: 'data:x' },
        ],
        networkConfigs: [{ is_configured: true }],
      }),
    );
    expect(withNetwork.blocked).toBe(false);
  });

  it('network_configured needs is_configured true, not merely a row', () => {
    expect(
      evaluateRequirement(
        'network_configured',
        evidence({ networkConfigs: [{ is_configured: false }] }),
      ).satisfied,
    ).toBe(false);
    expect(
      evaluateRequirement(
        'network_configured',
        evidence({ networkConfigs: [{ is_configured: true }] }),
      ).satisfied,
    ).toBe(true);
  });

  it('installation_completed needs a completed schedule', () => {
    expect(
      evaluateRequirement(
        'installation_completed',
        evidence({ installations: [{ status: 'scheduled' }] }),
      ).satisfied,
    ).toBe(false);
    expect(
      evaluateRequirement(
        'installation_completed',
        evidence({ installations: [{ status: 'completed' }] }),
      ).satisfied,
    ).toBe(true);
  });
});

describe('a mixed transition reports all three states', () => {
  it('blocks on the checkable one and names the rest', () => {
    const report = evaluateRequirements(
      getValidationRequirements('received', 'staged'),
      evidence({ kitting: [{ operation_status: 'completed', quality_status: 'passed' }] }),
    );
    expect(report.satisfied).toEqual(['quality_control_passed']);
    expect(report.missing).toEqual(['serial_number_verified']);
    // photo_documentation has no table anywhere.
    expect(report.unverifiable).toEqual(['photo_documentation']);
    expect(report.blocked).toBe(true);
  });

  it('clears once the evidence exists', () => {
    const report = evaluateRequirements(
      getValidationRequirements('received', 'staged'),
      evidence({
        kitting: [
          { operation_status: 'completed', quality_status: 'passed', serial_numbers: ['SN-1'] },
        ],
      }),
    );
    expect(report.blocked).toBe(false);
    expect(report.missing).toEqual([]);
  });
});

describe('the requirement vocabulary', () => {
  it('every checkable name is one a transition actually asks for', () => {
    // A mapping for a requirement no transition names is dead code that reads
    // like coverage.
    const named = new Set(
      Object.values(TRANSITION_REQUIREMENTS).flatMap((byStage) => Object.values(byStage).flat()),
    );
    for (const requirement of Object.keys(CHECKABLE_REQUIREMENTS)) {
      expect(named, requirement).toContain(requirement);
    }
  });

  it('classifies every named requirement as one or the other', () => {
    const named = new Set(
      Object.values(TRANSITION_REQUIREMENTS).flatMap((byStage) => Object.values(byStage).flat()),
    );
    for (const requirement of named) {
      const verdict = evaluateRequirement(requirement, EMPTY_EVIDENCE);
      if (isCheckable(requirement)) {
        expect(verdict.satisfied, requirement).toBe(false);
        expect(verdict.blocking, requirement).toBe(!AWAITING_WRITER.has(requirement));
      } else {
        expect(verdict.satisfied, requirement).toBeNull();
        expect(verdict.blocking, requirement).toBe(false);
      }
    }
  });

  it('network_configured is on installed -> active', () => {
    expect(getValidationRequirements('installed', 'active')).toContain('network_configured');
  });
});

describe('the endpoint stopped writing a claim', () => {
  const edge = code('supabase/functions/equipment-lifecycle/index.ts');

  it('no longer marks every requirement passed', () => {
    expect(edge).not.toContain('passed: true,');
    expect(edge).not.toMatch(/message: `\$\{name\} verified`/);
  });

  it('refuses the transition when checkable evidence is absent', () => {
    expect(edge).toContain('if (report.blocked)');
    expect(edge).toContain('422');
  });

  it('stores the three-valued verdict, not a boolean', () => {
    expect(edge).toContain('passed: verdict.satisfied');
  });

  it('loads the evidence once per request, not once per requirement', () => {
    expect(edge).toContain('async function loadEvidence(');
    expect(edge.match(/await loadEvidence\(/g) ?? []).toHaveLength(2);
  });

  it('reports the checklist on both read paths', () => {
    expect(edge.match(/evaluateRequirements\(/g) ?? []).toHaveLength(3);
    expect(edge).toContain('requirementsChecked: true');
    expect(edge).not.toContain('requirementsChecked: false');
  });
});

describe('the dialog shows what the server decided', () => {
  const dialog = code('client/src/components/equipment/EquipmentTransitionDialog.tsx');

  it('renders three states rather than a list of things to confirm', () => {
    expect(dialog).toContain('req.satisfied === true');
    expect(dialog).toContain('req.satisfied === false');
    expect(dialog).toContain('{req.evidence}');
  });

  it('says out loud which ones nothing can answer', () => {
    expect(dialog).toContain('unverifiable');
  });

  it('no longer tells the user nothing is verified automatically', () => {
    expect(dialog).not.toContain('Nothing verifies these automatically');
  });
});

describe('the stage-list decision is written down', () => {
  it('in the module that would have to change', () => {
    // AC2 asks for the qa_passed / accepted decision to be RECORDED, not just
    // made.
    const module = read('supabase/functions/_shared/equipment-lifecycle-transitions.ts');
    expect(module).toContain('THE STAGE-LIST DECISION');
    expect(module).toContain('qa_passed');
    expect(module).toContain('THE ANSWER IS NO');
  });
});
