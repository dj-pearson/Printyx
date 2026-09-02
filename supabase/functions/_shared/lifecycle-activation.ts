/**
 * What acceptance actually does (WF-L-08).
 *
 * `installed -> active` is the moment a machine becomes a serviced, billable
 * asset, and neither host did any of it. The Express state machine's handler
 * opened with:
 *
 *   try { log.info('Equipment monitoring activated'); } catch { ... }
 *
 * a log line inside a try/catch with nothing in it to throw - while the warranty
 * stamp and the welcome email beside it were real, which is what made the whole
 * block read as implemented. The production edge transition handler did none of
 * the three: it set current_stage, inserted a transition row and returned. So no
 * device was ever registered for monitoring, no contract term ever started, and
 * no baseline meter was ever captured. Billing's first cycle therefore counted
 * from zero on a machine that had already printed, and the contract that WF-C-09
 * deliberately leaves un-dated at proposal acceptance stayed un-dated forever.
 *
 * This module is the decision layer both hosts share. It is pure - PostgREST and
 * drizzle disagree about everything except the shape of a row - so each caller
 * does its own reads and writes and this decides WHAT to write.
 *
 * FOUR RULES, each a decision rather than an implementation detail:
 *
 * NO INTEGRATION, NO REGISTRATION. device_registrations.integration_id is NOT
 * NULL with a foreign key to manufacturer_integrations, and that table needs a
 * manufacturer, an auth method and credentials. Manufacturing a placeholder
 * integration to satisfy the constraint would put a fake vendor connection in the
 * integrations list. So a tenant with no integration for that manufacturer gets a
 * named skip, not a fabricated row.
 *
 * A BASELINE METER IS NEVER ZERO BY DEFAULT. A machine arrives having printed its
 * own test pages - tens, sometimes hundreds - and a baseline of 0 bills the
 * customer for every one of them on the first cycle. So the reading comes from
 * the acceptance form or there is no baseline row, and the caller is told which.
 *
 * A CONTRACT IS STARTED ONLY WHEN THERE IS EXACTLY ONE CANDIDATE. WF-C-09 leaves
 * start_date null at proposal acceptance precisely so nobody invents a term; this
 * is the event that sets it, and picking between two un-started contracts for the
 * same customer would set the wrong one. An ambiguous answer is left for a human.
 *
 * NOTHING IS OVERWRITTEN. A contract that already has a start date, a lease that
 * already has a first payment date and a device already registered are left
 * alone: re-accepting a unit must not move a term that is already running.
 */

export const ACTIVATION_STAGE_FROM = 'installed';
export const ACTIVATION_STAGE_TO = 'active';
export const RETIREMENT_STAGE_TO = 'retired';

/** manufacturer_integrations.manufacturer, which is a Postgres enum. */
export const INTEGRATION_MANUFACTURERS = [
  'canon',
  'xerox',
  'hp',
  'konica_minolta',
  'lexmark',
  'fmaudit',
  'printanista',
] as const;
export type IntegrationManufacturer = (typeof INTEGRATION_MANUFACTURERS)[number];

/**
 * `equipment.manufacturer` is free text ("Konica Minolta", "HP Inc.") and the
 * integration column is an enum. Matched on a normalized form rather than
 * exactly, because "Konica Minolta" and "konica_minolta" are the same vendor and
 * failing to see that would skip a registration the tenant can actually make.
 */
export function normalizeManufacturer(value: unknown): IntegrationManufacturer | null {
  if (typeof value !== 'string') return null;
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]+/g, '_')
    .replace(/_+/g, '_');
  const direct = INTEGRATION_MANUFACTURERS.find((m) => key === m || key.startsWith(`${m}_`));
  if (direct) return direct;
  if (key.startsWith('konica') || key.startsWith('minolta')) return 'konica_minolta';
  if (key.startsWith('hewlett')) return 'hp';
  return null;
}

export interface LifecycleUnit {
  equipmentId: string;
  tenantId: string;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  customerId?: string | null;
  currentLocation?: string | null;
  ipAddress?: string | null;
  /** equipment.service_contract_number - free text, the only contract pointer. */
  serviceContractNumber?: string | null;
}

export interface ContractCandidate {
  id: string;
  contract_number?: string | null;
  start_date?: string | null;
  lease_id?: string | null;
}

export interface LeaseCandidate {
  id: string;
  first_payment_date?: string | null;
}

export interface AcceptanceReading {
  bwMeterReading?: number | string | null;
  colorMeterReading?: number | string | null;
  scanMeterReading?: number | string | null;
  faxMeterReading?: number | string | null;
  readingDate?: string | null;
}

export interface ActivationInput {
  unit: LifecycleUnit;
  /** manufacturer_integrations rows the tenant actually has. */
  integrations: Array<{ id: string; manufacturer: string; is_active?: boolean | null }>;
  /** An existing device_registrations row for this serial, if any. */
  existingRegistration?: { id: string; status?: string | null } | null;
  /** The tenant's contracts for this customer that could be the one. */
  contracts: ContractCandidate[];
  lease?: LeaseCandidate | null;
  reading?: AcceptanceReading | null;
  now?: string;
}

export interface ActivationPlan {
  deviceRegistration: Record<string, unknown> | null;
  /** { id, patch } when a contract should start, null otherwise. */
  contractStart: { id: string; patch: Record<string, unknown> } | null;
  leaseStart: { id: string; patch: Record<string, unknown> } | null;
  baselineReading: Record<string, unknown> | null;
  /** Every side effect NOT performed, each with why. Never empty silently. */
  skipped: string[];
}

