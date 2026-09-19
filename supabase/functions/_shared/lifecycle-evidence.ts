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
//   WRITER       IT YET. Empty today - see below.
//
// That third kind is worth keeping even while empty. It is not unverifiable -
// the query works and would start returning rows - and it is not enforceable
// yet, and folding it into either neighbour loses one of those two facts. The
// AUDIT-028 shape ("nobody fills this in") applied to a gate rather than to a
// dashboard.
//
// `network_configured` WAS the only entry. WF-L-13 classified it that way
// because onboarding_network_config had no writer anywhere: the onboarding
// function read it and nothing inserted a row, so blocking on it would have
// bricked installed -> active for every tenant. WF-L-10 SHIPPED THAT WRITER -
// the checklist create writes the form's networkConfig step, and PUT
// /onboarding/:id/network-config covers an installer who configures on site -
// so it is a blocking requirement now, which is what AC4 of both stories asked
// for. The set stays, because the next requirement in this position will want
// it.
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
  // Empty since WF-L-10 gave onboarding_network_config a writer. Add a
  // requirement here when its query is correct but its table has no writer yet,
  // and take it out the day one lands - that is the only change needed, because
  // the verdict is already right either way.
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
