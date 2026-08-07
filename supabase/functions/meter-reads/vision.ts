/**
 * Pure logic for the meter-reads edge function (PROD-011), ported from
 * server/routes-meter-read-vision.ts.
 *
 * Split out of index.ts so it can be unit-tested under Node: index.ts imports
 * ../_shared/supabase.ts, which pulls @supabase/supabase-js from esm.sh at
 * runtime and cannot be loaded by vitest.
 */

export const NINETY_DAYS_MS = 90 * 86_400_000;

export const DEFAULT_CONFIRM_TEMPLATE =
  'Thanks! We recorded your meter read: black {{black}}, color {{color}}. No action needed.';
export const DEFAULT_CLARIFY_TEMPLATE =
  "Thanks for the photo! We couldn't match it to a specific machine. Please reply with your account name or the device serial number so we can record the read.";

export const VALIDATION_STATUSES = [
  'pending',
  'auto_approved',
  'flagged',
  'approved',
  'rejected',
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export interface ExtractedMeter {
  black: number;
  color: number;
  scan: number;
  fax: number;
  confidence: number;
  source: 'ai' | 'fallback';
}

/** Zeroed, zero-confidence, and explicitly marked 'fallback' so it can never auto-bill. */
export const FALLBACK_EXTRACTION: ExtractedMeter = {
  black: 0,
  color: 0,
  scan: 0,
  fax: 0,
  confidence: 0,
  source: 'fallback',
};

/**
 * Parse the model's reply into counters.
 *
 * Returns null on anything unusable so the caller substitutes FALLBACK_EXTRACTION
 * — which is flagged and never auto-billed. Counters are floored at 0 and
 * rounded: a page counter is a non-negative integer, and a hallucinated -3 or
 * 1234.7 must not reach a billing row.
 */
export function parseVisionResponse(text: string): ExtractedMeter | null {
  const match = (text ?? '').match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  };
  const conf =
    typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence);

  return {
    black: num(parsed.black),
    color: num(parsed.color),
    scan: num(parsed.scan),
    fax: num(parsed.fax),
    // 0.5 on an unreadable confidence, matching Express: absent confidence is
    // "unknown", not "certain".
    confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
    source: 'ai',
  };
}

export interface RollingStats {
  lastBlack: number | null;
  rollingAvg: number | null;
}

/**
 * Last reading and rolling mean of the black counter, over rows already ordered
 * NEWEST FIRST — `lastBlack` is rows[0], so a wrong sort silently compares the
 * new read against the oldest one in the window.
 */
export function rollingStats(rows: Array<{ bw_meter_reading: unknown }>): RollingStats {
  const blacks = rows
    .map((r) => (r.bw_meter_reading == null ? null : Number(r.bw_meter_reading)))
    .filter((n): n is number => n != null && Number.isFinite(n));

  if (blacks.length === 0) return { lastBlack: null, rollingAvg: null };
  return {
    lastBlack: blacks[0],
    rollingAvg: blacks.reduce((a, b) => a + b, 0) / blacks.length,
  };
}

export interface ValidationOutcome {
  flagged: boolean;
  reason: string;
}

/**
 * Decide whether a read can be auto-billed.
 *
 * Three ways to fail, checked in this order:
 *   1. The counter went BACKWARDS — a lifetime page counter cannot decrease, so
 *      this is a misread or the wrong machine.
 *   2. The jump exceeds maxDeltaMultiplier × the rolling average — plausible but
 *      unusual, so a human looks before it becomes an invoice.
 *   3. The extraction came from the offline fallback, whose counters are all
 *      zero. This check is LAST but is the one that matters most: without it a
 *      keyless deployment would auto-bill every customer a read of 0.
 *
 * With no history (lastBlack null) the first two cannot fire, so a first-ever
 * read from a real extraction auto-approves. That is intended — there is nothing
 * to compare against.
 */
export function computeValidation(args: {
  lastBlack: number | null;
  rollingAvg: number | null;
  newBlack: number;
  maxDeltaMultiplier: number;
  extractionSource: 'ai' | 'fallback';
}): ValidationOutcome {
  const { lastBlack, rollingAvg, newBlack, maxDeltaMultiplier, extractionSource } = args;
  const deltaBlack = lastBlack == null ? null : newBlack - lastBlack;

  if (lastBlack != null && deltaBlack != null && deltaBlack < 0) {
    return {
      flagged: true,
      reason: `Black counter went backwards (${lastBlack} → ${newBlack}).`,
    };
  }

  if (
    lastBlack != null &&
    deltaBlack != null &&
    rollingAvg != null &&
    rollingAvg > 0 &&
    deltaBlack > maxDeltaMultiplier * rollingAvg
  ) {
    return {
      flagged: true,
      reason: `Black delta ${deltaBlack} exceeds ${maxDeltaMultiplier}× the rolling avg (${Math.round(
        rollingAvg,
      )}).`,
    };
  }

  if (extractionSource === 'fallback') {
    return { flagged: true, reason: 'Extraction unavailable (fallback); needs manual entry.' };
  }

  return { flagged: false, reason: 'Within expected range.' };
}

