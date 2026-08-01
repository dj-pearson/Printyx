/**
 * Predictive equipment-failure scoring (PROD-010) — port of the model in
 * server/routes-predictive-failure-dispatch.ts.
 *
 * Split from index.ts so it can run in CI: index.ts imports _shared/supabase.ts,
 * which pulls @supabase/supabase-js from esm.sh at RUNTIME and cannot be loaded
 * by Node. Everything here is pure.
 *
 * A prediction above the confidence threshold DISPATCHES A TECHNICIAN, so the
 * arithmetic has real cost attached in both directions: too high and a tech
 * drives out for nothing, too low and a machine fails at a customer site.
 */

/** Signal weights — sum to 1.0 so the blended score is a clean 0..1 confidence. */
export const SIGNAL_WEIGHTS = {
  meter_accel: 0.25,
  error_freq: 0.25,
  days_since_service: 0.2,
  model_age: 0.15,
  toner_anomaly: 0.15,
} as const;

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
export const PREDICTION_WINDOW_DAYS = 14;

/** Risk assumed when a machine has no recorded service date at all. */
const UNKNOWN_SERVICE_RISK = 0.6;

export function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export interface SignalContribution {
  value: number; // normalized 0..1 risk contribution
  weight: number;
  detail?: string;
}

export interface ScoredMachine {
  machineId: string;
  confidence: number;
  contractValue: number;
  signals: {
    meter_accel: SignalContribution;
    error_freq: SignalContribution;
    days_since_service: SignalContribution;
    model_age: SignalContribution;
    toner_anomaly: SignalContribution;
    suggested_parts: string[];
  };
}

/**
 * Map signal contributions to suggested parts (interpretable heuristics).
 * A Set because several signals can nominate the same part.
 */
export function suggestParts(signals: ScoredMachine['signals']): string[] {
  const parts = new Set<string>();
  if (signals.toner_anomaly.value >= 0.5) parts.add('Toner cartridge');
  if (signals.meter_accel.value >= 0.5) {
    parts.add('Fuser unit');
    parts.add('Transfer belt');
  }
  if (signals.error_freq.value >= 0.5) {
    parts.add('Pickup roller');
    parts.add('Maintenance kit');
  }
  if (signals.model_age.value >= 0.6) parts.add('Drum unit');
  return Array.from(parts);
}

/**
 * Score a single machine from its meter history + ticket history. Pure.
 *
 * `nowMs` is injectable so the time-dependent signals (days since service, model
 * age) are testable — three of the five signals move with wall-clock time, which
 * makes them untestable against a hard-coded Date.now().
 */
