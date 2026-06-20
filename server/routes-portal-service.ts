/**
 * Customer Portal — NL Service-Request Classification + Dispatch (US-SUPER-011).
 *
 * The customer self-service portal scaffolding already exists
 * (shared/customer-portal-schema.ts). This is the net-new AI layer: a customer
 * describes the problem in plain English and we (1) classify it (Claude, with a
 * deterministic keyword fallback when no model/key is available), (2) recommend
 * priority + parts + a matched service playbook, and (3) best-effort dispatch by
 * spinning up an INTERNAL service_tickets row and moving the portal request to
 * 'assigned'. The portal then shows an Uber-style status timeline + a post-
 * resolution rating widget.
 *
 * Endpoints:
 *   POST /api/portal-service/classify                 — classify text [+ dispatch]
 *   GET  /api/portal-service/classifications/:requestId — latest classification
 *   POST /api/portal-service/rate                      — customer rating/feedback
 *   GET  /api/portal-service/timeline/:requestId       — Uber-style 5-step timeline
 *
 * Auth: requireAuth + resolveTenant + tenant scoping on every query.
 * The dispatch writes are wrapped so a missing-table/type error degrades to a
 * clear `dispatch: 'skipped'` (HTTP 200) — the classification ALWAYS returns.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import ClaudeAIService from './services/claude-ai-service';
import {
  portalServiceClassifications,
  customerServiceRequests,
  customerServiceRequestStatusHistory,
  serviceTickets,
} from '@shared/schema';

const log = createModuleLogger('routes-portal-service');

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

function audit(
  action: 'CLASSIFY' | 'DISPATCH' | 'RATE',
  ctx: { tenantId: string; userId: string | undefined; extra?: unknown },
) {
  log.info(
    {
      audit: true,
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'portal',
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    },
    '[AUDIT] portal-service',
  );
}

// ---------------------------------------------------------------------------
// Classification types
// ---------------------------------------------------------------------------

type SuggestedPriority = 'low' | 'medium' | 'high' | 'urgent';

interface RecommendedPart {
  partNumber: string;
  name: string;
  reason: string;
}

interface Playbook {
  key: string;
  title: string;
  steps: string[];
}

interface Classification {
  category: string;
  suggestedPriority: SuggestedPriority;
  recommendedParts: RecommendedPart[];
  playbook: Playbook;
  confidence: number;
  source: 'ai' | 'fallback';
}

const PRIORITIES: SuggestedPriority[] = ['low', 'medium', 'high', 'urgent'];

// ---------------------------------------------------------------------------
// Deterministic keyword fallback
// ---------------------------------------------------------------------------

interface FallbackRule {
  category: string;
  priority: SuggestedPriority;
  match: RegExp;
  playbook: Playbook;
  parts: RecommendedPart[];
}

const FALLBACK_RULES: FallbackRule[] = [
  {
    category: 'mechanical_noise',
    priority: 'high',
    match: /grind|grinding|noise|rattl|clunk|squeal/i,
    playbook: {
      key: 'mechanical_noise',
      title: 'Mechanical noise / grinding',
      steps: [
        'Power the device off and inspect for visible debris or loose paper fragments.',
        'Check the fuser and drive gears for wear.',
        'Dispatch a technician — grinding usually indicates a failing gear or roller.',
      ],
    },
    parts: [
      {
        partNumber: 'GEAR-DRV-01',
        name: 'Main drive gear',
        reason: 'Common source of grinding noise.',
      },
      {
        partNumber: 'ROLL-FUS-02',
        name: 'Fuser roller',
        reason: 'Worn rollers cause rattling under load.',
      },
    ],
  },
  {
    category: 'paper_jam',
    priority: 'medium',
    match: /jam|stuck|paper/i,
    playbook: {
      key: 'paper_jam',
      title: 'Recurring paper jam',
      steps: [
        'Open all trays and clear any jammed sheets along the paper path.',
        'Verify paper type and tray guides match the loaded media.',
        'If jams recur, replace the pickup/feed rollers.',
      ],
    },
    parts: [
      {
        partNumber: 'ROLL-PICK-01',
        name: 'Pickup roller kit',
        reason: 'Worn pickup rollers misfeed paper.',
      },
      { partNumber: 'SEP-PAD-01', name: 'Separation pad', reason: 'Prevents multi-sheet pulls.' },
    ],
  },
  {
    category: 'print_quality',
    priority: 'medium',
    match: /streak|line|smear|faded|quality|spot|ghost|blurry/i,
    playbook: {
      key: 'print_quality',
      title: 'Print quality defect',
      steps: [
        'Run the built-in cleaning / calibration cycle.',
        'Inspect the drum unit and imaging components for scratches.',
        'Replace the drum or transfer belt if defects persist.',
      ],
    },
    parts: [
      {
        partNumber: 'DRUM-IMG-01',
        name: 'Imaging drum unit',
        reason: 'Streaks/lines trace to a worn drum.',
      },
      {
        partNumber: 'BELT-TRN-01',
        name: 'Transfer belt',
        reason: 'Smearing/ghosting comes from the belt.',
      },
    ],
  },
  {
    category: 'supplies',
    priority: 'low',
    match: /toner|ink|supply|supplies|empty|cartridge|low/i,
    playbook: {
      key: 'supplies',
      title: 'Supplies / consumables',
      steps: [
        'Confirm which consumable is depleted from the device panel.',
        'Ship or schedule the matching toner/ink cartridge.',
        'No on-site visit required unless install assistance is requested.',
      ],
    },
    parts: [
      {
        partNumber: 'TONER-BLK-01',
        name: 'Black toner cartridge',
        reason: 'Most common depleted supply.',
      },
    ],
  },
  {
    category: 'connectivity',
    priority: 'high',
    match: /error code|offline|network|connect|connection|ip address|scan to|wifi|wi-fi/i,
    playbook: {
      key: 'connectivity',
      title: 'Connectivity / offline',
      steps: [
        'Verify the device shows a valid IP address and the cable/Wi-Fi link is up.',
        'Power-cycle the device and the network switch port.',
        'Re-add the print queue / check firewall rules if it stays offline.',
      ],
    },
    parts: [
      {
        partNumber: 'NIC-ETH-01',
        name: 'Network interface card',
        reason: 'Persistent offline can be a failed NIC.',
      },
    ],
  },
];

const GENERAL_PLAYBOOK: Playbook = {
  key: 'general',
  title: 'General service request',
  steps: [
    'Capture the full problem description and any error messages.',
    'Triage with the customer to confirm severity and impact.',
    'Dispatch a technician for on-site diagnosis.',
  ],
};

function fallbackClassify(text: string): Classification {
  for (const rule of FALLBACK_RULES) {
    if (rule.match.test(text)) {
      return {
        category: rule.category,
        suggestedPriority: rule.priority,
        recommendedParts: rule.parts,
        playbook: rule.playbook,
        confidence: 0.4,
        source: 'fallback',
      };
    }
  }
  return {
    category: 'general',
    suggestedPriority: 'medium',
    recommendedParts: [],
    playbook: GENERAL_PLAYBOOK,
    confidence: 0.3,
    source: 'fallback',
  };
}

// ---------------------------------------------------------------------------
// AI classification (with deterministic fallback)
// ---------------------------------------------------------------------------

function coercePriority(v: unknown): SuggestedPriority {
  const s = String(v ?? '').toLowerCase();
  return (PRIORITIES as string[]).includes(s) ? (s as SuggestedPriority) : 'medium';
}

function coerceParts(v: unknown): RecommendedPart[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p) => p && typeof p === 'object')
    .map((p: any) => ({
      partNumber: String(p.partNumber ?? p.part_number ?? ''),
      name: String(p.name ?? ''),
      reason: String(p.reason ?? ''),
    }))
    .filter((p) => p.name || p.partNumber)
    .slice(0, 5);
}

function coercePlaybook(v: unknown, fallback: Playbook): Playbook {
  if (!v || typeof v !== 'object') return fallback;
  const p = v as any;
  const steps = Array.isArray(p.steps)
    ? p.steps.map((s: unknown) => String(s)).filter(Boolean)
    : [];
  return {
    key: String(p.key ?? fallback.key),
    title: String(p.title ?? fallback.title),
    steps: steps.length > 0 ? steps : fallback.steps,
  };
}

async function classify(text: string): Promise<Classification> {
  const fallback = fallbackClassify(text);
  try {
    const prompt =
      `You are a copier/MFP service dispatcher. A customer described a problem with their ` +
      `machine in plain English. Classify it and recommend a dispatch.\n\n` +
      `Customer text: """${text}"""\n\n` +
      `Return ONLY JSON (no prose) with this exact shape:\n` +
      `{\n` +
      `  "category": string (snake_case, e.g. "paper_jam" | "print_quality" | "mechanical_noise" | "supplies" | "connectivity" | "general"),\n` +
      `  "suggestedPriority": one of "low" | "medium" | "high" | "urgent",\n` +
      `  "recommendedParts": [{ "partNumber": string, "name": string, "reason": string }],\n` +
      `  "playbook": { "key": string, "title": string, "steps": string[] },\n` +
      `  "confidence": number between 0 and 1\n` +
      `}`;

    const out = await ClaudeAIService.generateCompletion({
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const match = out.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const category =
        typeof parsed.category === 'string' && parsed.category.trim()
          ? parsed.category.trim()
          : fallback.category;
      const conf = Number(parsed.confidence);
      return {
        category,
        suggestedPriority: coercePriority(parsed.suggestedPriority),
        recommendedParts: coerceParts(parsed.recommendedParts),
        playbook: coercePlaybook(parsed.playbook, fallback.playbook),
        confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.7,
        source: 'ai',
      };
    }
    return fallback;
  } catch (error: any) {
    log.warn(
      { err: error?.message },
      'AI classification unavailable; using deterministic fallback',
    );
    return fallback;
  }
}

/** Map the classifier's priority onto the serviceRequestPriorityEnum. */
function toRequestPriority(p: SuggestedPriority): 'low' | 'normal' | 'high' | 'urgent' {
  switch (p) {
    case 'high':
      return 'high';
    case 'urgent':
      return 'urgent';
    case 'low':
      return 'low';
    case 'medium':
    default:
      return 'normal';
  }
}

