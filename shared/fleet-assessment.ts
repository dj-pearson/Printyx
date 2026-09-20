/**
 * Fleet assessment and TCO comparison (COP-B05).
 *
 * Pure. The fleet assessment is the copier sales motion, and it is the one
 * document a rep puts in front of a customer who already knows what their
 * machines cost. So the governing rule here is AC7 rather than completeness:
 *
 *   A MACHINE WITH NO METERS OR NO RATE IS A GAP, NEVER A ZERO AND NEVER A
 *   GUESS. A fabricated line in this document gets corrected out loud, in the
 *   meeting, by the customer holding their own invoice.
 *
 * WHY VOLUME COMES FROM THE CUMULATIVE METERS AND NOT FROM `black_copies`.
 * `meter_readings` carries both: `bw_meter_reading`/`color_meter_reading` are
 * the machine's lifetime counters, and `black_copies`/`color_copies` are the
 * delta somebody computed against `previous_black_meter`. Those delta columns
 * DEFAULT TO 0, so a row nobody finished importing is indistinguishable from a
 * month in which the machine printed nothing. The counters cannot lie that way:
 * two readings and the days between them give a rate per month that is either
 * derivable or absent. The delta columns are used only when no counter is
 * stored at all, and the basis is reported on every line so a rep can say where
 * the number came from.
 *
 * WHAT THIS DELIBERATELY DOES NOT COMPUTE. There is no service-cost column
 * anywhere in this schema (the same finding COP-B04 recorded) and no supplies
 * cost per machine, so current-state spend here is BASE PLUS CLICKS and says
 * so. Those two are named in `unbacked` rather than estimated into the total,
 * because a total that silently includes a guessed service line is the exact
 * thing AC7 forbids. The benchmark estimate from the shared print-cost
 * calculator sits BESIDE this arithmetic, labelled, never inside it.
 */

export type GapCode =
  | 'no_readings'
  | 'single_reading'
  | 'meter_rollback'
  | 'zero_elapsed'
  | 'no_black_rate'
  | 'no_color_rate'
  | 'no_contract';

export interface AssessmentGap {
  equipmentId: string | null;
  code: GapCode;
  /** Plain language, shown to the rep and printable for the customer. */
  message: string;
}

export interface AssessmentEquipment {
  id: string;
  serialNumber?: string | null;
  modelName?: string | null;
  isColorCapable?: boolean | null;
  customerId?: string | null;
}

export interface AssessmentReading {
  equipmentId: string;
  readingDate: string | Date;
  bwMeterReading?: number | string | null;
  colorMeterReading?: number | string | null;
  blackCopies?: number | string | null;
  colorCopies?: number | string | null;
}

export interface AssessmentContract {
  id: string;
  monthlyBase?: number | string | null;
  blackRate?: number | string | null;
  colorRate?: number | string | null;
  status?: string | null;
}

export interface AssessmentTier {
  contractId: string;
  tierName?: string | null;
  colorType: string;
  minimumVolume?: number | string | null;
  maximumVolume?: number | string | null;
  rate: number | string;
  sortOrder?: number | string | null;
}

/** How a machine's monthly volume was arrived at. Shown on every line. */
export type VolumeBasis = 'meter_delta' | 'copy_columns' | 'none';

export interface MachineVolume {
  equipmentId: string;
  monthlyBlack: number | null;
  monthlyColor: number | null;
  basis: VolumeBasis;
  /** Days the derivation spans. Null when there is nothing to span. */
  observedDays: number | null;
  gaps: AssessmentGap[];
}

const DAYS_PER_MONTH = 30.4375;

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toTime(value: string | Date): number {
  const d = value instanceof Date ? value : new Date(value);
  return d.getTime();
}

/**
 * A machine's monthly volume, or an honest absence.
 *
 * Two readings and the days between them, from the lifetime counters. A
 * counter that went DOWN means the meter was reset or the machine was swapped,
 * and no arithmetic over it is meaningful - that is a gap, not a negative.
 */
