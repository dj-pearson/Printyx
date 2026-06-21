/**
 * Tech Knowledge Graph — RAG over historical service tickets (US-SUPER-006).
 *
 * A field tech searches "E-225 on iR-ADV C5560" and gets the top historical
 * fixes for that symptom on that model — the proprietary failure-and-fix data
 * that is Printyx's competitive moat.
 *
 * Pipeline:
 *   1. Closed tickets (status completed/closed/resolved) are embedded into a
 *      sidecar table (service_ticket_embeddings) via a named adapter
 *      (OpenAI text-embedding-3-small) with a deterministic OFFLINE fallback.
 *   2. A search embeds the query and ranks the tenant's embeddings by cosine
 *      similarity (jsonb float array + JS cosine in v1 — no pgvector dependency).
 *   3. Each hit is joined back to its ticket to surface summary, parts swapped,
 *      and two model-level proxies (mean resolution time + fix success rate).
 *
 * Endpoints:
 *   POST /api/service/knowledge-search            — RAG search (top-N fixes)
 *   POST /api/service/knowledge-search/backfill   — embed last 24mo closed tickets (cron)
 *   POST /api/service/knowledge-search/embed/:ticketId — embed one ticket on demand
 *   GET  /api/service/knowledge-search/stats      — coverage indicator
 *   GET  /api/service/knowledge-search/settings   — federation opt-in (v2)
 *   PUT  /api/service/knowledge-search/settings
 *
 * Schema lives in shared/service-knowledge-schema.ts (re-exported from
 * shared/schema.ts).
 *
 * Auth: requireAuth + tenant scoping on every query. v1 is SINGLE-TENANT —
 * never query across tenants.
 *
 * Documented STUBs / TODOs:
 *   - embedText(): real OpenAI call when OPENAI_API_KEY is set (plain fetch, no
 *     SDK); otherwise a deterministic local hash pseudo-embedding so the pipeline
 *     is exercisable offline. source is only 'openai' on a clean parse.
 *   - v1 ranks via jsonb embedding + JS cosine. The backfill migration also adds
 *     a pgvector vector(1536) column + ivfflat index for the production path;
 *     wiring the SQL similarity query is a TODO once embeddings are dense.
 *   - meanResolutionTimeHours + fixSuccessRate are MODEL-LEVEL PROXIES (averaged
 *     across same-model tickets for the tenant), not per-fix metrics — documented
 *     inline at the call site.
 *   - Incremental re-embed on ticket close is a TODO (DB trigger/webhook); v1
 *     re-embeds via the cron backfill + the on-demand embed endpoint.
 *   - Federated cross-tenant pool is v2 and requires PII redaction + explicit
 *     opt-in; v1 stays single-tenant.
 *   - TODO(rbac): requirePermission(['service.knowledge.search']) once it exists.
 *     Mirrors the meter-read-vision / churn-risk exemplars (requireAuth + tenant
 *     scoping until the permission string is added to the RBAC matrix).
 */

import { createHash } from 'crypto';
import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, ilike, inArray } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import {
  serviceTicketEmbeddings,
  serviceKnowledgeSettings,
  serviceTickets,
  equipment,
  EMBEDDING_DIMS,
} from '@shared/schema';

const log = createModuleLogger('routes-service-knowledge');

/** Closed-ticket statuses that are eligible for embedding / proxies. */
const CLOSED_STATUSES = ['completed', 'closed', 'resolved'] as const;

const TWENTY_FOUR_MONTHS_MS = 730 * 86_400_000;
const SUMMARY_MAX = 280;

// ---------------------------------------------------------------------------
// Embedding adapter — OpenAI text-embedding-3-small (fetch), offline fallback
// ---------------------------------------------------------------------------

/**
 * Embed arbitrary text into a fixed-length vector.
 *
 * When OPENAI_API_KEY is set, calls text-embedding-3-small via a plain fetch
 * POST (no SDK dependency) and returns source 'openai'. On ANY failure (no key,
 * network error, bad shape) it falls back to a deterministic local
 * pseudo-embedding: each whitespace token is hashed into one of EMBEDDING_DIMS
 * buckets and the resulting histogram is L2-normalized, so cosine similarity is
 * meaningful offline. source is 'fallback' in that case.
 */