/** Delta of the new black counter against the last one; null with no history. */
export function blackDelta(lastBlack: number | null, newBlack: number): number | null {
  return lastBlack == null ? null : newBlack - lastBlack;
}

/** {{token}} substitution. An unknown token is left verbatim rather than blanked. */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{{${key}}}`,
  );
}

/**
 * Match a caller's phone against the tenant's records on the last 10 digits,
 * ignoring formatting. Best-effort and deliberately conservative:
 *   - fewer than 7 digits is treated as unusable rather than matched loosely
 *   - AMBIGUITY LOSES. Express took the first hit; here two records matching the
 *     same number resolve to nobody, because attributing a meter read to the
 *     wrong customer bills the wrong company.
 */
export function matchCustomerByPhone(
  candidates: Array<{ id: string; phone: string | null }>,
  fromPhone: string | null | undefined,
): string | null {
  if (!fromPhone) return null;
  const norm = fromPhone.replace(/\D/g, '');
  if (norm.length < 7) return null;

  const tail = norm.slice(-10);
  const hits = candidates.filter((c) => c.phone && c.phone.replace(/\D/g, '').endsWith(tail));
  return hits.length === 1 ? hits[0].id : null;
}

export interface Submission {
  id: string;
  tenantId: string | null;
  source: string | null;
  fromPhone: string | null;
  customerId: string | null;
  machineId: string | null;
  rawImageUrl: string | null;
  imageHash: string | null;
  extractedValues: unknown;
  validationStatus: string | null;
  validationDetail: unknown;
  outboundMessage: string | null;
  meterReadingId: string | null;
  submittedAt: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
}

/**
 * Explicit column -> camelCase mapping. MeterReadReview.tsx reads camelCase keys
 * straight off the response (`validationStatus`, `extractedValues.black`,
 * `rawImageUrl`), so returning raw PostgREST rows renders an empty queue — the
 * same defect EDGE-005a hit on AP/AR.
 *
 * `extracted_values` and `validation_detail` are jsonb and pass through
 * untouched: never key-convert a jsonb column. The page reads
 * `extractedValues.black` and `validationDetail.reason`, which are already the
 * keys we wrote.
 */
export function toCamelSubmission(row: Record<string, unknown>): Submission {
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) ?? null,
    source: (row.source as string) ?? null,
    fromPhone: (row.from_phone as string) ?? null,
    customerId: (row.customer_id as string) ?? null,
    machineId: (row.machine_id as string) ?? null,
    rawImageUrl: (row.raw_image_url as string) ?? null,
    imageHash: (row.image_hash as string) ?? null,
    extractedValues: row.extracted_values ?? null,
    validationStatus: (row.validation_status as string) ?? null,
    validationDetail: row.validation_detail ?? null,
    outboundMessage: (row.outbound_message as string) ?? null,
    meterReadingId: (row.meter_reading_id as string) ?? null,
    submittedAt: (row.submitted_at as string) ?? null,
    reviewedByUserId: (row.reviewed_by_user_id as string) ?? null,
    reviewedAt: (row.reviewed_at as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
  };
}

export interface CredSetMarkers {
  twilioAccountSidSet: boolean;
  twilioAuthTokenSet: boolean;
  twilioFromNumberSet: boolean;
}

/**
 * Presence markers for the stored Twilio credentials. Never returns a value.
 *
 * Accepts BOTH shapes: the vault envelope written now ({blob, v}) and the legacy
 * base64 string Express wrote. Existing tenants keep reporting "configured"
 * across the format change.
 */
export function credSetMarkers(encryptedConfig: unknown): CredSetMarkers {
  const cfg = (encryptedConfig ?? {}) as Record<string, unknown>;
  const isSet = (v: unknown): boolean => {
    if (typeof v === 'string') return v.length > 0;
    if (v && typeof v === 'object') {
      const blob = (v as { blob?: unknown }).blob;
      return typeof blob === 'string' && blob.length > 0;
    }
    return false;
  };
  return {
    twilioAccountSidSet: isSet(cfg.twilioAccountSid),
    twilioAuthTokenSet: isSet(cfg.twilioAuthToken),
    twilioFromNumberSet: isSet(cfg.twilioFromNumber),
  };
}

export interface SettingsRow {
  tenant_id?: string;
  max_delta_multiplier?: unknown;
  confirm_template?: string | null;
  clarify_template?: string | null;
  encrypted_config?: unknown;
  updated_at?: unknown;
}

/** Public settings projection: templates + threshold + *_set booleans, no creds. */
export function projectSettings(tenantId: string, row: SettingsRow | null | undefined) {
  const multiplier = Number(row?.max_delta_multiplier);
  return {
    tenantId,
    maxDeltaMultiplier: Number.isFinite(multiplier) ? multiplier : 3,
    confirmTemplate: row?.confirm_template ?? DEFAULT_CONFIRM_TEMPLATE,
    clarifyTemplate: row?.clarify_template ?? DEFAULT_CLARIFY_TEMPLATE,
    updatedAt: (row?.updated_at as string) ?? null,
    ...credSetMarkers(row?.encrypted_config),
  };
}

// ---------------------------------------------------------------------------
// Input validation (mirrors the Express Zod schemas)
// ---------------------------------------------------------------------------

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function optionalNonEmptyString(
  body: Record<string, unknown>,
  key: string,
): { ok: true; value: string | undefined } | { ok: false; message: string } {
  const raw = body[key];
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw !== 'string' || raw.length < 1) {
    return { ok: false, message: `${key} must be a non-empty string` };
  }
  return { ok: true, value: raw };
}

export interface InboundInput {
  fromPhone?: string;
  imageBase64?: string;
  imageUrl?: string;
  mediaType?: string;
  machineId?: string;
  customerId?: string;
}

export function parseInbound(body: Record<string, unknown>): Parsed<InboundInput> {
  const out: InboundInput = {};
  for (const key of [
    'fromPhone',
    'imageBase64',
    'imageUrl',
    'mediaType',
    'machineId',
    'customerId',
  ] as const) {
    const field = optionalNonEmptyString(body, key);
    if (!field.ok) return field;
    if (field.value !== undefined) out[key] = field.value;
  }
  return { ok: true, value: out };
}

export interface SubmitInput {
  machineId: string;
  imageBase64?: string;
  imageUrl?: string;
  mediaType?: string;
  source: 'web' | 'manual';
}

export function parseSubmit(body: Record<string, unknown>): Parsed<SubmitInput> {
  if (typeof body.machineId !== 'string' || body.machineId.length < 1) {
    return { ok: false, message: 'machineId is required' };
  }
  const out: SubmitInput = { machineId: body.machineId, source: 'web' };

  for (const key of ['imageBase64', 'imageUrl', 'mediaType'] as const) {
    const field = optionalNonEmptyString(body, key);
    if (!field.ok) return field;
    if (field.value !== undefined) out[key] = field.value;
  }

  if (body.source !== undefined && body.source !== null) {
    if (body.source !== 'web' && body.source !== 'manual') {
      return { ok: false, message: "source must be 'web' or 'manual'" };
    }
    out.source = body.source;
  }
  return { ok: true, value: out };
}

export interface ApproveInput {
  black?: number;
  color?: number;
  scan?: number;
  fax?: number;
  machineId?: string;
}

export function parseApprove(body: Record<string, unknown>): Parsed<ApproveInput> {
  const out: ApproveInput = {};
  for (const key of ['black', 'color', 'scan', 'fax'] as const) {
    const raw = body[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
      return { ok: false, message: `${key} must be a non-negative integer` };
    }
    out[key] = raw;
  }
  const machineId = optionalNonEmptyString(body, 'machineId');
  if (!machineId.ok) return machineId;
  if (machineId.value !== undefined) out.machineId = machineId.value;
  return { ok: true, value: out };
}

export interface SettingsInput {
  maxDeltaMultiplier?: number;
  confirmTemplate?: string;
  clarifyTemplate?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
}

export function parseSettings(body: Record<string, unknown>): Parsed<SettingsInput> {
  const out: SettingsInput = {};

  if (body.maxDeltaMultiplier !== undefined && body.maxDeltaMultiplier !== null) {
    const raw = body.maxDeltaMultiplier;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 100) {
      return { ok: false, message: 'maxDeltaMultiplier must be an integer between 1 and 100' };
    }
    out.maxDeltaMultiplier = raw;
  }

  // Templates may be set to '' deliberately, so empty is allowed here — unlike
  // the credentials below, where empty would be a footgun.
  for (const key of ['confirmTemplate', 'clarifyTemplate'] as const) {
    const raw = body[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string' || raw.length > 1000) {
      return { ok: false, message: `${key} must be a string of at most 1000 characters` };
    }
    out[key] = raw;
  }

  for (const key of ['twilioAccountSid', 'twilioAuthToken', 'twilioFromNumber'] as const) {
    const field = optionalNonEmptyString(body, key);
    if (!field.ok) return field;
    if (field.value !== undefined) out[key] = field.value;
  }

  return { ok: true, value: out };
}

/** ?status=; 'all' and anything absent mean no filter. */
export function parseStatusFilter(raw: string | null): ValidationStatus | null {
  if (!raw || raw === 'all') return null;
  return (VALIDATION_STATUSES as readonly string[]).includes(raw)
    ? (raw as ValidationStatus)
    : null;
}