export function monthlyVolumeFor(
  equipmentId: string,
  readings: AssessmentReading[],
): MachineVolume {
  const rows = (readings ?? [])
    .filter((r) => r.equipmentId === equipmentId && Number.isFinite(toTime(r.readingDate)))
    .sort((a, b) => toTime(a.readingDate) - toTime(b.readingDate));

  const none = (code: GapCode, message: string): MachineVolume => ({
    equipmentId,
    monthlyBlack: null,
    monthlyColor: null,
    basis: 'none',
    observedDays: null,
    gaps: [{ equipmentId, code, message }],
  });

  if (rows.length === 0) {
    return none(
      'no_readings',
      'No meter readings on file, so this machine has no measured volume.',
    );
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const days = (toTime(last.readingDate) - toTime(first.readingDate)) / 86_400_000;

  const firstBw = num(first.bwMeterReading);
  const lastBw = num(last.bwMeterReading);
  const firstColor = num(first.colorMeterReading);
  const lastColor = num(last.colorMeterReading);
  const hasCounters = firstBw != null && lastBw != null;

  if (hasCounters) {
    if (rows.length < 2) {
      return none(
        'single_reading',
        'Only one meter reading on file. A volume needs two readings and the time between them.',
      );
    }
    if (days <= 0) {
      return none(
        'zero_elapsed',
        'All meter readings carry the same date, so no period can be measured.',
      );
    }
    if (lastBw < firstBw || (firstColor != null && lastColor != null && lastColor < firstColor)) {
      return none(
        'meter_rollback',
        'The meter reads lower than it did earlier - it was reset or the machine was swapped, so the period cannot be measured.',
      );
    }
    const months = days / DAYS_PER_MONTH;
    return {
      equipmentId,
      monthlyBlack: (lastBw - firstBw) / months,
      monthlyColor:
        firstColor != null && lastColor != null ? (lastColor - firstColor) / months : null,
      basis: 'meter_delta',
      observedDays: days,
      gaps: [],
    };
  }

  // Fallback: the computed delta columns. Only when no counter is stored at
  // all, because these default to 0 and an unfinished import then looks like a
  // month of no printing.
  const blackSum = rows.reduce((n, r) => n + (num(r.blackCopies) ?? 0), 0);
  const colorSum = rows.reduce((n, r) => n + (num(r.colorCopies) ?? 0), 0);
  const months = Math.max(1, days / DAYS_PER_MONTH);
  if (blackSum === 0 && colorSum === 0) {
    return none(
      'no_readings',
      'Readings exist but carry no meter counters and no copy counts, so no volume can be derived.',
    );
  }
  return {
    equipmentId,
    monthlyBlack: blackSum / months,
    monthlyColor: colorSum / months,
    basis: 'copy_columns',
    observedDays: days > 0 ? days : null,
    gaps: [],
  };
}

export interface ResolvedRate {
  rate: number | null;
  source: 'tier' | 'contract' | null;
  /** Which tier matched, for the printable summary. */
  tierName?: string | null;
}

/**
 * The rate a volume actually bills at.
 *
 * A tiered contract wins, because that is the commercial term the customer
 * signed. The contract's flat rate is the fallback and SAYS it is the
 * fallback. Neither present is null, never zero: a zero rate asserts the
 * clicks are free.
 */
export function resolveRate(
  monthlyVolume: number | null,
  colorType: 'black' | 'color',
  contract: AssessmentContract | null,
  tiers: AssessmentTier[],
): ResolvedRate {
  if (!contract) return { rate: null, source: null };

  if (monthlyVolume != null) {
    const applicable = (tiers ?? [])
      .filter((t) => t.contractId === contract.id && String(t.colorType) === colorType)
      .sort((a, b) => (num(a.sortOrder) ?? 0) - (num(b.sortOrder) ?? 0));
    for (const tier of applicable) {
      const min = num(tier.minimumVolume) ?? 0;
      const max = num(tier.maximumVolume);
      // A null maximum is the top tier and is unbounded, which is how these
      // are written ("5000+").
      if (monthlyVolume >= min && (max == null || monthlyVolume <= max)) {
        const rate = num(tier.rate);
        if (rate != null) return { rate, source: 'tier', tierName: tier.tierName ?? null };
      }
    }
  }

  const flat = num(colorType === 'black' ? contract.blackRate : contract.colorRate);
  return flat != null ? { rate: flat, source: 'contract' } : { rate: null, source: null };
}

export interface MachineLine {
  equipmentId: string;
  serialNumber: string | null;
  modelName: string | null;
  monthlyBlack: number | null;
  monthlyColor: number | null;
  basis: VolumeBasis;
  blackRate: number | null;
  colorRate: number | null;
  rateSource: 'tier' | 'contract' | 'mixed' | null;
  /** Clicks only. The base charge is account-level and is not divided here. */
  monthlyClickCost: number | null;
  costPerPage: number | null;
}

export interface FleetAssessmentResult {
  machines: MachineLine[];
  /** Machines that produced a number. The rest are in `gaps`. */
  measuredMachines: number;
  totalMachines: number;
  monthlyBlackVolume: number;
  monthlyColorVolume: number;
  monthlyClickCost: number;
  monthlyBaseCost: number;
  monthlyTotal: number;
  annualTotal: number;
  /** Blended cost per page across what could be measured. Null with no volume. */
  blendedCostPerPage: number | null;
  gaps: AssessmentGap[];
  /** True when any machine could not be costed, so the total is a FLOOR. */
  partial: boolean;
  unbacked: string[];
}

/**
 * Current-state cost of a fleet, from what the system actually holds.
 *
 * `monthlyTotal` is a FLOOR whenever `partial` is true: a machine that could
 * not be costed contributes nothing, so the real spend is higher. The word
 * matters, because a number presented as a total and used as a baseline for
 * savings would understate the savings and overstate our credibility.
 */
export function assessCurrentFleet(input: {
  equipment: AssessmentEquipment[];
  readings: AssessmentReading[];
  contract: AssessmentContract | null;
  tiers: AssessmentTier[];
}): FleetAssessmentResult {
  const { equipment, readings, contract, tiers } = input;
  const machines: MachineLine[] = [];
  const gaps: AssessmentGap[] = [];

  if (!contract) {
    gaps.push({
      equipmentId: null,
      code: 'no_contract',
      message:
        'No active contract on this account, so no contracted rate exists. Click cost cannot be stated.',
    });
  }

  let monthlyBlackVolume = 0;
  let monthlyColorVolume = 0;
  let monthlyClickCost = 0;
  let measured = 0;

  for (const machine of equipment ?? []) {
    const volume = monthlyVolumeFor(machine.id, readings);
    gaps.push(...volume.gaps);

    const black = resolveRate(volume.monthlyBlack, 'black', contract, tiers);
    const color = resolveRate(volume.monthlyColor, 'color', contract, tiers);

    if (contract && volume.monthlyBlack != null && black.rate == null) {
      gaps.push({
        equipmentId: machine.id,
        code: 'no_black_rate',
        message:
          'The contract states no black rate and no matching tier, so clicks are not costed.',
      });
    }
    if (contract && volume.monthlyColor != null && volume.monthlyColor > 0 && color.rate == null) {
      gaps.push({
        equipmentId: machine.id,
        code: 'no_color_rate',
        message:
          'The contract states no color rate and no matching tier, so clicks are not costed.',
      });
    }

    const blackCost =
      volume.monthlyBlack != null && black.rate != null ? volume.monthlyBlack * black.rate : null;
    const colorCost =
      volume.monthlyColor != null && color.rate != null ? volume.monthlyColor * color.rate : null;
    const clickCost =
      blackCost == null && colorCost == null ? null : (blackCost ?? 0) + (colorCost ?? 0);

    const pages = (volume.monthlyBlack ?? 0) + (volume.monthlyColor ?? 0);
    // Only rates that actually multiplied a volume. A colour rate applied to
    // zero colour pages contributed nothing, and calling the line "mixed"
    // because of it tells the rep to go looking for a tier that did not matter.
    const sources = [
      (volume.monthlyBlack ?? 0) > 0 ? black.source : null,
      (volume.monthlyColor ?? 0) > 0 ? color.source : null,
    ].filter(Boolean) as Array<'tier' | 'contract'>;
    const rateSource =
      sources.length === 0 ? null : sources.every((s) => s === sources[0]) ? sources[0] : 'mixed';

    machines.push({
      equipmentId: machine.id,
      serialNumber: machine.serialNumber ?? null,
      modelName: machine.modelName ?? null,
      monthlyBlack: volume.monthlyBlack,
      monthlyColor: volume.monthlyColor,
      basis: volume.basis,
      blackRate: black.rate,
      colorRate: color.rate,
      rateSource,
      monthlyClickCost: clickCost,
      costPerPage: clickCost != null && pages > 0 ? clickCost / pages : null,
    });

    if (clickCost != null) {
      measured += 1;
      monthlyClickCost += clickCost;
      monthlyBlackVolume += volume.monthlyBlack ?? 0;
      monthlyColorVolume += volume.monthlyColor ?? 0;
    }
  }

  const monthlyBaseCost = num(contract?.monthlyBase) ?? 0;
  const monthlyTotal = monthlyClickCost + monthlyBaseCost;
  const totalPages = monthlyBlackVolume + monthlyColorVolume;

  return {
    machines,
    measuredMachines: measured,
    totalMachines: (equipment ?? []).length,
    monthlyBlackVolume,
    monthlyColorVolume,
    monthlyClickCost,
    monthlyBaseCost,
    monthlyTotal,
    annualTotal: monthlyTotal * 12,
    blendedCostPerPage: totalPages > 0 ? monthlyTotal / totalPages : null,
    gaps,
    partial: measured < (equipment ?? []).length,
    unbacked: [
      'Service cost is not included: no service-cost column exists anywhere in this schema, so it cannot be read.',
      'Supplies are not included: no per-machine supply cost is recorded.',
      'The figures above are base charges plus contracted clicks only.',
    ],
  };
}

export interface ProposedMachine {
  modelName: string;
  quantity: number;
  monthlyBase?: number | string | null;
  blackRate?: number | string | null;
  colorRate?: number | string | null;
}

export interface ProposedFleetResult {
  monthlyBase: number;
  monthlyClickCost: number | null;
  monthlyTotal: number | null;
  annualTotal: number | null;
  costPerPage: number | null;
  gaps: AssessmentGap[];
}

/**
 * The proposed fleet, priced against the SAME volumes.
 *
 * Holding volume constant is what makes the comparison a comparison. A
 * proposed line with no rate does not cost zero - the whole proposal reports a
 * null total, because half a price is not a price.
 */
export function modelProposedFleet(
  proposed: ProposedMachine[],
  monthlyBlack: number,
  monthlyColor: number,
): ProposedFleetResult {
  const rows = proposed ?? [];
  const gaps: AssessmentGap[] = [];
  let monthlyBase = 0;
  let blackRateWeighted: number | null = null;
  let colorRateWeighted: number | null = null;
  let units = 0;

  for (const row of rows) {
    const qty = Math.max(0, num(row.quantity) ?? 0);
    units += qty;
    monthlyBase += (num(row.monthlyBase) ?? 0) * qty;
    const black = num(row.blackRate);
    const color = num(row.colorRate);
    if (black == null) {
      gaps.push({
        equipmentId: null,
        code: 'no_black_rate',
        message: `${row.modelName || 'A proposed machine'} carries no black rate, so the proposal cannot be priced.`,
      });
    } else {
      blackRateWeighted = (blackRateWeighted ?? 0) + black * qty;
    }
    if (monthlyColor > 0) {
      if (color == null) {
        gaps.push({
          equipmentId: null,
          code: 'no_color_rate',
          message: `${row.modelName || 'A proposed machine'} carries no color rate and this fleet prints color.`,
        });
      } else {
        colorRateWeighted = (colorRateWeighted ?? 0) + color * qty;
      }
    }
  }

  const priced = gaps.length === 0 && units > 0;
  if (!priced) {
    return {
      monthlyBase,
      monthlyClickCost: null,
      monthlyTotal: null,
      annualTotal: null,
      costPerPage: null,
      gaps:
        units === 0
          ? [
              {
                equipmentId: null,
                code: 'no_black_rate',
                message: 'No proposed machines, so there is nothing to price.',
              },
            ]
          : gaps,
    };
  }

  // Rates are averaged across the proposed units, because the volume is a
  // fleet total and is not attributed to a specific proposed machine.
  const blackRate = (blackRateWeighted ?? 0) / units;
  const colorRate = colorRateWeighted != null ? colorRateWeighted / units : 0;
  const clickCost = monthlyBlack * blackRate + monthlyColor * colorRate;
  const total = monthlyBase + clickCost;
  const pages = monthlyBlack + monthlyColor;

  return {
    monthlyBase,
    monthlyClickCost: clickCost,
    monthlyTotal: total,
    annualTotal: total * 12,
    costPerPage: pages > 0 ? total / pages : null,
    gaps: [],
  };
}

export interface FleetComparison {
  monthlyDelta: number | null;
  annualDelta: number | null;
  termDelta: number | null;
  termMonths: number;
  percentChange: number | null;
  /** True when the current-state figure is a floor, so the saving is a ceiling. */
  currentIsFloor: boolean;
}

/**
 * Current versus proposed.
 *
 * A positive delta is a SAVING. When the current state is partial the saving
 * is stated as a ceiling rather than a figure, because the baseline it is
 * measured from is known to be too low.
 */
export function compareFleets(
  current: FleetAssessmentResult,
  proposed: ProposedFleetResult,
  termMonths: number,
): FleetComparison {
  const months = Math.max(1, Math.round(termMonths || 36));
  if (proposed.monthlyTotal == null) {
    return {
      monthlyDelta: null,
      annualDelta: null,
      termDelta: null,
      termMonths: months,
      percentChange: null,
      currentIsFloor: current.partial,
    };
  }
  const monthlyDelta = current.monthlyTotal - proposed.monthlyTotal;
  return {
    monthlyDelta,
    annualDelta: monthlyDelta * 12,
    termDelta: monthlyDelta * months,
    termMonths: months,
    // Percent of a zero baseline is not 100%, it is undefined.
    percentChange: current.monthlyTotal > 0 ? (monthlyDelta / current.monthlyTotal) * 100 : null,
    currentIsFloor: current.partial,
  };
}