export function scoreMachine(args: {
  machineId: string;
  installDate: Date | null;
  lastServiceDate: Date | null;
  meterRows: Array<{ readingDate: Date; total: number }>;
  recentTickets: Array<{
    status: string | null;
    createdAt: Date | null;
    description: string | null;
  }>;
  contractValue: number;
  nowMs?: number;
}): ScoredMachine {
  const now = args.nowMs ?? Date.now();

  // --- Signal 1: meter delta acceleration -------------------------------
  // Compare the most recent period-over-period delta to the prior delta.
  let meterAccel = 0;
  let meterDetail = 'insufficient meter history';
  const rows = [...args.meterRows].sort(
    (a, b) => a.readingDate.getTime() - b.readingDate.getTime(),
  );
  if (rows.length >= 3) {
    const last = rows[rows.length - 1];
    const mid = rows[rows.length - 2];
    const first = rows[rows.length - 3];
    const recentDelta = last.total - mid.total;
    const priorDelta = mid.total - first.total;
    if (priorDelta > 0) {
      const accelRatio = (recentDelta - priorDelta) / priorDelta;
      // 100% acceleration (2x volume jump) saturates the signal.
      meterAccel = clamp01(accelRatio);
      meterDetail = `recent delta ${recentDelta} vs prior ${priorDelta} (accel ${(accelRatio * 100).toFixed(0)}%)`;
    }
  }

  // --- Signal 2: error-code / ticket frequency --------------------------
  const ticketCount = args.recentTickets.length;
  const errorFreq = clamp01(ticketCount / 4); // 4+ tickets saturates
  const errorDetail = `${ticketCount} service ticket(s) in trailing 90d`;

  // --- Signal 3: days since last service --------------------------------
  let daysSince = 0;
  let daysSinceDetail = 'never serviced';
  if (args.lastServiceDate) {
    const days = (now - args.lastServiceDate.getTime()) / 86_400_000;
    daysSince = clamp01(days / 180); // 180d saturates
    daysSinceDetail = `${Math.round(days)} days since last service`;
  } else {
    // An unknown service date is treated as moderately risky rather than as
    // zero risk — absence of a record is not evidence of recent service.
    daysSince = UNKNOWN_SERVICE_RISK;
  }

  // --- Signal 4: model age ----------------------------------------------
  let modelAge = 0;
  let modelAgeDetail = 'unknown install date';
  if (args.installDate) {
    const years = (now - args.installDate.getTime()) / (365 * 86_400_000);
    modelAge = clamp01(years / 7); // 7yr saturates
    modelAgeDetail = `${years.toFixed(1)} years since install`;
  }

  // --- Signal 5: toner-cycle anomaly ------------------------------------
  // Approximated by the coefficient of variation across consumption deltas:
  // erratic consumption suggests a failing toner/imaging path.
  let tonerAnomaly = 0;
  let tonerDetail = 'no anomaly detected';
  if (rows.length >= 3) {
    const deltas: number[] = [];
    for (let i = 1; i < rows.length; i++) deltas.push(rows[i].total - rows[i - 1].total);
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    if (mean > 0) {
      const variance = deltas.reduce((a, d) => a + (d - mean) ** 2, 0) / deltas.length;
      const cv = Math.sqrt(variance) / mean;
      tonerAnomaly = clamp01(cv);
      tonerDetail = `consumption CV ${(cv * 100).toFixed(0)}%`;
    }
  }

  const signals: ScoredMachine['signals'] = {
    meter_accel: { value: meterAccel, weight: SIGNAL_WEIGHTS.meter_accel, detail: meterDetail },
    error_freq: { value: errorFreq, weight: SIGNAL_WEIGHTS.error_freq, detail: errorDetail },
    days_since_service: {
      value: daysSince,
      weight: SIGNAL_WEIGHTS.days_since_service,
      detail: daysSinceDetail,
    },
    model_age: { value: modelAge, weight: SIGNAL_WEIGHTS.model_age, detail: modelAgeDetail },
    toner_anomaly: {
      value: tonerAnomaly,
      weight: SIGNAL_WEIGHTS.toner_anomaly,
      detail: tonerDetail,
    },
    suggested_parts: [],
  };
  signals.suggested_parts = suggestParts(signals);

  // Weights already sum to 1.0, so this is a plain weighted mean — no
  // normalization step, unlike the churn model whose weights are tenant-editable.
  const confidence = clamp01(
    signals.meter_accel.value * signals.meter_accel.weight +
      signals.error_freq.value * signals.error_freq.weight +
      signals.days_since_service.value * signals.days_since_service.weight +
      signals.model_age.value * signals.model_age.weight +
      signals.toner_anomaly.value * signals.toner_anomaly.weight,
  );

  return {
    machineId: args.machineId,
    confidence,
    contractValue: args.contractValue,
    signals,
  };
}

/**
 * Per-model precision from predictions matched against subsequent closed tickets.
 *
 * A prediction counts as a true positive when a ticket for the SAME machine
 * closed within 30 days AFTER it was generated. Pure so the window arithmetic —
 * the part that decides whether the model looks accurate — is testable.
 */
export function computeAccuracy(
  predictions: Array<{ machineId: string; generatedAt: Date | null; model: string | null }>,
  closedTickets: Array<{
    equipmentId: string | null;
    resolvedAt: Date | null;
    createdAt: Date | null;
  }>,
): Array<{
  model: string;
  predictions: number;
  truePositives: number;
  falsePositives: number;
  precision: number;
}> {
  const THIRTY_DAYS = 30 * 86_400_000;
  const byModel = new Map<
    string,
    { model: string; predictions: number; truePositives: number; falsePositives: number }
  >();

  for (const p of predictions) {
    const model = p.model || 'Unknown';
    const entry = byModel.get(model) ?? {
      model,
      predictions: 0,
      truePositives: 0,
      falsePositives: 0,
    };
    entry.predictions++;

    const genTime = p.generatedAt ? p.generatedAt.getTime() : 0;
    const matched = closedTickets.some((t) => {
      if (t.equipmentId !== p.machineId) return false;
      const closeTime = (t.resolvedAt ?? t.createdAt)?.getTime();
      if (!closeTime || !genTime) return false;
      // Strictly AFTER the prediction: a ticket that closed before it was made
      // cannot have been predicted by it.
      return closeTime >= genTime && closeTime - genTime <= THIRTY_DAYS;
    });
    if (matched) entry.truePositives++;
    else entry.falsePositives++;
    byModel.set(model, entry);
  }

  return Array.from(byModel.values()).map((m) => ({
    ...m,
    precision: m.predictions > 0 ? m.truePositives / m.predictions : 0,
  }));
}
