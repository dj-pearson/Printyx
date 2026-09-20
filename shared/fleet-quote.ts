/**
 * Fleet context for the quote builder (COP-B06).
 *
 * Pure. Quote Builder is catalog-only: its "equipment" means `product_models`,
 * what we sell, and nothing in the quote tree has ever read `equipment`, what
 * the customer runs. This module is the bridge, and it exists mostly to keep
 * one claim honest.
 *
 * REMAINING PAYMENTS IS NOT A BUYOUT, AND THIS FILE WILL NOT CALL IT ONE.
 * `equipment` carries `monthly_payment` and `lease_expires_date` and no buyout
 * column anywhere. Remaining term times monthly payment is the remaining
 * PAYMENT STREAM. A real buyout is quoted by the lessor and is usually that
 * stream plus a residual, sometimes discounted to present value - so the two
 * numbers differ, by thousands, on the one figure a copier deal is routinely
 * won or lost on (AC3). Presenting a derived stream as a buyout would be
 * inventing a commercial term the dealer then has to honour.
 *
 * So: the derived figure is named `remainingPayments` everywhere and reported
 * as a FLOOR. The deal's `lease_buyout_exposure` (COP-M04) is where a rep
 * records the buyout the lessor actually quoted, and when it is present it is
 * the authoritative number and the roll-up says which one it used.
 */

export interface FleetMachine {
  equipmentId: string;
  serialNumber: string | null;
  modelName: string | null;
  monthlyBlack: number | null;
  monthlyColor: number | null;
  /** Blended cost per page today, from the COP-B05 assessment. Null when uncosted. */
  currentCostPerPage: number | null;
  monthlyPayment: number | null;
  leaseExpiresDate: string | null;
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Whole months left on a lease.
 *
 * ZERO IS A FACT AND NULL IS AN ABSENCE. A lease that has already run out is
 * 0 - the rep can replace that machine today and owes nothing more - while a
 * machine with no lease date recorded is null, and a null must never be summed
 * as if it were zero.
 */
export function remainingLeaseMonths(
  leaseExpiresDate: string | Date | null | undefined,
  now: Date,
): number | null {
  if (!leaseExpiresDate) return null;
  const end = leaseExpiresDate instanceof Date ? leaseExpiresDate : new Date(leaseExpiresDate);
  if (Number.isNaN(end.getTime())) return null;
  const months = (end.getTime() - now.getTime()) / (86_400_000 * 30.4375);
  return months <= 0 ? 0 : Math.ceil(months);
}

/** Months left times the monthly payment. Null when either is unknown. */
export function remainingPayments(
  monthlyPayment: number | string | null | undefined,
  months: number | null,
): number | null {
  const payment = num(monthlyPayment);
  if (payment == null || months == null) return null;
  return payment * months;
}

export interface LineExposure {
  equipmentId: string;
  serialNumber: string | null;
  remainingMonths: number | null;
  monthlyPayment: number | null;
  remainingPayments: number | null;
}

/** What a replacement line should show about the machine it displaces (AC2). */
export function exposureForMachine(machine: FleetMachine, now: Date): LineExposure {
  const months = remainingLeaseMonths(machine.leaseExpiresDate, now);
  return {
    equipmentId: machine.equipmentId,
    serialNumber: machine.serialNumber,
    remainingMonths: months,
    monthlyPayment: num(machine.monthlyPayment),
    remainingPayments: remainingPayments(machine.monthlyPayment, months),
  };
}

export interface ExposureRollup {
  /** Sum of what could be derived. A FLOOR - see `unknown`. */
  derivedRemainingPayments: number;
  /** Machines displaced whose remaining payments could not be derived. */
  unknown: Array<{ equipmentId: string; serialNumber: string | null; reason: string }>;
  /** What the rep recorded from the lessor, when they did. */
  recordedBuyout: number | null;
  /** Which figure a rep should quote. Null when neither exists. */
  authoritative: 'recorded' | 'derived' | null;
  machinesDisplaced: number;
}

/**
 * AC3. Total exposure across the quote, before send.
 *
 * The recorded buyout wins when present, because it is the number the lessor
 * actually quoted. Otherwise the derived stream is offered AS a floor, with
 * every machine it could not account for named - a roll-up that silently omits
 * two machines is how a rep walks into a meeting with a number that is wrong
 * in the customer's favour and cannot be defended.
 */
export function rollupExposure(
  displaced: FleetMachine[],
  recordedBuyout: number | string | null | undefined,
  now: Date,
): ExposureRollup {
  let derived = 0;
  const unknown: ExposureRollup['unknown'] = [];

  for (const machine of displaced ?? []) {
    const exposure = exposureForMachine(machine, now);
    if (exposure.remainingPayments == null) {
      unknown.push({
        equipmentId: machine.equipmentId,
        serialNumber: machine.serialNumber,
        reason:
          exposure.remainingMonths == null
            ? 'No lease end date on this machine, so nothing can be derived.'
            : 'No monthly payment recorded on this machine.',
      });
      continue;
    }
    derived += exposure.remainingPayments;
  }

  const recorded = num(recordedBuyout);
  return {
    derivedRemainingPayments: derived,
    unknown,
    recordedBuyout: recorded,
    authoritative: recorded != null ? 'recorded' : (displaced ?? []).length > 0 ? 'derived' : null,
    machinesDisplaced: (displaced ?? []).length,
  };
}

/** A machine line out of a COP-B05 assessment snapshot. */
interface AssessmentMachineLine {
  equipmentId: string;
  serialNumber?: string | null;
  modelName?: string | null;
  monthlyBlack?: number | null;
  monthlyColor?: number | null;
  costPerPage?: number | null;
}

/**
 * AC1 and AC4: the account's fleet as quote context, from the assessment that
 * already costed it.
 *
 * Taking the volumes and cost per page from the SNAPSHOT rather than
 * recomputing them is what makes AC4 true - the savings story and the quote
 * cite the same numbers, because they are literally the same numbers. A
 * machine the assessment could not cost carries a null cost per page here
 * rather than a zero, so a quote cannot claim a saving against a rate nobody
 * measured.
 */
export function fleetContextFromAssessment(
  machines: AssessmentMachineLine[],
  equipmentById: Map<string, { monthlyPayment?: unknown; leaseExpiresDate?: string | null }>,
): FleetMachine[] {
  return (machines ?? []).map((m) => {
    const extra = equipmentById.get(m.equipmentId);
    return {
      equipmentId: m.equipmentId,
      serialNumber: m.serialNumber ?? null,
      modelName: m.modelName ?? null,
      monthlyBlack: m.monthlyBlack ?? null,
      monthlyColor: m.monthlyColor ?? null,
      currentCostPerPage: m.costPerPage ?? null,
      monthlyPayment: num(extra?.monthlyPayment),
      leaseExpiresDate: extra?.leaseExpiresDate ?? null,
    };
  });
}
