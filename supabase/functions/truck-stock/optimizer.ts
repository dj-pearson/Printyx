/**
 * Pure logic for the truck-stock edge function (PROD-011), ported from
 * server/routes-truck-stock.ts (US-SUPER-007).
 *
 * Split out of index.ts so it can be unit-tested under Node: index.ts imports
 * ../_shared/supabase.ts, which pulls @supabase/supabase-js from esm.sh at
 * runtime and cannot be loaded by vitest.
 */

export const NINETY_DAYS_MS = 90 * 86_400_000;

/** Capacity defaults when a tech has no settings row yet. */
export const DEFAULT_MAX_TOTAL_QUANTITY = 120;
export const DEFAULT_MAX_DISTINCT_SKUS = 40;

/** Numeric columns arrive as strings over PostgREST; anything unusable is 0. */
export function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export interface RecommendedItem {
  sku: string;
  description: string;
  recommendedQty: number;
  currentQty: number;
  delta: number;
  unitCost: number;
  usage90d: number;
}

/**
 * Per-SKU usage counts and per-job part maps from the tech's last-90-day tickets.
 *
 * A "parts job" is a ticket that used at least one part; tickets with none are
 * skipped entirely rather than counted as trivially covered, which would inflate
 * the fill rate toward 100% for a tech who mostly does no-part visits.
 */
export function tallyUsage(tickets: Array<{ parts_used: unknown }>): {
  usage: Map<string, number>;
  partsJobs: Map<string, number>[];
} {
  const usage = new Map<string, number>();
  const partsJobs: Map<string, number>[] = [];

  for (const t of tickets) {
    const raw = Array.isArray(t.parts_used) ? t.parts_used : [];
    const parts = raw.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
    if (parts.length === 0) continue;

    const job = new Map<string, number>();
    for (const part of parts) {
      const sku = part.trim();
      usage.set(sku, (usage.get(sku) ?? 0) + 1);
      job.set(sku, (job.get(sku) ?? 0) + 1);
    }
    partsJobs.push(job);
  }

  return { usage, partsJobs };
}

/**
 * Coverage fill-rate PROXY, as a percentage to one decimal: the share of parts
 * jobs where EVERY part used was on the truck in sufficient quantity.
 *
 * All-or-nothing per job on purpose — a job where the tech had 3 of 4 parts
 * still meant a trip back to base, so partial credit would describe a return
 * trip as 75% avoided.
 *
 * With no parts jobs the answer is 0, not 100: an empty history is no evidence
 * of coverage, and reporting 100% would say the truck is perfectly stocked.
 */
export function fillRate(partsJobs: Map<string, number>[], stock: Map<string, number>): number {
  if (partsJobs.length === 0) return 0;
  let covered = 0;
  for (const job of partsJobs) {
    let ok = true;
    for (const [sku, used] of Array.from(job.entries())) {
      if ((stock.get(sku) ?? 0) < used) {
        ok = false;
        break;
      }
    }
    if (ok) covered += 1;
  }
  return Math.round((covered / partsJobs.length) * 1000) / 10;
}

/**
 * Greedy capacity fit: most-used SKUs first, taking each one's full 90-day usage
 * as the recommended quantity until either capacity runs out.
 *
 * The last SKU that fits is TRUNCATED to the remaining space rather than
 * dropped, so the truck is filled rather than left with an unusable gap.
 */