function meter(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function pickContract(unit: LifecycleUnit, contracts: ContractCandidate[]) {
  const unstarted = contracts.filter((c) => !c.start_date);
  const byNumber = unit.serviceContractNumber
    ? contracts.find((c) => c.contract_number === unit.serviceContractNumber)
    : undefined;

  if (byNumber) {
    if (byNumber.start_date) {
      return { contract: null, reason: `contract ${byNumber.contract_number} already started` };
    }
    return { contract: byNumber, reason: null };
  }
  if (unstarted.length === 1) return { contract: unstarted[0], reason: null };
  if (unstarted.length === 0) {
    return {
      contract: null,
      reason:
        contracts.length === 0
          ? 'no contract for this customer, so no term to start'
          : 'every contract for this customer has already started',
    };
  }
  // Picking between two would start the wrong one.
  return {
    contract: null,
    reason: `${unstarted.length} contracts for this customer have no start date; which one this unit belongs to is ambiguous`,
  };
}

export function planActivation(input: ActivationInput): ActivationPlan {
  const now = input.now ?? new Date().toISOString();
  const { unit } = input;
  const skipped: string[] = [];

  // ── Monitoring registration ──────────────────────────────────────────────
  let deviceRegistration: Record<string, unknown> | null = null;
  const serial = (unit.serialNumber ?? '').trim();
  if (input.existingRegistration) {
    skipped.push('the device is already registered for monitoring');
  } else if (!serial) {
    skipped.push('the unit has no serial number, so it cannot be registered for monitoring');
  } else {
    const manufacturer = normalizeManufacturer(unit.manufacturer);
    const integration =
      input.integrations.find(
        (i) => manufacturer && i.manufacturer === manufacturer && i.is_active !== false,
      ) ?? null;
    if (!integration) {
      // See the header: no placeholder integration is created.
      skipped.push(
        manufacturer
          ? `no active ${manufacturer} integration for this tenant, so the device was not registered for monitoring`
          : `manufacturer ${unit.manufacturer ?? 'unknown'} matches no supported integration, so the device was not registered for monitoring`,
      );
    } else {
      deviceRegistration = {
        tenant_id: unit.tenantId,
        integration_id: integration.id,
        device_id: serial,
        device_name: unit.model ? `${unit.model} ${serial}` : serial,
        model: unit.model ?? null,
        serial_number: serial,
        ip_address: unit.ipAddress ?? null,
        location: unit.currentLocation ?? null,
        // 'unknown' until the integration reports, not 'online' - claiming a
        // machine is online before anything has heard from it is a fabrication.
        status: 'unknown',
        customer_id: unit.customerId ?? null,
        registered_at: now,
        updated_at: now,
      };
    }
  }

  // ── Contract term ────────────────────────────────────────────────────────
  const { contract, reason } = pickContract(unit, input.contracts);
  const contractStart = contract
    ? { id: contract.id, patch: { start_date: now, updated_at: now } }
    : null;
  if (!contractStart && reason) skipped.push(reason);

  // ── Lease first payment ──────────────────────────────────────────────────
  let leaseStart: ActivationPlan['leaseStart'] = null;
  if (input.lease) {
    if (input.lease.first_payment_date) {
      skipped.push('the lease already has a first payment date');
    } else {
      leaseStart = {
        id: input.lease.id,
        patch: { first_payment_date: now, updated_at: now },
      };
    }
  }

  // ── Baseline meter ───────────────────────────────────────────────────────
  let baselineReading: Record<string, unknown> | null = null;
  const r = input.reading ?? {};
  const bw = meter(r.bwMeterReading);
  const color = meter(r.colorMeterReading);
  const scan = meter(r.scanMeterReading);
  const fax = meter(r.faxMeterReading);
  if (bw === null && color === null && scan === null && fax === null) {
    // See the header: a defaulted zero bills the customer for the factory's
    // test pages.
    skipped.push('the acceptance form carried no meter values, so no baseline reading was stored');
  } else {
    baselineReading = {
      tenant_id: unit.tenantId,
      equipment_id: unit.equipmentId,
      contract_id: contract?.id ?? null,
      reading_date: r.readingDate || now,
      bw_meter_reading: bw,
      color_meter_reading: color,
      scan_meter_reading: scan,
      fax_meter_reading: fax,
      reading_method: 'manual',
      collection_method: 'manual',
      // A baseline has nothing before it, so there are no copies to count.
      previous_black_meter: 0,
      previous_color_meter: 0,
      black_copies: 0,
      color_copies: 0,
      notes: 'Baseline reading captured at acceptance',
      created_at: now,
      updated_at: now,
    };
  }

  return { deviceRegistration, contractStart, leaseStart, baselineReading, skipped };
}

export interface RetirementPlan {
  /** { id, patch } for the registration to deactivate, null when there is none. */
  deviceRegistration: { id: string; patch: Record<string, unknown> } | null;
  skipped: string[];
}

/**
 * active -> retired, the symmetric half. The registration is marked offline
 * rather than deleted: device_metrics references it on delete cascade, and the
 * meter history of a retired machine is what the final invoice is built from.
 */
export function planRetirement(
  existingRegistration: { id: string; status?: string | null } | null | undefined,
  now = new Date().toISOString(),
): RetirementPlan {
  if (!existingRegistration) {
    return {
      deviceRegistration: null,
      skipped: ['the unit was not registered for monitoring, so there was nothing to deactivate'],
    };
  }
  if (existingRegistration.status === 'offline') {
    return {
      deviceRegistration: null,
      skipped: ['the device registration is already offline'],
    };
  }
  return {
    deviceRegistration: {
      id: existingRegistration.id,
      patch: { status: 'offline', updated_at: now },
    },
    skipped: [],
  };
}
