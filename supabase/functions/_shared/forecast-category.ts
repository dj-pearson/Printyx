/**
 * Forecast categories, the copier revenue split, and commit-vs-actual (COP-I06).
 *
 * Pure. Four rules it exists to hold, each of which is a way a forecast lies:
 *
 *  1. AN UNCATEGORIZED DEAL IS NOT A PIPELINE DEAL. `forecast_category` is
 *     nullable and nothing back-fills it (COP-M04 was explicit: a guessed
 *     category on a historical deal poisons the very history this story
 *     measures). So an uncategorized deal goes in its own bucket and is
 *     reported by name. Folding it into `pipeline` would make a forecast that
 *     nobody has touched look like a forecast somebody has judged.
 *
 *  2. COMMIT IS NOT WEIGHTED. A category is a person saying what they will
 *     close; multiplying it by a stage probability applies a second discount to
 *     a judgement that already includes one. Weighted values are reported
 *     ALONGSIDE category totals, never instead of them, so a manager can see
 *     both and say which they are using.
 *
 *  3. ONE-TIME AND RECURRING ARE DIFFERENT MONEY (AC5). `deals.amount` is the
 *     box: it lands once. `deals.estimated_monthly_value` is CPC and service:
 *     it lands every month for the life of the contract. Adding them produces a
 *     number that is neither, which is why quote-math keeps the same two
 *     buckets apart. Annualized recurring is reported separately again, because
 *     a monthly figure and a one-time figure cannot be summed either.
 *
 *  4. ACCURACY IS MEASURED, NOT ASSERTED (AC4). A snapshot records what was
 *     committed at a point in time; accuracy compares it to what actually
 *     closed won in that period. With no snapshot there is no accuracy, and the
 *     answer is null rather than 100%.
 */

export const FORECAST_CATEGORIES = ['commit', 'best_case', 'pipeline', 'closed'] as const;
export type ForecastCategory = (typeof FORECAST_CATEGORIES)[number];

/** The bucket a deal lands in when nobody has categorized it. */
export const UNCATEGORIZED = 'uncategorized' as const;

export function isForecastCategory(value: unknown): value is ForecastCategory {
  return (
    typeof value === 'string' &&
    (FORECAST_CATEGORIES as readonly string[]).includes(value.toLowerCase())
  );
}

/** Normalizes case and stray whitespace; returns null for anything unknown. */
export function parseForecastCategory(value: unknown): ForecastCategory | null {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  return isForecastCategory(key) ? (key as ForecastCategory) : null;
}

export interface ForecastDealRow {
  id?: string | null;
  owner_id?: string | null;
  status?: string | null;
  amount?: string | number | null;
  estimated_monthly_value?: string | number | null;
  forecast_category?: string | null;
  probability?: number | null;
  stage_id?: string | null;
  expected_close_date?: string | null;
}

export interface ForecastBucket {
  /** A ForecastCategory, or UNCATEGORIZED. */
  category: string;
  count: number;
  /** deals.amount — equipment and other one-time revenue. */
  oneTimeValue: number;
  /** deals.estimated_monthly_value — CPC and service, PER MONTH. */
  recurringMonthlyValue: number;
  /** recurringMonthlyValue * 12. Reported separately; never added to one-time. */
  recurringAnnualValue: number;
  /** One-time revenue after stage probability. Alongside, never instead. */
  weightedOneTimeValue: number;
  /** How many deals in this bucket carry no amount at all. */
  dealsWithoutAmount: number;
}

export interface ForecastRollupRow {
  ownerId: string | null;
  count: number;
  oneTimeValue: number;
  recurringMonthlyValue: number;
  commitOneTimeValue: number;
  bestCaseOneTimeValue: number;
  uncategorizedCount: number;
}