export function selectRecommendedItems(args: {
  usage: Map<string, number>;
  currentStock: Map<string, number>;
  costMap: Map<string, { unitCost: number; description: string }>;
  capacityTotal: number;
  capacityDistinct: number;
}): { items: RecommendedItem[]; recommendedStock: Map<string, number> } {
  const { usage, currentStock, costMap, capacityTotal, capacityDistinct } = args;

  const sorted = Array.from(usage.entries()).sort((a, b) => b[1] - a[1]);
  const items: RecommendedItem[] = [];
  const recommendedStock = new Map<string, number>();
  let totalQty = 0;
  let distinct = 0;

  for (const [sku, usage90d] of sorted) {
    if (distinct >= capacityDistinct) break;
    const remaining = capacityTotal - totalQty;
    if (remaining <= 0) break;
    const recommendedQty = Math.min(usage90d, remaining);
    if (recommendedQty <= 0) break;

    const currentQty = currentStock.get(sku) ?? 0;
    const matched = costMap.get(sku);
    items.push({
      sku,
      description: matched?.description ?? sku,
      recommendedQty,
      currentQty,
      // Negative delta = overstocked. Kept signed so the CSV shows what to
      // REMOVE as well as what to add.
      delta: recommendedQty - currentQty,
      unitCost: matched?.unitCost ?? 0,
      usage90d,
    });
    recommendedStock.set(sku, recommendedQty);
    totalQty += recommendedQty;
    distinct += 1;
  }

  return { items, recommendedStock };
}

export interface InventoryItemRow {
  part_number?: string | null;
  name?: string | null;
  item_description?: string | null;
  unit_cost?: unknown;
}

/**
 * Fuzzy SKU -> cost/description match: part_number OR name equals the SKU.
 * FIRST match wins, so a later row cannot overwrite an earlier one. Unmatched
 * SKUs are simply absent, and the caller falls back to cost 0 and the SKU as its
 * own description — an unknown part is still worth stocking.
 */
export function buildCostMap(
  items: InventoryItemRow[],
  skus: string[],
): Map<string, { unitCost: number; description: string }> {
  const wanted = new Set(skus);
  const out = new Map<string, { unitCost: number; description: string }>();

  for (const item of items) {
    for (const candidate of [item.part_number, item.name]) {
      if (typeof candidate !== 'string' || !wanted.has(candidate)) continue;
      if (out.has(candidate)) continue;
      out.set(candidate, {
        unitCost: num(item.unit_cost),
        description: item.item_description || item.name || candidate,
      });
    }
  }
  return out;
}

/**
 * Keep only the newest row per tech, from rows already ordered newest-first.
 * A wrong sort silently surfaces a stale recommendation as the current one.
 */
export function latestPerTech<T extends { tech_user_id: string }>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    if (!latest.has(row.tech_user_id)) latest.set(row.tech_user_id, row);
  }
  return Array.from(latest.values());
}

/** Display name for a tech, or null when neither name part is present. */
export function techDisplayName(row: {
  first_name?: string | null;
  last_name?: string | null;
}): string | null {
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return name || null;
}

/**
 * tech id -> display name. `techUserId` may be a technicians.id OR a
 * technicians.user_id (a documented stub in the original), so both are indexed.
 */
export function resolveTechNames(
  technicians: Array<{
    id: string;
    user_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  }>,
  techIds: string[],
): Map<string, string> {
  const wanted = new Set(techIds);
  const out = new Map<string, string>();
  for (const tech of technicians) {
    const name = techDisplayName(tech);
    if (!name) continue;
    if (wanted.has(tech.id)) out.set(tech.id, name);
    if (tech.user_id && wanted.has(tech.user_id)) out.set(tech.user_id, name);
  }
  return out;
}

