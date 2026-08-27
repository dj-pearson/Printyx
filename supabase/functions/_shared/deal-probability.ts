/**
 * Which probability a deal forecasts at (COP-M07 AC3).
 *
 * The canonical stage carries `default_probability`, and the forecast read it —
 * then never used it. The expression was `d.probability ?? stage.prob ?? 50`,
 * and `deals.probability` DEFAULTS TO 0 rather than null, so `??` never fell
 * through. Every deal created through the app forecasts at whatever is in that
 * column, which for the demo tenant is 0 across the board: a $158,000 pipeline
 * weighting to $0.
 *
 * THE UNAVOIDABLE AMBIGUITY, stated rather than hidden: with a default of 0 and
 * no null, "the rep said 0%" and "nobody ever touched this" are the same stored
 * value. Nothing in the schema can tell them apart, and no backfill can recover
 * the intent of existing rows. Treating a positive number as a deliberate
 * override and 0 as unset is the reading that makes stage weighting work at all;
 * the alternative is making the column nullable, which fixes future rows and
 * still cannot interpret the ones already there.
 *
 * A closed stage overrides both. A deal sitting in Closed Won is not 30% likely
 * because a stale field says so.
 */

export const DEAL_FALLBACK_PROBABILITY = 50;

export interface StageWeighting {
  prob?: number | null;
  isClosedWon?: boolean | null;
  isClosedLost?: boolean | null;
}

export function resolveDealProbability(
  dealProbability: number | null | undefined,
  stage: StageWeighting | undefined,
  fallback: number = DEAL_FALLBACK_PROBABILITY,
): number {
  if (stage?.isClosedWon) return 100;
  if (stage?.isClosedLost) return 0;

  if (typeof dealProbability === 'number' && Number.isFinite(dealProbability)) {
    // Clamp before the >0 test, so a nonsense 250 does not forecast at 250%.
    const clamped = Math.min(100, Math.max(0, dealProbability));
    if (clamped > 0) return clamped;
  }

  if (typeof stage?.prob === 'number' && Number.isFinite(stage.prob)) {
    return Math.min(100, Math.max(0, stage.prob));
  }

  return fallback;
}
