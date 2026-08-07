/**
 * Pure logic for the knowledge-search half of the `service` edge function
 * (PROD-011), ported from server/routes-service-knowledge.ts.
 *
 * Split out of index.ts so it can be unit-tested under Node: index.ts imports
 * ../_shared/supabase.ts, which pulls @supabase/supabase-js from esm.sh at
 * runtime and cannot be loaded by vitest.
 */

/** OpenAI text-embedding-3-small. Must match shared/service-knowledge-schema.ts. */
export const EMBEDDING_DIMS = 1536;

/** Closed-ticket statuses eligible for embedding and for the proxy metrics. */
export const CLOSED_STATUSES = ['completed', 'closed', 'resolved'] as const;

export const TWENTY_FOUR_MONTHS_MS = 730 * 86_400_000;
export const SUMMARY_MAX = 280;
export const CONTENT_MAX = 8000;

/**
 * 32-bit string hash. Byte-for-byte identical to the Express implementation ON
 * PURPOSE: rows already embedded by the Express fallback path must stay
 * comparable to vectors produced here. Change this and every stored fallback
 * embedding silently stops matching.
 */
export function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Deterministic, dependency-free hash embedding (L2-normalized token histogram).
 *
 * This is what makes search work with no OPENAI_API_KEY. The shared helper
 * `createEmbedding` returns null in that case, and returning null here would
 * mean every search comes back empty — so the Express fallback is carried over
 * rather than dropped.
 */
export function fallbackEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMS).fill(0);
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const bucket = ((hashCode(tok) % EMBEDDING_DIMS) + EMBEDDING_DIMS) % EMBEDDING_DIMS;
    vec[bucket] += 1;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }
  return vec;
}

/** Cosine similarity, guarded against length mismatch and zero norm. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface TicketLike {
  id?: string;
  title?: string | null;
  description?: string | null;
  resolution_notes?: string | null;
  parts_used?: unknown;
}

/** Best-effort error-code extraction from title/description (e.g. "E000-0001", "C2557"). */
export function extractErrorCodes(ticket: TicketLike): string {
  const hay = `${ticket.title ?? ''} ${ticket.description ?? ''}`;
  const matches = hay.match(/\b[A-Z]{1,3}-?\d{2,5}(?:-\d{2,5})?\b/g);
  return matches ? Array.from(new Set(matches)).join(' ') : '';
}

/** The text we embed for a ticket: resolution + parts + model + codes/title. */
export function buildTicketContent(ticket: TicketLike, machineModel: string | null): string {
  const parts = Array.isArray(ticket.parts_used) ? ticket.parts_used.join(' ') : '';
  const codes = extractErrorCodes(ticket);
  return [ticket.resolution_notes ?? '', parts, machineModel ?? '', codes, ticket.title ?? '']
    .filter(Boolean)
    .join('\n')
    .slice(0, CONTENT_MAX);
}

export function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export interface EmbeddingRow {
  ticket_id: string;
  machine_model: string | null;
  embedding: unknown;
}

export interface ScoredHit {
  ticketId: string;
  machineModel: string | null;
  score: number;
}

/**
 * Rank a tenant's embedding rows against the query vector.
 *
 * Rows with no vector are DROPPED rather than scored 0 — a row that was never
 * embedded is absent from the index, not a bad match, and scoring it 0 would
 * let it occupy a slot in the top-N when nothing else matched.
 */