export interface Recommendation {
  id: string;
  tenantId: string | null;
  techUserId: string | null;
  generatedAt: string | null;
  currentFillRate: number | null;
  projectedFillRate: number | null;
  capacityTotal: number | null;
  capacityDistinct: number | null;
  recommendedItems: unknown;
  status: string | null;
  pickedAt: string | null;
  receivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Explicit column -> camelCase mapping. TruckStocking.tsx reads camelCase keys
 * straight off the response (`currentFillRate`, `recommendedItems`,
 * `generatedAt`), so returning raw PostgREST rows renders an empty table.
 *
 * `recommended_items` is jsonb and passes through untouched — its inner keys
 * (sku, recommendedQty, …) are data we wrote, not columns.
 */
export function toCamelRecommendation(row: Record<string, unknown>): Recommendation {
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) ?? null,
    techUserId: (row.tech_user_id as string) ?? null,
    generatedAt: (row.generated_at as string) ?? null,
    currentFillRate: row.current_fill_rate == null ? null : num(row.current_fill_rate),
    projectedFillRate: row.projected_fill_rate == null ? null : num(row.projected_fill_rate),
    capacityTotal: row.capacity_total == null ? null : num(row.capacity_total),
    capacityDistinct: row.capacity_distinct == null ? null : num(row.capacity_distinct),
    recommendedItems: row.recommended_items ?? null,
    status: (row.status as string) ?? null,
    pickedAt: (row.picked_at as string) ?? null,
    receivedAt: (row.received_at as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

export interface TruckInventoryRow {
  id: string;
  tenantId: string | null;
  techUserId: string | null;
  partSku: string | null;
  quantityOnTruck: number;
  capacityConstraint: number | null;
  lastAuditedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function toCamelInventory(row: Record<string, unknown>): TruckInventoryRow {
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) ?? null,
    techUserId: (row.tech_user_id as string) ?? null,
    partSku: (row.part_sku as string) ?? null,
    quantityOnTruck: num(row.quantity_on_truck),
    capacityConstraint: row.capacity_constraint == null ? null : num(row.capacity_constraint),
    lastAuditedAt: (row.last_audited_at as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

export interface Settings {
  id: string;
  tenantId: string | null;
  techUserId: string | null;
  maxTotalQuantity: number;
  maxDistinctSkus: number;
  updatedByUserId: string | null;
  updatedAt: string | null;
}

export function toCamelSettings(row: Record<string, unknown>): Settings {
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) ?? null,
    techUserId: (row.tech_user_id as string) ?? null,
    maxTotalQuantity:
      row.max_total_quantity == null ? DEFAULT_MAX_TOTAL_QUANTITY : num(row.max_total_quantity),
    maxDistinctSkus:
      row.max_distinct_skus == null ? DEFAULT_MAX_DISTINCT_SKUS : num(row.max_distinct_skus),
    updatedByUserId: (row.updated_by_user_id as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

/** How many SKUs the tech needs MORE of — the count the list column shows. */
export function countRecommendedAdditions(recommendedItems: unknown): number {
  if (!Array.isArray(recommendedItems)) return 0;
  return recommendedItems.filter(
    (item) => item && typeof item === 'object' && num((item as RecommendedItem).delta) > 0,
  ).length;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export const CSV_HEADER = [
  'SKU',
  'Description',
  'Current Qty',
  'Recommended Qty',
  'Delta',
  'Unit Cost',
];

/**
 * RFC-4180 field escaping: quote when the value contains a comma, quote or
 * newline, and double any embedded quotes. A part description with a comma in it
 * would otherwise shift every later column in the warehouse's pick list.
 */
export function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildPickListCsv(recommendedItems: unknown): string {
  const items = Array.isArray(recommendedItems) ? (recommendedItems as RecommendedItem[]) : [];
  const lines = [CSV_HEADER.join(',')];
  for (const item of items) {
    lines.push(
      [
        csvEscape(item.sku),
        csvEscape(item.description),
        num(item.currentQty),
        num(item.recommendedQty),
        num(item.delta),
        num(item.unitCost).toFixed(2),
      ].join(','),
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface StatsInput {
  callbacks: Array<{ tech_user_id: string | null }>;
  latestRecs: Array<{ current_fill_rate: unknown; projected_fill_rate: unknown }>;
}

export interface Stats {
  totalCallbacks: number;
  callbacksByTech: Array<{ techUserId: string; count: number }>;
  recommendationCount: number;
  avgCurrentFillRate: number | null;
  avgProjectedFillRate: number | null;
  fillRateLift: number | null;
}

/**
 * Callback counts plus the average fill-rate lift across the latest
 * recommendation per tech.
 *
 * The averages are null — not 0 — with no recommendations, because 0% fill rate
 * and "we have not measured" are different claims and the dashboard renders the
 * former as a red number.
 */
export function computeStats(input: StatsInput): Stats {
  const byTech = new Map<string, number>();
  for (const callback of input.callbacks) {
    const key = callback.tech_user_id ?? 'unassigned';
    byTech.set(key, (byTech.get(key) ?? 0) + 1);
  }

  const latest = input.latestRecs;
  const avg = (pick: (r: StatsInput['latestRecs'][number]) => unknown): number | null =>
    latest.length > 0
      ? Math.round((latest.reduce((a, r) => a + num(pick(r)), 0) / latest.length) * 10) / 10
      : null;

  const avgCurrent = avg((r) => r.current_fill_rate);
  const avgProjected = avg((r) => r.projected_fill_rate);

  return {
    totalCallbacks: input.callbacks.length,
    callbacksByTech: Array.from(byTech.entries()).map(([techUserId, count]) => ({
      techUserId,
      count,
    })),
    recommendationCount: latest.length,
    avgCurrentFillRate: avgCurrent,
    avgProjectedFillRate: avgProjected,
    fillRateLift:
      avgCurrent != null && avgProjected != null
        ? Math.round((avgProjected - avgCurrent) * 10) / 10
        : null,
  };
}

// ---------------------------------------------------------------------------
// Input validation (mirrors the Express Zod schemas)
// ---------------------------------------------------------------------------

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function boundedInt(
  raw: unknown,
  key: string,
  min: number,
  max: number,
): { ok: true; value: number | undefined } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < min || raw > max) {
    return { ok: false, message: `${key} must be an integer between ${min} and ${max}` };
  }
  return { ok: true, value: raw };
}

export function parseGenerate(body: Record<string, unknown>): Parsed<{ techUserId?: string }> {
  const raw = body.techUserId;
  if (raw === undefined || raw === null) return { ok: true, value: {} };
  if (typeof raw !== 'string' || raw.length < 1) {
    return { ok: false, message: 'techUserId must be a non-empty string' };
  }
  return { ok: true, value: { techUserId: raw } };
}

export interface SettingsInput {
  techUserId: string;
  maxTotalQuantity?: number;
  maxDistinctSkus?: number;
}

export function parseSettingsInput(body: Record<string, unknown>): Parsed<SettingsInput> {
  if (typeof body.techUserId !== 'string' || body.techUserId.length < 1) {
    return { ok: false, message: 'techUserId is required' };
  }
  const out: SettingsInput = { techUserId: body.techUserId };

  const total = boundedInt(body.maxTotalQuantity, 'maxTotalQuantity', 1, 100_000);
  if (!total.ok) return total;
  if (total.value !== undefined) out.maxTotalQuantity = total.value;

  const distinct = boundedInt(body.maxDistinctSkus, 'maxDistinctSkus', 1, 10_000);
  if (!distinct.ok) return distinct;
  if (distinct.value !== undefined) out.maxDistinctSkus = distinct.value;

  return { ok: true, value: out };
}

export interface CallbackInput {
  techUserId?: string;
  ticketId?: string;
  missingPartSku?: string;
  note?: string;
}

export function parseCallback(body: Record<string, unknown>): Parsed<CallbackInput> {
  const out: CallbackInput = {};

  for (const key of ['techUserId', 'ticketId', 'missingPartSku'] as const) {
    const raw = body[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string' || raw.length < 1) {
      return { ok: false, message: `${key} must be a non-empty string` };
    }
    out[key] = raw;
  }

  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string' || body.note.length > 1000) {
      return { ok: false, message: 'note must be a string of at most 1000 characters' };
    }
    out.note = body.note;
  }

  return { ok: true, value: out };
}
