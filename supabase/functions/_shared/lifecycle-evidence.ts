// What a lifecycle requirement MEANS, as a query rather than a claim (WF-L-13).
//
// The transition endpoint accepted whatever the caller said. Worse, it wrote
// the claim down: the POST built `validationsPassed` by mapping every
// requirement to `{ passed: true, message: '<name> verified' }` and stored that
// on the transition row. PA-052 had already removed exactly that fabrication
// from the two READ paths - a technician saw "Data Wiped Confirmed - verified"
// and "Certificate Of Destruction - verified" before disposing of a machine -
// and the write path kept doing it.
//
// THREE KINDS OF REQUIREMENT, and the distinction is the whole story.
//
//   CHECKABLE   a table can answer it AND something writes that table. A
//               completed kitting operation, a delivery schedule with a driver,
//               a signature of the right type. Missing evidence BLOCKS.
//   UNBACKED    nothing in this schema can answer it, and no amount of care at
//               the call site changes that. `photo_documentation`,
//               `customer_trained`, `certificate_of_destruction` and thirteen
//               others have no table, no column and no writer. They CANNOT
//               block, because they can never be satisfied - a gate nothing can
//               open is not a gate, it is an outage. They are reported by name
//               as unverifiable and recorded that way on the transition.
//   AWAITING A   the query is right and the table is real, but NOTHING WRITES
//   WRITER       IT YET. `network_configured` is the only one: the column is
//               onboarding_network_config.is_configured, the table is declared,
//               the onboarding function READS it, and no code anywhere inserts
//               a row - that is WF-L-10, which is open. It reports its true
//               verdict (absent) and does NOT block, because blocking on a
//               table nobody can fill would brick installed -> active for every
//               tenant. It flips to blocking the day WF-L-10 ships a writer,
//               which is a one-line change here.
//
// That third kind is worth naming rather than folding into either neighbour. It
// is not unverifiable - the query works and will start returning rows - and it
// is not enforceable yet. The AUDIT-028 shape ("nobody fills this in") applied
// to a gate, and the trap it avoids is one I walked into while writing this
// file: `network_configured` was checkable and blocking for about ten minutes,
// which would have shipped exactly the outage the paragraph above warns about.
//
// Blocking on an unbacked requirement would have bricked the lifecycle: 17 of
// the 25 strings have no possible evidence, so every transition in the product
// would have become impossible. Saying "this one is not checked and here is
// why" is the honest version, and it is what makes the eight that ARE checked
// worth something.

import { satisfiedRequirements as kittingSatisfies } from './kitting-fpy.ts';
import { deliveryRequirements } from './delivery-scheduling.ts';
import { acceptanceRequirements } from './acceptance.ts';

/** Requirements a table can answer, and the story that made each one checkable. */
export const CHECKABLE_REQUIREMENTS = {
  quality_control_passed: 'WF-L-05 warehouse_kitting_operations',
  serial_number_verified: 'WF-L-05 warehouse_kitting_operations',
  delivery_scheduled: 'WF-L-06 delivery_schedules',
  driver_assigned: 'WF-L-06 delivery_schedules',
  delivery_signature_collected: 'WF-L-07 service_signatures',
  // `delivery_signature` is the SAME requirement under a second name - the
  // delivered -> installed list spells it without the suffix. Rather than
  // pretend they are different things, both resolve to the same evidence.
  delivery_signature: 'WF-L-07 service_signatures',
  acceptance_signed: 'WF-L-07 service_signatures',
  installation_completed: 'WF-L-06 installation_schedules',
  network_configured: 'WF-L-10 onboarding_network_config',
} as const;

/**
 * Checkable, but nothing writes the table yet, so it must not block.
 *
 * Remove an entry here the day its writer lands; the query is already correct
 * and the verdict is already right, so that is the only change needed.
 */
export const AWAITING_WRITER = new Set<string>([
  // supabase/functions/onboarding/ reads onboarding_network_config and no code
  // in any tree inserts into it. WF-L-10 owns that.
  'network_configured',
]);

export type CheckableRequirement = keyof typeof CHECKABLE_REQUIREMENTS;

