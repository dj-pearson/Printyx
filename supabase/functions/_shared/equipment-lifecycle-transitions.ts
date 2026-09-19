// Equipment lifecycle transition policy, for edge functions.
//
// PA-052: the pure half of server/services/equipment-lifecycle-state-machine.ts
// - which stages may follow which, and what each transition requires - ported so
// supabase/functions/equipment-lifecycle/ can answer /available-transitions and
// /can-transition/:toStage. Both were Express-only, so the transition dialog
// worked in dev and 404'd in production.
//
// KEEP IN SYNC with the Node copy; server/tests/unit/lifecycle-transitions-parity.test.ts
// fails if the graph or the requirement lists drift.
//
// WHAT IS DELIBERATELY NOT HERE: the Node class's validateTransition(). Its
// runValidations() is a stub that says so in its own comment - "Mock: assume all
// pass for now" - and returns `passed: true` with the message
// "<requirement> verified" for every requirement. The dialog rendered that as a
// green tick per row, so a technician saw "Data Wiped Confirmed - verified"
// before disposing of a machine, and "Certificate Of Destruction - verified"
// next to it. Nothing checked either. Requirements were reported here as
// OUTSTANDING, because that was the only thing the data supported.
//
// WF-L-13 CHANGED THAT for eight of them. _shared/lifecycle-evidence.ts maps
// each requirement to a QUERY, and the transition endpoint evaluates them
// server-side and refuses a transition whose checkable evidence is absent. The
// other seventeen have no table, no column and no writer, so they are reported
// as unverifiable and cannot block - a gate nothing can open is not a gate, it
// is an outage. Which is which lives in that module, not here.
//
// THE STAGE-LIST DECISION (WF-L-13, AC2), recorded here because this is the
// file that would have to change.
//
// The question was whether to add explicit `qa_passed` and `accepted` stages
// between received/staged and installed/active. THE ANSWER IS NO, and the
// reason is that they would be states with no independent meaning: a unit has
// passed QA exactly when a completed kitting operation says so, and it is
// accepted exactly when an acceptance signature exists. Both are now queries.
// Adding a stage for each would mean two places that can disagree about the
// same fact - the row and the stage - and the stage would be the one a person
// sets by hand.
//
// What DID change is the requirement list: `network_configured` joins
// installed -> active beside acceptance_signed, because onboarding_network_config
// can answer it (WF-L-10) and a machine that is not on the network is not
// active in any sense a customer would recognise.

export const LIFECYCLE_STAGES = {
  ORDERED: 'ordered',
  RECEIVED: 'received',
  STAGED: 'staged',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  INSTALLED: 'installed',
  ACTIVE: 'active',
  MAINTENANCE: 'maintenance',
  RETIRED: 'retired',
  DISPOSED: 'disposed',
  TRADED_IN: 'traded_in',
} as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[keyof typeof LIFECYCLE_STAGES];

export const VALID_TRANSITIONS: Record<string, string[]> = {
  [LIFECYCLE_STAGES.ORDERED]: [LIFECYCLE_STAGES.RECEIVED, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.RECEIVED]: [LIFECYCLE_STAGES.STAGED, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.STAGED]: [LIFECYCLE_STAGES.IN_TRANSIT, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.IN_TRANSIT]: [LIFECYCLE_STAGES.DELIVERED, LIFECYCLE_STAGES.STAGED],
  [LIFECYCLE_STAGES.DELIVERED]: [LIFECYCLE_STAGES.INSTALLED, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.INSTALLED]: [LIFECYCLE_STAGES.ACTIVE, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.ACTIVE]: [LIFECYCLE_STAGES.MAINTENANCE, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.MAINTENANCE]: [LIFECYCLE_STAGES.ACTIVE, LIFECYCLE_STAGES.RETIRED],
  [LIFECYCLE_STAGES.RETIRED]: [LIFECYCLE_STAGES.DISPOSED, LIFECYCLE_STAGES.TRADED_IN],
  [LIFECYCLE_STAGES.DISPOSED]: [],
  [LIFECYCLE_STAGES.TRADED_IN]: [],
};

export const TRANSITION_REQUIREMENTS: Record<string, Record<string, string[]>> = {
  [LIFECYCLE_STAGES.RECEIVED]: {
    [LIFECYCLE_STAGES.STAGED]: [
      'quality_control_passed',
      'serial_number_verified',
      'photo_documentation',
    ],
  },
  [LIFECYCLE_STAGES.STAGED]: {
    [LIFECYCLE_STAGES.IN_TRANSIT]: ['delivery_scheduled', 'driver_assigned', 'customer_notified'],
  },
  [LIFECYCLE_STAGES.IN_TRANSIT]: {
    [LIFECYCLE_STAGES.DELIVERED]: ['delivery_signature_collected', 'equipment_condition_verified'],
  },
  [LIFECYCLE_STAGES.DELIVERED]: {
    [LIFECYCLE_STAGES.INSTALLED]: [
      'delivery_signature',
      'equipment_unpacked',
      'site_inspection_passed',
    ],
  },
  [LIFECYCLE_STAGES.INSTALLED]: {
    [LIFECYCLE_STAGES.ACTIVE]: [
      'installation_completed',
      'configuration_backed_up',
      'customer_trained',
      'acceptance_signed',
      // WF-L-13: added, and checkable. onboarding_network_config.is_configured
      // answers it, so unlike the two above it can actually block.
      'network_configured',
    ],
  },
  [LIFECYCLE_STAGES.ACTIVE]: {
    [LIFECYCLE_STAGES.RETIRED]: [
      'maintenance_history_reviewed',
      'customer_notification_sent',
      'replacement_planned',
    ],
  },
  [LIFECYCLE_STAGES.RETIRED]: {
    [LIFECYCLE_STAGES.DISPOSED]: [
      'data_wiped_confirmed',
      'disposal_vendor_selected',
      'certificate_of_destruction',
    ],
    [LIFECYCLE_STAGES.TRADED_IN]: [
      'trade_in_evaluation_completed',
      'trade_in_credit_approved',
      'customer_acceptance',
    ],
  },
};

export function canTransition(fromStage: string, toStage: string): boolean {
  return (VALID_TRANSITIONS[fromStage] || []).includes(toStage);
}

export function getAvailableTransitions(currentStage: string): string[] {
  return VALID_TRANSITIONS[currentStage] || [];
}

export function getValidationRequirements(fromStage: string, toStage: string): string[] {
  return TRANSITION_REQUIREMENTS[fromStage]?.[toStage] || [];
}
