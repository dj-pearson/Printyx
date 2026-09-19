// Kitting and first-pass-yield, the pure half (WF-L-05).
//
// The mechanical build, accessory fit and QA result a warehouse technician
// records before a unit can stage. server/routes-warehouse-fpy.ts had all of
// this with real Zod CRUD and nothing called it, and it would have 404'd in
// production anyway - no edge function served the prefix.
//
// The arithmetic lives here rather than in the handler so it can be tested
// without a database, which matters more than usual: first-pass yield is a
// number an operations manager judges technicians by.

/** A checklist entry on a kitting operation. */
export interface ChecklistItem {
  item: string;
  completed: boolean;
  completedBy?: string | null;
  completedAt?: string | null;
  notes?: string | null;
}

export interface Defect {
  defectType: string;
  description?: string | null;
  severity?: string | null;
}

export interface KittingRow {
  id?: string;
  assigned_technician?: string | null;
  equipment_model?: string | null;
  first_pass_yield?: boolean | null;
  rework_required?: boolean | null;
  defects_found?: Defect[] | null;
  operation_status?: string | null;
  quality_status?: string | null;
  [key: string]: unknown;
}

export interface FpyBreakdown {
  total: number;
  firstPass: number;
  percentage: number | null;
}

export interface FpyMetrics {
  totalOperations: number;
  firstPassOperations: number;
  /** null when nothing completed in the window - a rate over zero units is not 0%. */
  fpyPercentage: number | null;
  reworkRate: number | null;
  fpyByTechnician: Record<string, FpyBreakdown>;
  fpyByEquipmentType: Record<string, FpyBreakdown>;
  topDefectTypes: Array<{ defectType: string; count: number; percentage: number }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A rate over an empty window is NULL, not zero.
 *
 * The Express version this replaces returned 0 when no unit had been built,
 * which reads as "every build failed QA" on a dashboard - the worst possible
 * misreading of a quality metric, and indistinguishable from a real collapse.
 */
function rate(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return round2((part / whole) * 100);
}

function tally(rows: KittingRow[], key: (row: KittingRow) => string): Record<string, FpyBreakdown> {
  const out: Record<string, FpyBreakdown> = {};
  for (const row of rows) {
    const k = key(row);
    const bucket = (out[k] ??= { total: 0, firstPass: 0, percentage: null });
    bucket.total += 1;
    if (row.first_pass_yield) bucket.firstPass += 1;
  }
  for (const bucket of Object.values(out)) {
    bucket.percentage = rate(bucket.firstPass, bucket.total);
  }
  return out;
}

export function computeFpy(rows: KittingRow[]): FpyMetrics {
  const totalOperations = rows.length;
  const firstPassOperations = rows.filter((r) => r.first_pass_yield).length;

  const defectCounts = new Map<string, number>();
  for (const row of rows) {
    for (const defect of row.defects_found ?? []) {
      const type = String(defect?.defectType ?? '').trim();
      if (!type) continue;
      defectCounts.set(type, (defectCounts.get(type) ?? 0) + 1);
    }
  }

  return {
    totalOperations,
    firstPassOperations,
    fpyPercentage: rate(firstPassOperations, totalOperations),
    reworkRate: rate(rows.filter((r) => r.rework_required).length, totalOperations),
    fpyByTechnician: tally(rows, (r) => String(r.assigned_technician ?? 'unassigned')),
    fpyByEquipmentType: tally(rows, (r) => String(r.equipment_model ?? 'Unknown')),
    topDefectTypes: [...defectCounts.entries()]
      .map(([defectType, count]) => ({
        defectType,
        count,
        // Share of OPERATIONS, not of defects: one build can carry several, so
        // these do not sum to 100 and are not meant to.
        percentage: rate(count, totalOperations) ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

/** Windows the FPY endpoint accepts, in days. */
export const FPY_PERIODS: Record<string, number> = { day: 1, week: 7, month: 30, quarter: 90 };

export function periodStart(period: string, now = new Date()): Date {
  const days = FPY_PERIODS[period] ?? FPY_PERIODS.week;
  return new Date(now.getTime() - days * 86_400_000);
}

/**
 * What QA decided, and what it means for the unit.
 *
 * FIRST PASS IS DECIDED ONCE. A build that passes QA having never been reworked
 * is a first pass; one that passes after rework is not, and re-running QA on it
 * must not promote it back. That is the whole point of the metric, and it is
 * why this reads rework_count rather than the current attempt's result.
 */
export function completionUpdate(
  row: KittingRow,
  input: {
    passed: boolean;
    defects?: Defect[];
    notes?: string | null;
    completedBy?: string | null;
  },
  now = new Date(),
): Record<string, unknown> {
  const reworkCount = Number(row.rework_count ?? 0) || 0;
  const startedAt = row.started_at ? new Date(String(row.started_at)) : null;
  const durationMinutes =
    startedAt && !Number.isNaN(startedAt.getTime())
      ? Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000))
      : null;

  return {
    operation_status: input.passed ? 'completed' : 'failed',
    quality_status: input.passed ? 'passed' : 'failed',
    first_pass_yield: input.passed && reworkCount === 0,
    rework_required: !input.passed,
    rework_count: input.passed ? reworkCount : reworkCount + 1,
    ...(input.passed ? {} : { rework_notes: input.notes ?? null }),
    defects_found: input.defects ?? row.defects_found ?? [],
    completed_at: input.passed ? now.toISOString() : null,
    completed_by: input.passed ? (input.completedBy ?? null) : null,
    total_duration_minutes: input.passed ? durationMinutes : null,
    notes: input.notes ?? row.notes ?? null,
    updated_at: now.toISOString(),
  };
}

/**
 * Does a completed kitting operation satisfy the received -> staged
 * requirements that WF-L-13 will enforce?
 *
 * WF-L-13 is the story that makes the transition endpoint CHECK its
 * requirements; today it accepts whatever the caller claims. This is the
 * evidence side of that: after this story a QA pass leaves a durable,
 * queryable record, so the check has something real to read when it lands.
 *
 * `serial_number_verified` means the operation recorded the serials it built,
 * not merely that a serial exists somewhere.
 */
export function satisfiedRequirements(row: KittingRow | null | undefined): string[] {
  if (!row) return [];
  const satisfied: string[] = [];
  if (row.operation_status === 'completed' && row.quality_status === 'passed') {
    satisfied.push('quality_control_passed');
  }
  const serials = Array.isArray(row.serial_numbers) ? row.serial_numbers : [];
  if (serials.length > 0) satisfied.push('serial_number_verified');
  return satisfied;
}