export function rankBySimilarity(
  rows: EmbeddingRow[],
  queryEmbedding: number[],
  limit: number,
): ScoredHit[] {
  return rows
    .map((r) => {
      const vec = Array.isArray(r.embedding) ? (r.embedding as number[]) : null;
      if (!vec || vec.length === 0) return null;
      return {
        ticketId: r.ticket_id,
        machineModel: r.machine_model,
        score: cosineSimilarity(queryEmbedding, vec),
      };
    })
    .filter((x): x is ScoredHit => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Relevance is reported clamped to [0,1] and rounded to 3dp. */
export function roundRelevance(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 1000) / 1000;
}

export interface ProxyTicketRow {
  status: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

export interface ModelProxies {
  meanResolutionTimeHours: number | null;
  fixSuccessRate: number | null;
}

/**
 * Two MODEL-LEVEL PROXIES over the tenant's tickets for one machine model —
 * not per-fix metrics, which is why the UI labels them as averages:
 *   meanResolutionTimeHours: mean (resolved_at - created_at) over tickets that
 *     have BOTH timestamps; null when none do.
 *   fixSuccessRate: share of ALL the model's tickets that are closed. The
 *     denominator is deliberately every ticket, not just the timed ones — an
 *     unresolved ticket has no resolved_at, so restricting it would score a
 *     model that never resolves anything at 100%.
 */
export function computeModelProxies(rows: ProxyTicketRow[]): ModelProxies {
  if (rows.length === 0) return { meanResolutionTimeHours: null, fixSuccessRate: null };

  let durationSum = 0;
  let durationCount = 0;
  let closedCount = 0;

  for (const r of rows) {
    if (r.status && (CLOSED_STATUSES as readonly string[]).includes(r.status)) closedCount++;
    if (r.created_at && r.resolved_at) {
      const created = new Date(r.created_at).getTime();
      const resolved = new Date(r.resolved_at).getTime();
      if (Number.isFinite(created) && Number.isFinite(resolved)) {
        const hrs = (resolved - created) / 3_600_000;
        // Negative durations are dropped, not clamped: a resolved_at before
        // created_at is bad data, and folding it in as 0 would drag the mean down.
        if (hrs >= 0) {
          durationSum += hrs;
          durationCount++;
        }
      }
    }
  }

  return {
    meanResolutionTimeHours:
      durationCount > 0 ? Math.round((durationSum / durationCount) * 10) / 10 : null,
    fixSuccessRate: Math.round((closedCount / rows.length) * 100) / 100,
  };
}

export interface SearchInput {
  query: string;
  machine_model?: string;
  error_code?: string;
  limit: number;
}

/**
 * Validate the search body. Mirrors the Express Zod schema: query required and
 * non-empty, optional non-empty model/code, limit an integer in [1,50]
 * defaulting to 10.
 */
export function parseSearchInput(
  body: Record<string, unknown>,
): { ok: true; value: SearchInput } | { ok: false; message: string } {
  const query = body.query;
  if (typeof query !== 'string' || query.length < 1) {
    return { ok: false, message: 'query is required' };
  }

  const optionalString = (key: string): string | undefined | null => {
    const raw = body[key];
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw !== 'string' || raw.length < 1) return null;
    return raw;
  };

  const machineModel = optionalString('machine_model');
  if (machineModel === null)
    return { ok: false, message: 'machine_model must be a non-empty string' };
  const errorCode = optionalString('error_code');
  if (errorCode === null) return { ok: false, message: 'error_code must be a non-empty string' };

  let limit = 10;
  if (body.limit !== undefined && body.limit !== null) {
    if (typeof body.limit !== 'number' || !Number.isInteger(body.limit)) {
      return { ok: false, message: 'limit must be an integer' };
    }
    if (body.limit < 1 || body.limit > 50) {
      return { ok: false, message: 'limit must be between 1 and 50' };
    }
    limit = body.limit;
  }

  return {
    ok: true,
    value: {
      query,
      ...(machineModel ? { machine_model: machineModel } : {}),
      ...(errorCode ? { error_code: errorCode } : {}),
      limit,
    },
  };
}

/** Model and error code are appended so they bias the query embedding. */
export function buildQueryText(input: SearchInput): string {
  return [input.query, input.machine_model, input.error_code].filter(Boolean).join(' ');
}

/** The backfill batch size: ?limit clamped to [1,2000], default 200. */
export function parseBackfillLimit(raw: string | null): number {
  if (raw === null) return 200;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 200;
  return Math.max(1, Math.min(2000, parsed));
}

export interface SettingsResponse {
  tenantId: string;
  federatedOptIn: boolean;
  consentedAt: string | null;
  consentedByUserId: string | null;
  updatedAt: string | null;
}

/**
 * Shape the settings row for the client. federated_opt_in is a jsonb blob, so
 * its inner keys are data and are read as-is, never key-converted.
 *
 * `enabled === true` rather than a truthy check: this gates a CROSS-TENANT data
 * pool, so anything other than a literal true stays opted out.
 */
export function shapeSettings(
  tenantId: string,
  row: { federated_opt_in?: unknown; updated_at?: unknown } | null | undefined,
): SettingsResponse {
  const opt = (row?.federated_opt_in ?? {}) as Record<string, unknown>;
  return {
    tenantId,
    federatedOptIn: opt.enabled === true,
    consentedAt: (opt.consentedAt as string) ?? null,
    consentedByUserId: (opt.consentedByUserId as string) ?? null,
    updatedAt: (row?.updated_at as string) ?? null,
  };
}
