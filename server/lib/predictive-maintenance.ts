/**
 * Pure helpers for the predictive-maintenance dashboard (CR-026).
 *
 * The route batches its metrics access into a single set-based query, computes
 * health synchronously for every device with `computeEquipmentHealth`, then runs
 * the expensive per-device AI analysis for only a bounded set of the highest-risk
 * devices (`selectAiCandidates`) instead of once per row in the request path.
 */

export interface EquipmentInput {
  equipmentId: string;
  serialNumber: string | null;
  make: string | null;
  model: string | null;
  customerName: string | null;
  customerId: string | null;
  location: string | null;
  meterReading: number | null;
  lastServiceDate: Date | string | null;
  nextServiceDue: Date | string | null;
}

export type Urgency = 'overdue' | 'urgent' | 'soon' | 'scheduled';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface EquipmentHealth {
  equipmentId: string;
  serialNumber: string;
  make: string;
  model: string;
  customerName: string;
  customerId: string | null;
  location: string;
  lastServiceDate: Date | string | null;
  daysSinceService: number;
  nextServiceDue: string;
  daysUntilDue: number;
  healthScore: number;
  meterReading: number;
  recommendedPages: number;
  urgency: Urgency;
  riskLevel: RiskLevel;
  estimatedIssues: string[] | undefined;
  aiPrediction: unknown | null;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Deterministic (non-AI) health computation for a single device. Mirrors the
 * original in-route scoring exactly; `now` is injected for testability.
 */
export function computeEquipmentHealth(item: EquipmentInput, now: Date): EquipmentHealth {
  const lastService = item.lastServiceDate ? new Date(item.lastServiceDate) : null;
  const nextDue = item.nextServiceDue
    ? new Date(item.nextServiceDue)
    : new Date(now.getTime() + 90 * DAY_MS);

  const daysSinceService = lastService
    ? Math.floor((now.getTime() - lastService.getTime()) / DAY_MS)
    : 9999;

  const daysUntilDue = Math.floor((nextDue.getTime() - now.getTime()) / DAY_MS);

  let healthScore = 100;
  if (daysUntilDue < 0) {
    healthScore -= Math.min(50, Math.abs(daysUntilDue) * 2);
  }
  if (daysSinceService > 180) {
    healthScore -= Math.min(30, (daysSinceService - 180) / 10);
  }

  const meterReading = item.meterReading || 0;
  const recommendedPages = 50000;
  if (meterReading > recommendedPages) {
    healthScore -= Math.min(20, ((meterReading - recommendedPages) / recommendedPages) * 20);
  }

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  let urgency: Urgency;
  let riskLevel: RiskLevel;
  if (daysUntilDue <= 0) {
    urgency = 'overdue';
    riskLevel = 'critical';
  } else if (daysUntilDue <= 7) {
    urgency = 'urgent';
    riskLevel = 'high';
  } else if (daysUntilDue <= 30) {
    urgency = 'soon';
    riskLevel = 'medium';
  } else {
    urgency = 'scheduled';
    riskLevel = 'low';
  }

  const estimatedIssues: string[] = [];
  if (healthScore < 40) {
    estimatedIssues.push('High risk of failure');
  } else if (healthScore < 60) {
    estimatedIssues.push('Preventive maintenance recommended');
  } else if (healthScore < 80) {
    estimatedIssues.push('Minor adjustments may be needed');
  }
  if (daysUntilDue < 0) {
    estimatedIssues.push(`${Math.abs(daysUntilDue)} days overdue`);
  }

  return {
    equipmentId: item.equipmentId,
    serialNumber: item.serialNumber || 'N/A',
    make: item.make || 'Unknown',
    model: item.model || 'Unknown',
    customerName: item.customerName || 'Unknown Customer',
    customerId: item.customerId,
    location: item.location || 'Unknown',
    lastServiceDate: item.lastServiceDate,
    daysSinceService,
    nextServiceDue: nextDue.toISOString(),
    daysUntilDue,
    healthScore,
    meterReading,
    recommendedPages,
    urgency,
    riskLevel,
    estimatedIssues: estimatedIssues.length > 0 ? estimatedIssues : undefined,
    aiPrediction: null,
  };
}

/**
 * Choose which devices get the (expensive) AI analysis: only those that have
 * recent metrics to analyse, ranked by lowest health score first, capped at
 * `maxCount`. This bounds the number of synchronous AI calls per request so the
 * dashboard cannot fan out one AI call per device.
 */
export function selectAiCandidates(
  health: EquipmentHealth[],
  hasMetrics: (serialNumber: string) => boolean,
  maxCount: number,
): EquipmentHealth[] {
  return health
    .filter((h) => hasMetrics(h.serialNumber))
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, Math.max(0, maxCount));
}

/** Group metric rows by their serial number, preserving input order. */
export function groupMetricsBySerial<T extends { serialNumber: string | null }>(
  rows: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const serial = row.serialNumber;
    if (!serial) continue;
    const list = map.get(serial);
    if (list) list.push(row);
    else map.set(serial, [row]);
  }
  return map;
}
