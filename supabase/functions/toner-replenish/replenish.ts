/**
 * Pure logic for the toner-replenish edge function (PROD-011), ported from
 * server/routes-toner-replenish.ts (US-SUPER-012).
 *
 * Split out of index.ts so it can be unit-tested under Node: index.ts imports
 * ../_shared/supabase.ts, which pulls @supabase/supabase-js from esm.sh at
 * runtime and cannot be loaded by vitest.
 */

export const FOURTEEN_DAYS_MS = 14 * 86_400_000;
export const DAY_MS = 86_400_000;

export const SUPPLY_COLORS = ['k', 'c', 'm', 'y'] as const;
export type SupplyColor = (typeof SUPPLY_COLORS)[number];

export const SUPPLY_ORDER_STATUSES = [
  'pending_approval',
  'auto_ship',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type SupplyOrderStatus = (typeof SUPPLY_ORDER_STATUSES)[number];

/** Statuses that mean "this machine+color already has an order in flight". */
export const OPEN_ORDER_STATUSES: SupplyOrderStatus[] = ['pending_approval', 'auto_ship'];

/** Proxy per-color toner unit cost ($). TODO: replace with a real price lookup. */
export const TONER_UNIT_COST: Record<SupplyColor, number> = { k: 85, c: 110, m: 110, y: 110 };

export const COLOR_NAMES: Record<SupplyColor, string> = {
  k: 'Black',
  c: 'Cyan',
  m: 'Magenta',
  y: 'Yellow',
};

export const DEFAULT_APPROVAL_COST_THRESHOLD = 150;
export const DEFAULT_LEAD_TIME_DAYS = 5;
export const DEFAULT_SAFETY_BUFFER_DAYS = 3;

/** Numeric columns arrive as strings over PostgREST; anything unusable is 0. */
export function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function isSupplyColor(v: unknown): v is SupplyColor {
  return typeof v === 'string' && (SUPPLY_COLORS as readonly string[]).includes(v);
}

/** Unknown colors fall back to black rather than throwing — an order still ships. */
export function colorKeyOf(color: unknown): SupplyColor {
  return isSupplyColor(color) ? color : 'k';
}

export function supplyName(color: unknown): string {
  return `${COLOR_NAMES[colorKeyOf(color)]} toner`;
}

// ---------------------------------------------------------------------------
// Depletion prediction
// ---------------------------------------------------------------------------

export interface Reading {
  capturedAt: number;
  percentRemaining: number;
}

/**
 * Least-squares regression of percent-remaining against days-ago, used to
 * predict when a cartridge runs dry.
 *
 * x is DAYS AGO, so an older reading has a larger x. A depleting cartridge was
 * fuller in the past, which makes the slope POSITIVE — that is why dailyDrop is
 * the slope itself and not its negation.
 *
 * Returns null when there is nothing to act on, and the distinction matters
 * because null means "do not order":
 *   - fewer than 2 readings: no line to fit
 *   - zero denominator: every reading is from the same instant
 *   - slope <= 0: flat or REFILLING. Someone just replaced the cartridge, so
 *     predicting depletion from a rising curve would ship toner that is not
 *     needed.
 * A cartridge already at or below 0% is "depleted now" rather than null — it
 * genuinely needs an order today.
 */
export function predictDepletion(readings: Reading[], now: number): Date | null {
  if (readings.length < 2) return null;

  const pts = readings.map((r) => ({
    x: (now - r.capturedAt) / DAY_MS,
    y: r.percentRemaining,
  }));
  const n = pts.length;
  const sumX = pts.reduce((a, p) => a + p.x, 0);
  const sumY = pts.reduce((a, p) => a + p.y, 0);
  const sumXY = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = pts.reduce((a, p) => a + p.x * p.x, 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const dailyDrop = (n * sumXY - sumX * sumY) / denom;
  if (dailyDrop <= 0) return null;

  // The most-recent reading is the one with the SMALLEST days-ago.
  const current = pts.reduce((min, p) => (p.x < min.x ? p : min), pts[0]).y;
  if (current <= 0) return new Date(now);

  const daysToDeplete = current / dailyDrop;
  if (!Number.isFinite(daysToDeplete)) return null;
  return new Date(now + daysToDeplete * DAY_MS);
}

// ---------------------------------------------------------------------------
// Order decisions
// ---------------------------------------------------------------------------

export interface MachineSupplySettings {
  auto_ship_enabled?: unknown;
  customer_managed?: unknown;
  emergency_override?: unknown;
  cost_ceiling?: unknown;
  lead_time_days?: unknown;
  safety_buffer_days?: unknown;
}

/**
 * Whether the pipeline may order for this machine at all.
 *
 * Two independent suppressions, and the order of the checks is the policy:
 * a CUSTOMER-MANAGED machine is one whose customer buys their own toner, so
 * shipping to it bills them for something they did not ask for. That opt-out is
 * only overridden by the explicit per-machine emergency flag. autoShipEnabled is
 * the separate operator-side switch.
 */
export function isSuppressed(settings: MachineSupplySettings | null | undefined): boolean {
  if (!settings) return true;
  const customerManaged = settings.customer_managed === true;
  const emergencyOverride = settings.emergency_override === true;
  if (customerManaged && !emergencyOverride) return true;
  // Defaults to ON only when the column is genuinely absent; an explicit false
  // suppresses.
  const autoShip = settings.auto_ship_enabled;
  if (autoShip === false) return true;
  return false;
}

/** lead + buffer, taking the per-machine value when set and the tenant's otherwise. */
export function windowDays(
  settings: MachineSupplySettings | null | undefined,
  defaults: { lead: number; buffer: number },
): { lead: number; buffer: number } {
  const lead = settings?.lead_time_days == null ? defaults.lead : num(settings.lead_time_days);
  const buffer =
    settings?.safety_buffer_days == null ? defaults.buffer : num(settings.safety_buffer_days);
  return { lead, buffer };
}

/**
 * Is the predicted depletion inside the lead+buffer window — i.e. would waiting
 * another cycle mean the toner arrives too late?
 *
 * STRICTLY inside: a depletion exactly at the cutoff still leaves the full lead
 * time, so it can wait for the next run. Matches the Express `>=` skip.
 */
export function withinOrderWindow(
  predicted: Date,
  now: number,
  lead: number,
  buffer: number,
): boolean {
  return predicted.getTime() < now + (lead + buffer) * DAY_MS;
}

/**
 * Auto-ship or hold for approval.
 *
 * The gate is the MINIMUM of the tenant threshold and the machine's own ceiling,
 * so whichever party set the tighter limit wins — a per-machine ceiling can only
 * ever make approval more likely, never less. An absent ceiling is +Infinity,
 * which leaves the tenant threshold in charge.
 */
export function orderStatusFor(args: {
  totalCost: number;
  approvalThreshold: number;
  costCeiling: number | null;
}): 'pending_approval' | 'auto_ship' {
  const ceiling = args.costCeiling == null ? Number.POSITIVE_INFINITY : args.costCeiling;
  const gate = Math.min(args.approvalThreshold, ceiling);
  return args.totalCost > gate ? 'pending_approval' : 'auto_ship';
}

export function triggerReason(predicted: Date, lead: number, buffer: number): string {
  return `Predicted depletion ${predicted.toISOString().slice(0, 10)} within ${lead + buffer}-day lead+buffer window.`;
}

/** machineId::color, the key both the open-order set and the reading groups use. */
export function orderKey(machineId: unknown, color: unknown): string {
  return `${machineId}::${color ?? ''}`;
}

/** Group readings by machine+color, preserving the order rows arrive in. */
export function groupReadings(
  rows: Array<{
    machine_id: string;
    color: string;
    percent_remaining: unknown;
    captured_at: string;
  }>,
): Map<string, Reading[]> {
  const byKey = new Map<string, Reading[]>();
  for (const row of rows) {
    const key = orderKey(row.machine_id, row.color);
    const capturedAt = new Date(row.captured_at).getTime();
    if (!Number.isFinite(capturedAt)) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push({ capturedAt, percentRemaining: num(row.percent_remaining) });
  }
  return byKey;
}

/**
 * Latest reading per machine+color, from rows already ordered captured_at DESC.
 * This replaces the Express `SELECT DISTINCT ON (machine_id, color)`, which
 * PostgREST cannot express — a wrong sort here surfaces a stale toner level.
 */
export function latestPerMachineColor<T extends { machine_id: string; color: string }>(
  rows: T[],
): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    const key = orderKey(row.machine_id, row.color);
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Vendor adapter STUB
// ---------------------------------------------------------------------------

export interface MachineRow {
  id: string;
  serial_number?: string | null;
  model_number?: string | null;
  manufacturer?: string | null;
  customer_id?: string | null;
  is_color_capable?: boolean | null;
}

/**
 * Vendor supply-level adapter STUB, carried over verbatim.
 *
 * TODO(ABK): wire real multi-vendor reads via the address-book adapters with
 * credentials from the credential vault. Until then these are DETERMINISTIC
 * synthetic readings, seeded from the machine id and drifting downward with the
 * calendar day so the regression has signal. Every row it produces is written
 * with source='injected', which is the only thing distinguishing a real reading
 * from a fabricated one once it is in the table — do not drop that marker.
 */
export function fetchVendorSupplyLevels(
  machine: MachineRow,
  now: number,
): Array<{ color: SupplyColor; percentRemaining: number; pageCountRemaining: number }> {
  const colors: SupplyColor[] = machine.is_color_capable ? ['k', 'c', 'm', 'y'] : ['k'];

  let seed = 0;
  for (let i = 0; i < machine.id.length; i++) {
    seed = (seed * 31 + machine.id.charCodeAt(i)) % 100000;
  }
  const dayIndex = Math.floor(now / DAY_MS);

  return colors.map((color, idx) => {
    const channelSeed = (seed + idx * 7919) % 1000;
    const dailyRate = 0.8 + (channelSeed % 16) / 10;
    const startOffset = channelSeed % 40;
    const raw = 100 - startOffset - (dayIndex % 60) * dailyRate;
    const percentRemaining = Math.max(2, Math.min(100, Math.round(raw * 10) / 10));
    const pageCountRemaining = Math.round(percentRemaining * 120);
    return { color, percentRemaining, pageCountRemaining };
  });
}

// ---------------------------------------------------------------------------
// Response shaping
// ---------------------------------------------------------------------------

export interface Level {
  id: string;
  machineId: string;
  color: string;
  percentRemaining: number | null;
  pageCountRemaining: number | null;
  source: string | null;
  capturedAt: string | null;
  serialNumber: string | null;
  modelNumber: string | null;
  manufacturer: string | null;
  isColorCapable: boolean;
  customerId: string | null;
  companyName: string | null;
  predictedDepletionDate: string | null;
}

/**
 * Shape one level row for the dashboard. TonerReplenish.tsx reads camelCase
 * straight off the response, so raw PostgREST rows render an empty grid.
 *
 * percentRemaining stays NULL when the column is null rather than becoming 0 —
 * "no reading" and "empty cartridge" are opposite operational states, and the
 * page paints the latter red.
 */
export function toLevel(
  row: Record<string, unknown>,
  machine: Record<string, unknown> | undefined,
  companyName: string | null,
  predictedDepletionDate: string | null,
): Level {
  return {
    id: row.id as string,
    machineId: row.machine_id as string,
    color: row.color as string,
    percentRemaining: row.percent_remaining == null ? null : num(row.percent_remaining),
    pageCountRemaining: row.page_count_remaining == null ? null : num(row.page_count_remaining),
    source: (row.source as string) ?? null,
    capturedAt: (row.captured_at as string) ?? null,
    serialNumber: (machine?.serial_number as string) ?? null,
    modelNumber: (machine?.model_number as string) ?? null,
    manufacturer: (machine?.manufacturer as string) ?? null,
    isColorCapable: machine?.is_color_capable === true,
    customerId: (machine?.customer_id as string) ?? null,
    companyName,
    predictedDepletionDate,
  };
}

export interface Order {
  id: string;
  tenantId: string | null;
  machineId: string | null;
  color: string | null;
  status: string | null;
  vendor: string | null;
  partNumber: string | null;
  supplyName: string | null;
  quantity: number;
  /** Money stays a STRING, as the page types it — no float rounding on the way out. */
  unitCost: string | null;
  totalCost: string | null;
  predictedDepletionDate: string | null;
  triggerReason: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  expectedArrivalDate: string | null;
  customerNotified: boolean;
  isEmergency: boolean;
  createdByUserId: string | null;
  shippedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function toOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) ?? null,
    machineId: (row.machine_id as string) ?? null,
    color: (row.color as string) ?? null,
    status: (row.status as string) ?? null,
    vendor: (row.vendor as string) ?? null,
    partNumber: (row.part_number as string) ?? null,
    supplyName: (row.supply_name as string) ?? null,
    quantity: num(row.quantity),
    unitCost: row.unit_cost == null ? null : String(row.unit_cost),
    totalCost: row.total_cost == null ? null : String(row.total_cost),
    predictedDepletionDate: (row.predicted_depletion_date as string) ?? null,
    triggerReason: (row.trigger_reason as string) ?? null,
    trackingNumber: (row.tracking_number as string) ?? null,
    carrier: (row.carrier as string) ?? null,
    expectedArrivalDate: (row.expected_arrival_date as string) ?? null,
    customerNotified: row.customer_notified === true,
    isEmergency: row.is_emergency === true,
    createdByUserId: (row.created_by_user_id as string) ?? null,
    shippedAt: (row.shipped_at as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

export interface TenantSettings {
  tenantId: string;
  approvalCostThreshold: number;
  defaultLeadTimeDays: number;
  defaultSafetyBufferDays: number;
  updatedByUserId: string | null;
  updatedAt: string | null;
}

export function toTenantSettings(
  tenantId: string,
  row: Record<string, unknown> | null | undefined,
): TenantSettings {
  return {
    tenantId,
    approvalCostThreshold:
      row?.approval_cost_threshold == null
        ? DEFAULT_APPROVAL_COST_THRESHOLD
        : num(row.approval_cost_threshold),
    defaultLeadTimeDays:
      row?.default_lead_time_days == null
        ? DEFAULT_LEAD_TIME_DAYS
        : num(row.default_lead_time_days),
    defaultSafetyBufferDays:
      row?.default_safety_buffer_days == null
        ? DEFAULT_SAFETY_BUFFER_DAYS
        : num(row.default_safety_buffer_days),
    updatedByUserId: (row?.updated_by_user_id as string) ?? null,
    updatedAt: (row?.updated_at as string) ?? null,
  };
}

export interface MachineSettingsView {
  id: string;
  tenantId: string | null;
  machineId: string | null;
  autoShipEnabled: boolean;
  costCeiling: number | null;
  emergencyOverride: boolean;
  customerManaged: boolean;
  leadTimeDays: number | null;
  safetyBufferDays: number | null;
  updatedByUserId: string | null;
  updatedAt: string | null;
}

export function toMachineSettings(row: Record<string, unknown>): MachineSettingsView {
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) ?? null,
    machineId: (row.machine_id as string) ?? null,
    // Absent means ON (the column default); only an explicit false is off.
    autoShipEnabled: row.auto_ship_enabled !== false,
    costCeiling: row.cost_ceiling == null ? null : num(row.cost_ceiling),
    emergencyOverride: row.emergency_override === true,
    customerManaged: row.customer_managed === true,
    leadTimeDays: row.lead_time_days == null ? null : num(row.lead_time_days),
    safetyBufferDays: row.safety_buffer_days == null ? null : num(row.safety_buffer_days),
    updatedByUserId: (row.updated_by_user_id as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Input validation (mirrors the Express Zod schemas)
// ---------------------------------------------------------------------------

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function boundedNumber(
  raw: unknown,
  key: string,
  min: number,
  max: number,
  opts: { integer?: boolean } = {},
): { ok: true; value: number } | { ok: false; message: string } {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max) {
    return { ok: false, message: `${key} must be a number between ${min} and ${max}` };
  }
  if (opts.integer && !Number.isInteger(raw)) {
    return { ok: false, message: `${key} must be an integer` };
  }
  return { ok: true, value: raw };
}

export function parseCapture(body: Record<string, unknown>): Parsed<{ machineId?: string }> {
  const raw = body.machineId;
  if (raw === undefined || raw === null) return { ok: true, value: {} };
  if (typeof raw !== 'string' || raw.length < 1) {
    return { ok: false, message: 'machineId must be a non-empty string' };
  }
  return { ok: true, value: { machineId: raw } };
}

export function parseShipNow(body: Record<string, unknown>): Parsed<{ color: SupplyColor }> {
  const raw = body.color;
  if (raw === undefined || raw === null) return { ok: true, value: { color: 'k' } };
  if (!isSupplyColor(raw)) {
    return { ok: false, message: `color must be one of ${SUPPLY_COLORS.join(', ')}` };
  }
  return { ok: true, value: { color: raw } };
}

export interface TenantSettingsInput {
  approvalCostThreshold?: number;
  defaultLeadTimeDays?: number;
  defaultSafetyBufferDays?: number;
}

export function parseTenantSettings(body: Record<string, unknown>): Parsed<TenantSettingsInput> {
  const out: TenantSettingsInput = {};

  if (body.approvalCostThreshold !== undefined && body.approvalCostThreshold !== null) {
    const r = boundedNumber(body.approvalCostThreshold, 'approvalCostThreshold', 0, 1_000_000);
    if (!r.ok) return r;
    out.approvalCostThreshold = r.value;
  }
  for (const key of ['defaultLeadTimeDays', 'defaultSafetyBufferDays'] as const) {
    if (body[key] === undefined || body[key] === null) continue;
    const r = boundedNumber(body[key], key, 0, 365, { integer: true });
    if (!r.ok) return r;
    out[key] = r.value;
  }
  return { ok: true, value: out };
}

export interface MachineSettingsInput {
  autoShipEnabled?: boolean;
  costCeiling?: number | null;
  emergencyOverride?: boolean;
  customerManaged?: boolean;
  leadTimeDays?: number | null;
  safetyBufferDays?: number | null;
}

export function parseMachineSettings(body: Record<string, unknown>): Parsed<MachineSettingsInput> {
  const out: MachineSettingsInput = {};

  for (const key of ['autoShipEnabled', 'emergencyOverride', 'customerManaged'] as const) {
    const raw = body[key];
    if (raw === undefined) continue;
    if (typeof raw !== 'boolean') return { ok: false, message: `${key} must be a boolean` };
    out[key] = raw;
  }

  // NULL is meaningful on these three: it clears the per-machine override and
  // falls back to the tenant default, which is different from omitting the key
  // (leave as-is).
  if (body.costCeiling !== undefined) {
    if (body.costCeiling === null) {
      out.costCeiling = null;
    } else {
      const r = boundedNumber(body.costCeiling, 'costCeiling', 0, 1_000_000);
      if (!r.ok) return r;
      out.costCeiling = r.value;
    }
  }
  for (const key of ['leadTimeDays', 'safetyBufferDays'] as const) {
    if (body[key] === undefined) continue;
    if (body[key] === null) {
      out[key] = null;
      continue;
    }
    const r = boundedNumber(body[key], key, 0, 365, { integer: true });
    if (!r.ok) return r;
    out[key] = r.value;
  }

  return { ok: true, value: out };
}

/** ?status=; 'all' and anything unrecognised mean no filter. */
export function parseOrderStatusFilter(raw: string | null): SupplyOrderStatus | null {
  if (!raw || raw === 'all') return null;
  return (SUPPLY_ORDER_STATUSES as readonly string[]).includes(raw)
    ? (raw as SupplyOrderStatus)
    : null;
}