export async function embedText(
  text: string,
): Promise<{ embedding: number[]; source: 'openai' | 'fallback' }> {
  const input = (text ?? '').slice(0, 8000);
  try {
    if (process.env.OPENAI_API_KEY) {
      const resp = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input }),
      });
      if (resp.ok) {
        const json = (await resp.json()) as { data?: Array<{ embedding?: number[] }> };
        const vec = json.data?.[0]?.embedding;
        if (Array.isArray(vec) && vec.length > 0 && vec.every((n) => Number.isFinite(n))) {
          return { embedding: vec, source: 'openai' };
        }
      } else {
        log.warn(`OpenAI embeddings returned ${resp.status}; using fallback`);
      }
    }
  } catch (err) {
    log.warn('OpenAI embedding failed; using deterministic fallback (offline-safe):', err as any);
  }
  return { embedding: fallbackEmbedding(input), source: 'fallback' };
}

/** Deterministic, dependency-free hash embedding (L2-normalized histogram). */
function fallbackEmbedding(text: string): number[] {
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

/** 32-bit string hash (deterministic across runs). */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
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
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

type TicketRow = typeof serviceTickets.$inferSelect;

/** Build the text we embed for a ticket: resolution + parts + model + codes/title. */
function buildTicketContent(ticket: TicketRow, machineModel: string | null): string {
  const parts = Array.isArray(ticket.partsUsed) ? ticket.partsUsed.join(' ') : '';
  const codes = extractErrorCodes(ticket);
  return [ticket.resolutionNotes ?? '', parts, machineModel ?? '', codes, ticket.title ?? '']
    .filter(Boolean)
    .join('\n')
    .slice(0, 8000);
}

/** Best-effort error-code extraction from title/description (e.g. "E000-0001", "C2557"). */
function extractErrorCodes(ticket: TicketRow): string {
  const hay = `${ticket.title ?? ''} ${ticket.description ?? ''}`;
  const matches = hay.match(/\b[A-Z]{1,3}-?\d{2,5}(?:-\d{2,5})?\b/g);
  return matches ? Array.from(new Set(matches)).join(' ') : '';
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function audit(
  action: 'SEARCH' | 'BACKFILL' | 'EMBED_ONE' | 'UPDATE_SETTINGS',
  ctx: { tenantId: string; userId: string | undefined; extra?: unknown },
) {
  log.info(
    {
      audit: true,
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'system',
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    },
    '[AUDIT] service-knowledge',
  );
}

async function getOrCreateSettings(tenantId: string) {
  const existing = await db.query.serviceKnowledgeSettings.findFirst({
    where: eq(serviceKnowledgeSettings.tenantId, tenantId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(serviceKnowledgeSettings)
    .values({ tenantId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.serviceKnowledgeSettings.findFirst({
    where: eq(serviceKnowledgeSettings.tenantId, tenantId),
  });
}

/** Map equipmentId -> modelNumber for the given ids (tenant-scoped). */
async function resolveMachineModels(
  tenantId: string,
  equipmentIds: string[],
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(equipmentIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: equipment.id, modelNumber: equipment.modelNumber })
    .from(equipment)
    .where(and(eq(equipment.tenantId, tenantId), inArray(equipment.id, ids)));
  return new Map(rows.map((r) => [r.id, r.modelNumber ?? null]));
}

/** Embed (or re-embed) one ticket; UPSERT on (tenantId, ticketId). */
async function embedTicket(
  tenantId: string,
  ticket: TicketRow,
  modelMap?: Map<string, string | null>,
): Promise<'embedded' | 'skipped'> {
  let machineModel: string | null = null;
  if (ticket.equipmentId) {
    if (modelMap) {
      machineModel = modelMap.get(ticket.equipmentId) ?? null;
    } else {
      const map = await resolveMachineModels(tenantId, [ticket.equipmentId]);
      machineModel = map.get(ticket.equipmentId) ?? null;
    }
  }

  const content = buildTicketContent(ticket, machineModel);
  const contentHash = sha256(content);

  // Skip if an identical content hash already exists (no re-embed needed).
  const existing = await db.query.serviceTicketEmbeddings.findFirst({
    where: and(
      eq(serviceTicketEmbeddings.tenantId, tenantId),
      eq(serviceTicketEmbeddings.ticketId, ticket.id),
    ),
    columns: { contentHash: true },
  });
  if (existing && existing.contentHash === contentHash) return 'skipped';

  const { embedding, source } = await embedText(content);
  const errorCodes = extractErrorCodes(ticket).slice(0, 500) || null;

  await db
    .insert(serviceTicketEmbeddings)
    .values({
      tenantId,
      ticketId: ticket.id,
      machineModel,
      errorCodes,
      content: content.slice(0, 8000),
      contentHash,
      embedding,
      embeddingSource: source,
      embeddedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [serviceTicketEmbeddings.tenantId, serviceTicketEmbeddings.ticketId],
      set: {
        machineModel,
        errorCodes,
        content: content.slice(0, 8000),
        contentHash,
        embedding,
        embeddingSource: source,
        embeddedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  return 'embedded';
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const searchSchema = z.object({
  query: z.string().min(1),
  machine_model: z.string().min(1).optional(),
  error_code: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const settingsSchema = z.object({
  federatedOptIn: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerServiceKnowledgeRoutes(app: Express) {
  /**
   * POST /api/service/knowledge-search
   * Embed the query, rank this tenant's ticket embeddings by cosine similarity,
   * and join the top-N back to their tickets for the field-tech view.
   */
  app.post('/api/service/knowledge-search', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = searchSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      const { query, machine_model, error_code } = parsed.data;
      const limit = parsed.data.limit ?? 10;

      // Append the model + error code so they bias the query embedding.
      const queryText = [query, machine_model, error_code].filter(Boolean).join(' ');
      const { embedding: queryEmbedding, source: embeddingSource } = await embedText(queryText);

      // Load this tenant's embeddings (optionally pre-filtered by model).
      const conditions = [eq(serviceTicketEmbeddings.tenantId, tenantId)];
      if (machine_model) {
        conditions.push(ilike(serviceTicketEmbeddings.machineModel, `%${machine_model}%`));
      }
      const embRows = await db
        .select({
          ticketId: serviceTicketEmbeddings.ticketId,
          machineModel: serviceTicketEmbeddings.machineModel,
          embedding: serviceTicketEmbeddings.embedding,
        })
        .from(serviceTicketEmbeddings)
        .where(and(...conditions));

      // Score by cosine similarity; skip rows with no/empty embedding vector.
      // TODO(prod): replace this JS-cosine scan with a pgvector ivfflat ORDER BY
      // <-> on the vector(1536) column added in the backfill migration.
      const scored = embRows
        .map((r) => {
          const vec = Array.isArray(r.embedding) ? (r.embedding as unknown as number[]) : null;
          if (!vec || vec.length === 0) return null;
          return {
            ticketId: r.ticketId,
            machineModel: r.machineModel,
            score: cosineSimilarity(queryEmbedding, vec),
          };
        })
        .filter((x): x is { ticketId: string; machineModel: string | null; score: number } => !!x)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      if (scored.length === 0) {
        audit('SEARCH', { tenantId, userId, extra: { query: queryText, results: 0 } });
        return res.json({ results: [], total: 0, embeddingSource });
      }

      // Join back to the tickets (tenant-scoped) for display fields.
      const ticketIds = scored.map((s) => s.ticketId);
      const ticketRows = await db
        .select()
        .from(serviceTickets)
        .where(and(eq(serviceTickets.tenantId, tenantId), inArray(serviceTickets.id, ticketIds)));
      const ticketMap = new Map(ticketRows.map((t) => [t.id, t]));

      // Per-model proxies: mean resolution time + fix-success rate across all
      // same-model tickets for this tenant. These are TENANT/MODEL-LEVEL PROXIES
      // (not per-fix metrics) — documented for the UI. Computed once per distinct
      // model in the result set.
      const distinctModels = Array.from(
        new Set(scored.map((s) => s.machineModel).filter((m): m is string => !!m)),
      );
      const modelProxies = new Map<
        string,
        { meanResolutionTimeHours: number | null; fixSuccessRate: number | null }
      >();
      for (const model of distinctModels) {
        modelProxies.set(model, await computeModelProxies(tenantId, model));
      }

      const results = scored.map((s) => {
        const t = ticketMap.get(s.ticketId);
        const proxies = s.machineModel
          ? modelProxies.get(s.machineModel)
          : { meanResolutionTimeHours: null, fixSuccessRate: null };
        return {
          ticketId: s.ticketId,
          ticketNumber: t?.ticketNumber ?? null,
          machineModel: s.machineModel,
          relevanceScore: Math.round(Math.max(0, Math.min(1, s.score)) * 1000) / 1000,
          summary: truncate(t?.resolutionNotes || t?.title || '', SUMMARY_MAX),
          partsSwapped: Array.isArray(t?.partsUsed) ? t!.partsUsed! : [],
          meanResolutionTimeHours: proxies?.meanResolutionTimeHours ?? null,
          fixSuccessRate: proxies?.fixSuccessRate ?? null,
        };
      });

      audit('SEARCH', {
        tenantId,
        userId,
        extra: { query: queryText, results: results.length, embeddingSource },
      });
      res.json({ results, total: results.length, embeddingSource });
    } catch (error: any) {
      log.error('Knowledge search failed:', error);
      res.status(500).json({ message: 'Failed to run knowledge search', error: error?.message });
    }
  });

  /**
   * POST /api/service/knowledge-search/backfill?limit=200
   * Embed the last 24 months of CLOSED tickets that are missing an embedding or
   * whose content hash changed. Cron-callable. The batch is capped by ?limit so
   * a single call is bounded.
   * TODO: incremental re-embed via DB trigger/webhook on ticket close.
   */
  app.post(
    '/api/service/knowledge-search/backfill',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 200;
        const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(2000, rawLimit)) : 200;

        const since = new Date(Date.now() - TWENTY_FOUR_MONTHS_MS);
        const tickets = await db
          .select()
          .from(serviceTickets)
          .where(
            and(
              eq(serviceTickets.tenantId, tenantId),
              inArray(serviceTickets.status, CLOSED_STATUSES as unknown as string[]),
              gte(serviceTickets.createdAt, since),
            ),
          )
          .orderBy(desc(serviceTickets.createdAt))
          .limit(limit);

        const scanned = tickets.length;
        const modelMap = await resolveMachineModels(
          tenantId,
          tickets.map((t) => t.equipmentId).filter((id): id is string => !!id),
        );

        let embedded = 0;
        let skipped = 0;
        for (const ticket of tickets) {
          const outcome = await embedTicket(tenantId, ticket, modelMap);
          if (outcome === 'embedded') embedded++;
          else skipped++;
        }

        audit('BACKFILL', { tenantId, userId, extra: { scanned, embedded, skipped, limit } });
        res.json({ embedded, skipped, scanned });
      } catch (error: any) {
        log.error('Knowledge backfill failed:', error);
        res.status(500).json({ message: 'Failed to backfill embeddings', error: error?.message });
      }
    },
  );

  /**
   * POST /api/service/knowledge-search/embed/:ticketId
   * Embed a single ticket on demand (same UPSERT as the backfill).
   */
  app.post(
    '/api/service/knowledge-search/embed/:ticketId',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const ticket = await db.query.serviceTickets.findFirst({
          where: and(
            eq(serviceTickets.id, req.params.ticketId),
            eq(serviceTickets.tenantId, tenantId),
          ),
        });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const outcome = await embedTicket(tenantId, ticket);
        audit('EMBED_ONE', { tenantId, userId, extra: { ticketId: ticket.id, outcome } });
        res.json({ ticketId: ticket.id, outcome });
      } catch (error: any) {
        log.error('Single-ticket embed failed:', error);
        res.status(500).json({ message: 'Failed to embed ticket', error: error?.message });
      }
    },
  );

  /**
   * GET /api/service/knowledge-search/stats
   * Coverage indicator: how many tickets are indexed vs. closed.
   */
  app.get(
    '/api/service/knowledge-search/stats',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const embeddings = await db
          .select({ embeddedAt: serviceTicketEmbeddings.embeddedAt })
          .from(serviceTicketEmbeddings)
          .where(eq(serviceTicketEmbeddings.tenantId, tenantId));

        const closed = await db
          .select({ id: serviceTickets.id })
          .from(serviceTickets)
          .where(
            and(
              eq(serviceTickets.tenantId, tenantId),
              inArray(serviceTickets.status, CLOSED_STATUSES as unknown as string[]),
            ),
          );

        let lastEmbeddedAt: Date | null = null;
        for (const e of embeddings) {
          if (e.embeddedAt && (!lastEmbeddedAt || e.embeddedAt > lastEmbeddedAt)) {
            lastEmbeddedAt = e.embeddedAt;
          }
        }

        res.json({
          embeddedCount: embeddings.length,
          lastEmbeddedAt,
          totalClosedTickets: closed.length,
        });
      } catch (error: any) {
        log.error('Knowledge stats failed:', error);
        res.status(500).json({ message: 'Failed to load stats', error: error?.message });
      }
    },
  );

  /**
   * GET /api/service/knowledge-search/settings — federation opt-in (v2 flag).
   */
  app.get(
    '/api/service/knowledge-search/settings',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
        const settings = await getOrCreateSettings(tenantId);
        if (!settings) return res.status(500).json({ message: 'Failed to load settings' });
        const opt = (settings.federatedOptIn ?? {}) as Record<string, unknown>;
        res.json({
          tenantId: settings.tenantId,
          federatedOptIn: opt.enabled === true,
          consentedAt: opt.consentedAt ?? null,
          consentedByUserId: opt.consentedByUserId ?? null,
          updatedAt: settings.updatedAt,
        });
      } catch (error: any) {
        log.error('Failed to load knowledge settings:', error);
        res.status(500).json({ message: 'Failed to load settings', error: error?.message });
      }
    },
  );

  /**
   * PUT /api/service/knowledge-search/settings
   * Toggle the federated cross-tenant opt-in.
   * TODO(v2): federated cross-tenant pool requires PII redaction (customer
   * name/address/contact) + this explicit opt-in; v1 is single-tenant only.
   */
  app.put(
    '/api/service/knowledge-search/settings',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const parsed = settingsSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }

        await getOrCreateSettings(tenantId);

        const updates: Record<string, unknown> = {
          updatedByUserId: userId,
          updatedAt: new Date(),
        };
        if (parsed.data.federatedOptIn !== undefined) {
          updates.federatedOptIn = {
            enabled: parsed.data.federatedOptIn,
            consentedAt: new Date().toISOString(),
            consentedByUserId: userId ?? null,
          };
        }

        const [updated] = await db
          .update(serviceKnowledgeSettings)
          .set(updates)
          .where(eq(serviceKnowledgeSettings.tenantId, tenantId))
          .returning();

        audit('UPDATE_SETTINGS', {
          tenantId,
          userId,
          extra: { federatedOptIn: parsed.data.federatedOptIn },
        });

        const opt = (updated?.federatedOptIn ?? {}) as Record<string, unknown>;
        res.json({
          tenantId,
          federatedOptIn: opt.enabled === true,
          consentedAt: opt.consentedAt ?? null,
          consentedByUserId: opt.consentedByUserId ?? null,
          updatedAt: updated?.updatedAt ?? null,
        });
      } catch (error: any) {
        log.error('Failed to update knowledge settings:', error);
        res.status(500).json({ message: 'Failed to update settings', error: error?.message });
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Model-level proxies (documented approximations)
// ---------------------------------------------------------------------------

/**
 * Compute two model-level PROXIES across all of this tenant's tickets whose
 * machine resolves to `model`:
 *   - meanResolutionTimeHours: avg (resolvedAt - createdAt) in hours over tickets
 *     that have both timestamps. A tenant/model proxy, not a per-fix metric.
 *   - fixSuccessRate: share of those tickets whose status is completed/closed/
 *     resolved. A proxy for "this kind of fix tends to resolve the issue".
 *
 * Joined through equipment.modelNumber since service_tickets has no model column.
 */
async function computeModelProxies(
  tenantId: string,
  model: string,
): Promise<{ meanResolutionTimeHours: number | null; fixSuccessRate: number | null }> {
  const rows = await db
    .select({
      status: serviceTickets.status,
      createdAt: serviceTickets.createdAt,
      resolvedAt: serviceTickets.resolvedAt,
    })
    .from(serviceTickets)
    .innerJoin(
      equipment,
      and(
        eq(equipment.id, serviceTickets.equipmentId),
        eq(equipment.tenantId, tenantId),
        eq(equipment.modelNumber, model),
      ),
    )
    .where(eq(serviceTickets.tenantId, tenantId));

  if (rows.length === 0) {
    return { meanResolutionTimeHours: null, fixSuccessRate: null };
  }

  let durationSum = 0;
  let durationCount = 0;
  let closedCount = 0;
  for (const r of rows) {
    if (r.status && (CLOSED_STATUSES as unknown as string[]).includes(r.status)) closedCount++;
    if (r.createdAt && r.resolvedAt) {
      const hrs = (r.resolvedAt.getTime() - r.createdAt.getTime()) / 3_600_000;
      if (hrs >= 0) {
        durationSum += hrs;
        durationCount++;
      }
    }
  }

  return {
    meanResolutionTimeHours:
      durationCount > 0 ? Math.round((durationSum / durationCount) * 10) / 10 : null,
    fixSuccessRate: Math.round((closedCount / rows.length) * 100) / 100,
  };
}