export interface ForecastSummary {
  buckets: ForecastBucket[];
  byOwner: ForecastRollupRow[];
  totals: {
    count: number;
    oneTimeValue: number;
    recurringMonthlyValue: number;
    recurringAnnualValue: number;
    weightedOneTimeValue: number;
    uncategorizedCount: number;
    dealsWithoutAmount: number;
  };
  /** Named gaps, rendered by the page rather than silently zeroed. */
  unbacked: string[];
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptyBucket(category: string): ForecastBucket {
  return {
    category,
    count: 0,
    oneTimeValue: 0,
    recurringMonthlyValue: 0,
    recurringAnnualValue: 0,
    weightedOneTimeValue: 0,
    dealsWithoutAmount: 0,
  };
}

/**
 * Roll a deal set up by forecast category, with the copier revenue split and a
 * per-owner roll-up (AC3's rep level; team and territory are the caller's job,
 * because who reports to whom is an RBAC-scope question and not arithmetic).
 *
 * `probabilityFor` is injected rather than imported so this file stays free of
 * the stage lookup: the caller already has the stage map and the COP-M07
 * resolution rule lives in _shared/deal-probability.ts.
 */
export function summarizeForecast(
  deals: ForecastDealRow[],
  probabilityFor: (deal: ForecastDealRow) => number,
): ForecastSummary {
  const buckets = new Map<string, ForecastBucket>();
  const owners = new Map<string, ForecastRollupRow>();

  const bucketFor = (category: string) => {
    let bucket = buckets.get(category);
    if (!bucket) {
      bucket = emptyBucket(category);
      buckets.set(category, bucket);
    }
    return bucket;
  };

  let anyRecurring = false;
  let anyCategorized = false;

  for (const deal of deals ?? []) {
    const category = parseForecastCategory(deal.forecast_category) ?? UNCATEGORIZED;
    if (category !== UNCATEGORIZED) anyCategorized = true;

    const oneTime = toNumber(deal.amount);
    const recurring = toNumber(deal.estimated_monthly_value);
    if (recurring != null && recurring > 0) anyRecurring = true;

    const bucket = bucketFor(category);
    bucket.count += 1;
    if (oneTime == null) bucket.dealsWithoutAmount += 1;
    bucket.oneTimeValue += oneTime ?? 0;
    bucket.recurringMonthlyValue += recurring ?? 0;
    bucket.weightedOneTimeValue += ((oneTime ?? 0) * probabilityFor(deal)) / 100;

    const ownerId = deal.owner_id ?? null;
    const ownerKey = ownerId ?? '__unassigned__';
    let owner = owners.get(ownerKey);
    if (!owner) {
      owner = {
        ownerId,
        count: 0,
        oneTimeValue: 0,
        recurringMonthlyValue: 0,
        commitOneTimeValue: 0,
        bestCaseOneTimeValue: 0,
        uncategorizedCount: 0,
      };
      owners.set(ownerKey, owner);
    }
    owner.count += 1;
    owner.oneTimeValue += oneTime ?? 0;
    owner.recurringMonthlyValue += recurring ?? 0;
    if (category === 'commit') owner.commitOneTimeValue += oneTime ?? 0;
    if (category === 'best_case') owner.bestCaseOneTimeValue += oneTime ?? 0;
    if (category === UNCATEGORIZED) owner.uncategorizedCount += 1;
  }

  for (const bucket of buckets.values()) {
    bucket.recurringAnnualValue = bucket.recurringMonthlyValue * 12;
  }

  // Stable, meaningful order: commit first because it is what gets quoted.
  const order = [...FORECAST_CATEGORIES, UNCATEGORIZED] as string[];
  const ordered = [...buckets.values()].sort(
    (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
  );

  const totals = ordered.reduce(
    (acc, b) => ({
      count: acc.count + b.count,
      oneTimeValue: acc.oneTimeValue + b.oneTimeValue,
      recurringMonthlyValue: acc.recurringMonthlyValue + b.recurringMonthlyValue,
      recurringAnnualValue: acc.recurringAnnualValue + b.recurringAnnualValue,
      weightedOneTimeValue: acc.weightedOneTimeValue + b.weightedOneTimeValue,
      uncategorizedCount: acc.uncategorizedCount + (b.category === UNCATEGORIZED ? b.count : 0),
      dealsWithoutAmount: acc.dealsWithoutAmount + b.dealsWithoutAmount,
    }),
    {
      count: 0,
      oneTimeValue: 0,
      recurringMonthlyValue: 0,
      recurringAnnualValue: 0,
      weightedOneTimeValue: 0,
      uncategorizedCount: 0,
      dealsWithoutAmount: 0,
    },
  );

  const unbacked: string[] = [];
  if (totals.count > 0 && !anyCategorized) {
    unbacked.push(
      'No deal carries a forecast category yet, so every open deal is reported as uncategorized rather than guessed at.',
    );
  }
  if (totals.count > 0 && !anyRecurring) {
    unbacked.push(
      'No deal carries an estimated monthly value, so the recurring half of the forecast is empty rather than estimated.',
    );
  }
  if (totals.dealsWithoutAmount > 0) {
    unbacked.push(
      `${totals.dealsWithoutAmount} deal(s) carry no amount and contribute nothing to the value totals.`,
    );
  }

  return {
    buckets: ordered,
    byOwner: [...owners.values()].sort(
      (a, b) => b.commitOneTimeValue - a.commitOneTimeValue || b.oneTimeValue - a.oneTimeValue,
    ),
    totals,
    unbacked,
  };
}

// ── Commit vs actual (AC4) ────────────────────────────────────────────

export interface ForecastSnapshotRow {
  period_start?: string | null;
  period_end?: string | null;
  owner_id?: string | null;
  commit_one_time_value?: string | number | null;
  best_case_one_time_value?: string | number | null;
  pipeline_one_time_value?: string | number | null;
  commit_recurring_monthly_value?: string | number | null;
  captured_at?: string | null;
}

export interface AccuracyRow {
  periodStart: string;
  periodEnd: string;
  ownerId: string | null;
  committed: number;
  bestCase: number;
  actual: number;
  /** actual - committed. Positive means the period beat its commit. */
  variance: number;
  /** actual / committed. NULL when nothing was committed - not 0%, not 100%. */
  attainment: number | null;
  capturedAt: string | null;
}

/**
 * Compare each snapshot against what actually closed won in its period.
 *
 * `actualByPeriod` is keyed `${periodStart}|${ownerId ?? ''}` so a tenant-wide
 * snapshot and a per-rep snapshot never read each other's actuals.
 *
 * Attainment against a zero commit is NULL, not zero and not infinity: a period
 * nobody committed anything for has no attainment, and printing 0% would read
 * as a total miss by a rep who was never asked for a number.
 */
export function summarizeAccuracy(
  snapshots: ForecastSnapshotRow[],
  actualByPeriod: Map<string, number>,
): AccuracyRow[] {
  return (snapshots ?? [])
    .filter((s) => s.period_start && s.period_end)
    .map((s) => {
      const ownerId = s.owner_id ?? null;
      const committed = toNumber(s.commit_one_time_value) ?? 0;
      const actual = actualByPeriod.get(`${s.period_start}|${ownerId ?? ''}`) ?? 0;
      return {
        periodStart: String(s.period_start),
        periodEnd: String(s.period_end),
        ownerId,
        committed,
        bestCase: toNumber(s.best_case_one_time_value) ?? 0,
        actual,
        variance: actual - committed,
        attainment: committed > 0 ? actual / committed : null,
        capturedAt: s.captured_at ?? null,
      };
    })
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}