function isMissingTableOrTypeError(err: any): boolean {
  const code = err?.code;
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    code === '42P01' || // undefined_table
    code === '42703' || // undefined_column
    code === '42704' || // undefined_object (e.g. enum)
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('invalid input value for enum')
  );
}

// ---------------------------------------------------------------------------
// Uber-style timeline mapping
// ---------------------------------------------------------------------------

type StepStatus = 'done' | 'current' | 'pending';

const TIMELINE_STEPS: Array<{ key: string; label: string }> = [
  { key: 'queued', label: 'Queued' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'en_route', label: 'En route' },
  { key: 'on_site', label: 'On site' },
  { key: 'resolved', label: 'Resolved' },
];

/** Index into TIMELINE_STEPS that the request's current status maps to (-1 = none/cancelled). */
function statusToStepIndex(status: string | null | undefined): number {
  switch (status) {
    case 'submitted':
    case 'acknowledged':
    case 'on_hold':
      return 0; // queued
    case 'assigned':
      return 1; // dispatched
    case 'in_progress':
      return 3; // en_route + on_site (treat as on_site = furthest reached)
    case 'completed':
      return 4; // resolved
    case 'cancelled':
      return -1;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const classifySchema = z.object({
  requestId: z.string().min(1).optional(),
  text: z.string().min(1, 'text is required'),
  equipmentId: z.string().min(1).optional(),
});

const rateSchema = z.object({
  requestId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerPortalServiceRoutes(app: Express) {
  /**
   * POST /api/portal-service/classify — classify free text and (when a
   * requestId is given) best-effort dispatch: create an internal service ticket,
   * move the request to 'assigned', and append a status-history row. The
   * classification always returns even if dispatch writes fail.
   */
  app.post('/api/portal-service/classify', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = classifySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      const { requestId, text, equipmentId } = parsed.data;

      const classification = await classify(text);

      // No requestId → classify only (no dispatch, no persistence of a ticket).
      if (!requestId) {
        try {
          await db.insert(portalServiceClassifications).values({
            tenantId,
            requestId: 'unlinked',
            serviceTicketId: null,
            rawText: text.slice(0, 2000),
            category: classification.category,
            suggestedPriority: classification.suggestedPriority,
            recommendedParts: classification.recommendedParts,
            suggestedTechId: null,
            playbook: classification.playbook,
            confidence: classification.confidence,
            source: classification.source,
          });
        } catch (err: any) {
          if (!isMissingTableOrTypeError(err)) throw err;
          log.warn({ err: err?.message }, 'classification table unavailable; returning unsaved');
        }
        audit('CLASSIFY', {
          tenantId,
          userId,
          extra: { category: classification.category, linked: false },
        });
        return res.json({ classification, serviceTicketId: null });
      }

      // Linked: load the portal request (tenant-scoped).
      const request = await db.query.customerServiceRequests.findFirst({
        where: and(
          eq(customerServiceRequests.id, requestId),
          eq(customerServiceRequests.tenantId, tenantId),
        ),
      });
      if (!request) return res.status(404).json({ message: 'Service request not found' });

      // Best-effort dispatch. ANY missing-table/type error degrades to skipped.
      let serviceTicketId: string | null = null;
      let dispatch: 'created' | 'skipped' = 'skipped';
      // Best-effort technician suggestion — no skill/availability matcher wired yet.
      const suggestedTechId: string | null = null;
      try {
        const [ticket] = await db
          .insert(serviceTickets)
          .values({
            tenantId,
            customerId: String(request.customerId),
            ticketNumber: `PORTAL-${Date.now()}`,
            title: request.title || classification.category,
            description: text,
            priority: classification.suggestedPriority,
            status: 'open',
            equipmentId: (request.equipmentId as string | null) ?? equipmentId ?? null,
            createdBy: userId ?? 'portal',
          })
          .returning({ id: serviceTickets.id });
        serviceTicketId = ticket?.id ?? null;

        const previousStatus = request.status;
        await db
          .update(customerServiceRequests)
          .set({
            priority: toRequestPriority(classification.suggestedPriority),
            ...(suggestedTechId ? { assignedTechnicianId: suggestedTechId } : {}),
            ...(serviceTicketId ? { serviceTicketId } : {}),
            status: 'assigned',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(customerServiceRequests.id, requestId),
              eq(customerServiceRequests.tenantId, tenantId),
            ),
          );

        await db.insert(customerServiceRequestStatusHistory).values({
          tenantId,
          serviceRequestId: requestId,
          previousStatus,
          newStatus: 'assigned',
          changedByType: 'system',
          changedByName: 'AI Dispatch',
          customerVisibleNotes: `Classified as ${classification.category}; tech dispatch recommended.`,
        });

        dispatch = 'created';
        audit('DISPATCH', { tenantId, userId, extra: { requestId, serviceTicketId } });
      } catch (err: any) {
        if (!isMissingTableOrTypeError(err)) throw err;
        log.warn(
          { err: err?.message, requestId },
          'dispatch tables unavailable; returning classification with dispatch skipped',
        );
      }

      // Persist the classification record (best-effort).
      try {
        await db.insert(portalServiceClassifications).values({
          tenantId,
          requestId,
          serviceTicketId,
          rawText: text.slice(0, 2000),
          category: classification.category,
          suggestedPriority: classification.suggestedPriority,
          recommendedParts: classification.recommendedParts,
          suggestedTechId,
          playbook: classification.playbook,
          confidence: classification.confidence,
          source: classification.source,
        });
      } catch (err: any) {
        if (!isMissingTableOrTypeError(err)) throw err;
        log.warn({ err: err?.message }, 'classification table unavailable; not persisted');
      }

      audit('CLASSIFY', {
        tenantId,
        userId,
        extra: { category: classification.category, linked: true },
      });
      res.json({ classification, serviceTicketId, dispatch });
    } catch (error: any) {
      log.error('Portal-service classify failed:', error);
      res.status(500).json({ message: 'Failed to classify request', error: error?.message });
    }
  });

  /**
   * GET /api/portal-service/classifications/:requestId — latest classification
   * for the request (tenant-scoped).
   */
  app.get(
    '/api/portal-service/classifications/:requestId',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const row = await db
          .select()
          .from(portalServiceClassifications)
          .where(
            and(
              eq(portalServiceClassifications.tenantId, tenantId),
              eq(portalServiceClassifications.requestId, req.params.requestId),
            ),
          )
          .orderBy(desc(portalServiceClassifications.createdAt))
          .limit(1);

        if (row.length === 0) return res.status(404).json({ message: 'No classification found' });
        res.json(row[0]);
      } catch (error: any) {
        log.error('Failed to load classification:', error);
        res.status(500).json({ message: 'Failed to load classification', error: error?.message });
      }
    },
  );

  /**
   * POST /api/portal-service/rate — record the customer's 1-5 rating + optional
   * feedback on a resolved request (tenant-scoped).
   */
  app.post('/api/portal-service/rate', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = rateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      const { requestId, rating, feedback } = parsed.data;

      const [updated] = await db
        .update(customerServiceRequests)
        .set({
          customerRating: rating,
          ...(feedback ? { customerFeedback: feedback } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customerServiceRequests.id, requestId),
            eq(customerServiceRequests.tenantId, tenantId),
          ),
        )
        .returning({ id: customerServiceRequests.id });

      if (!updated) return res.status(404).json({ message: 'Service request not found' });

      // TODO: feed customer rating into the churn-risk model (US-SUPER-009)
      audit('RATE', { tenantId, userId, extra: { requestId, rating } });
      res.json({ ok: true });
    } catch (error: any) {
      log.error('Failed to record rating:', error);
      res.status(500).json({ message: 'Failed to record rating', error: error?.message });
    }
  });

  /**
   * GET /api/portal-service/timeline/:requestId — Uber-style 5-step timeline
   * derived from the request's current status + its status history.
   */
  app.get(
    '/api/portal-service/timeline/:requestId',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const request = await db.query.customerServiceRequests.findFirst({
          where: and(
            eq(customerServiceRequests.id, req.params.requestId),
            eq(customerServiceRequests.tenantId, tenantId),
          ),
          columns: { id: true, status: true },
        });
        if (!request) return res.status(404).json({ message: 'Service request not found' });

        const history = await db
          .select()
          .from(customerServiceRequestStatusHistory)
          .where(
            and(
              eq(customerServiceRequestStatusHistory.tenantId, tenantId),
              eq(customerServiceRequestStatusHistory.serviceRequestId, req.params.requestId),
            ),
          )
          .orderBy(asc(customerServiceRequestStatusHistory.createdAt));

        const currentStatus = request.status;
        const cancelled = currentStatus === 'cancelled';
        const reachedIdx = statusToStepIndex(currentStatus);

        // First time each step's status was reached (for the `at` timestamp).
        const reachedAt: Record<number, string> = {};
        for (const h of history) {
          const idx = statusToStepIndex(h.newStatus);
          if (idx >= 0 && reachedAt[idx] == null && h.createdAt) {
            reachedAt[idx] = new Date(h.createdAt).toISOString();
          }
        }

        const steps = TIMELINE_STEPS.map((step, i) => {
          let status: StepStatus;
          if (cancelled) {
            status = 'pending';
          } else if (i < reachedIdx) {
            status = 'done';
          } else if (i === reachedIdx) {
            status = currentStatus === 'completed' ? 'done' : 'current';
          } else {
            status = 'pending';
          }
          return { key: step.key, label: step.label, status, at: reachedAt[i] ?? null };
        });

        res.json({ steps, history, currentStatus, cancelled });
      } catch (error: any) {
        log.error('Failed to load timeline:', error);
        res.status(500).json({ message: 'Failed to load timeline', error: error?.message });
      }
    },
  );
}
