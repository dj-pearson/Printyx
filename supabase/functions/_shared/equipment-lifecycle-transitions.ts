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
// next to it. Nothing checked either. Requirements are reported here as
// OUTSTANDING, because that is the only thing this data supports.

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