export function isCheckable(requirement: string): requirement is CheckableRequirement {
  return requirement in CHECKABLE_REQUIREMENTS;
}

/** Every row a requirement check might need, loaded once per transition. */
export interface EvidenceBundle {
  kitting: Array<Record<string, unknown>>;
  deliveries: Array<Record<string, unknown>>;
  installations: Array<Record<string, unknown>>;
  signatures: Array<Record<string, unknown>>;
  networkConfigs: Array<Record<string, unknown>>;
}

export const EMPTY_EVIDENCE: EvidenceBundle = {
  kitting: [],
  deliveries: [],
  installations: [],
  signatures: [],
  networkConfigs: [],
};

export interface RequirementVerdict {
  name: string;
  /** true = evidence found, false = checkable and absent, null = unverifiable. */
  satisfied: boolean | null;
  /** Where the answer came from, or why there is none. */
  evidence: string;
  /** Does an absent verdict stop the transition? False while awaiting a writer. */
  blocking: boolean;
}

/**
 * Does the evidence satisfy this requirement?
 *
 * The per-story helpers are reused rather than reimplemented - kitting-fpy,
 * delivery-scheduling and acceptance each already answer "which requirements
 * does this row meet", and they are tested in their own suites. Restating the
 * rule here would be a second definition of the same thing, which is the drift
 * this repository keeps finding.
 */
export function evaluateRequirement(
  requirement: string,
  evidence: EvidenceBundle,
): RequirementVerdict {
  if (!isCheckable(requirement)) {
    return {
      name: requirement,
      satisfied: null,
      evidence: 'No table records this. It is not checked and it does not block.',
      blocking: false,
    };
  }

  const source = CHECKABLE_REQUIREMENTS[requirement];

  const met = (() => {
    switch (requirement) {
      case 'quality_control_passed':
      case 'serial_number_verified':
        return evidence.kitting.some((row) => kittingSatisfies(row).includes(requirement));
      case 'delivery_scheduled':
      case 'driver_assigned':
        return evidence.deliveries.some((row) => deliveryRequirements(row).includes(requirement));
      case 'delivery_signature_collected':
      case 'delivery_signature':
        return evidence.signatures.some((row) =>
          acceptanceRequirements(row).includes('delivery_signature_collected'),
        );
      case 'acceptance_signed':
        return evidence.signatures.some((row) =>
          acceptanceRequirements(row).includes('acceptance_signed'),
        );
      case 'installation_completed':
        return evidence.installations.some((row) => String(row.status) === 'completed');
      case 'network_configured':
        return evidence.networkConfigs.some((row) => row.is_configured === true);
      default:
        return false;
    }
  })();

  const blocking = !AWAITING_WRITER.has(requirement);
  return {
    name: requirement,
    satisfied: met,
    evidence: met
      ? `Found in ${source}.`
      : blocking
        ? `Nothing found in ${source}.`
        : `Nothing found in ${source}, and nothing writes it yet, so this does not block.`,
    blocking,
  };
}

export interface EvidenceReport {
  requirements: RequirementVerdict[];
  satisfied: string[];
  /** Checkable, and the evidence is not there. These BLOCK. */
  missing: string[];
  /** Nothing can answer these. Reported, never blocking. */
  unverifiable: string[];
  /** Checkable and absent, but nothing writes the table yet. Reported, not blocking. */
  awaitingWriter: string[];
  blocked: boolean;
}

export function evaluateRequirements(
  requirements: string[],
  evidence: EvidenceBundle,
): EvidenceReport {
  const verdicts = requirements.map((name) => evaluateRequirement(name, evidence));
  const absent = verdicts.filter((v) => v.satisfied === false);
  const missing = absent.filter((v) => v.blocking).map((v) => v.name);
  return {
    requirements: verdicts,
    satisfied: verdicts.filter((v) => v.satisfied === true).map((v) => v.name),
    missing,
    unverifiable: verdicts.filter((v) => v.satisfied === null).map((v) => v.name),
    awaitingWriter: absent.filter((v) => !v.blocking).map((v) => v.name),
    blocked: missing.length > 0,
  };
}
