/**
 * Outreach Routes
 *
 * Endpoints powering the AI-assisted outbound email/LinkedIn generator.
 * Gated by OUTREACH_ENABLED_TENANTS env flag while the feature is single-tenant.
 * To enable for additional tenants, add their tenant IDs to the env var comma-separated.
 * Leave unset to allow all tenants (use when ready to productize).
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { eq, and, desc, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../db';
import { requireAuth } from '../replitAuth';
import { getUserId, getTenantId } from '../utils/auth-helpers';
import { createModuleLogger } from '../lib/logger';

import {
  businessContexts,
  repSpecializations,
  outreachSequences,
  outreachSequenceSteps,
  outreachProspects,
  outreachDrafts,
  insertBusinessContextSchema,
  insertRepSpecializationSchema,
  insertOutreachSequenceSchema,
  insertOutreachSequenceStepSchema,
  insertOutreachProspectSchema,
  insertOutreachDraftSchema,
  OUTREACH_SPECIALTIES,
} from '@shared/outreach-schema';

import {
  generateSequence,
  generateDraft,
  lintForSpam,
} from '../services/outreach/outreach-ai-service';
import { listSpecialties, SPECIALTY_PACKS } from '../services/outreach/specialty-knowledge-packs';

const log = createModuleLogger('outreach-routes');
const router = express.Router();

// ==================== Feature Flag Gate ====================

function isOutreachEnabled(tenantId: string | undefined): boolean {
  if (!tenantId) return false;
  const enabled = process.env.OUTREACH_ENABLED_TENANTS;
  if (!enabled || !enabled.trim()) return true; // No flag set = open to all
  return enabled
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .includes(tenantId);
}

function outreachGate(req: Request, res: Response, next: NextFunction): void {
  const tenantId = getTenantId(req);
  if (!isOutreachEnabled(tenantId)) {
    res.status(403).json({
      message: 'Outreach module is not enabled for your tenant',
      code: 'OUTREACH_NOT_ENABLED',
    });
    return;
  }
  next();
}

router.use(requireAuth as any);
router.use(outreachGate);

// ==================== Specialties (Reference) ====================

router.get('/specialties', (_req, res) => {
  res.json({
    specialties: listSpecialties(),
    packs: SPECIALTY_PACKS, // Full detail so UI can preview knowledge pack
  });
});

// ==================== Business Context ====================

async function loadBusinessContext(tenantId: string, userId: string | null) {
  // Try user-specific first, fall back to tenant default (userId IS NULL)
  if (userId) {
    const userRows = await db
      .select()
      .from(businessContexts)
      .where(and(eq(businessContexts.tenantId, tenantId), eq(businessContexts.userId, userId)))
      .limit(1);
    if (userRows[0]) return userRows[0];
  }
  const tenantRows = await db
    .select()
    .from(businessContexts)
    .where(and(eq(businessContexts.tenantId, tenantId), isNull(businessContexts.userId)))
    .limit(1);
  return tenantRows[0] || null;
}

// GET effective context (user override if present, else tenant default)
router.get('/business-context', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const userId = getUserId(req) || null;
    const ctx = await loadBusinessContext(tenantId, userId);
    res.json({ context: ctx });
  } catch (err: any) {
    log.error('GET /business-context failed', err);
    res.status(500).json({ message: 'Failed to load business context' });
  }
});

// GET both tenant default + optional user override (for settings UI)
router.get('/business-context/all', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const rows = await db
      .select()
      .from(businessContexts)
      .where(eq(businessContexts.tenantId, tenantId));
    res.json({ contexts: rows });
  } catch (err: any) {
    log.error('GET /business-context/all failed', err);
    res.status(500).json({ message: 'Failed to list business contexts' });
  }
});

// PUT upsert business context (scope=tenant uses userId=null; scope=user uses current userId)
const upsertContextSchema = z.object({
  scope: z.enum(['tenant', 'user']).default('tenant'),
  data: insertBusinessContextSchema.omit({ tenantId: true, userId: true }).partial(),
});

router.put('/business-context', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const userId = getUserId(req)!;
    const parsed = upsertContextSchema.parse(req.body);
    const effectiveUserId = parsed.scope === 'user' ? userId : null;

    const existingRows = await db
      .select()
      .from(businessContexts)
      .where(
        and(
          eq(businessContexts.tenantId, tenantId),
          effectiveUserId
            ? eq(businessContexts.userId, effectiveUserId)
            : isNull(businessContexts.userId),
        ),
      )
      .limit(1);
    const existing = existingRows[0];

    if (existing) {
      const [updated] = await db
        .update(businessContexts)
        .set({ ...parsed.data, updatedAt: new Date() } as any)
        .where(eq(businessContexts.id, existing.id))
        .returning();
      return res.json({ context: updated });
    }

    const [created] = await db
      .insert(businessContexts)
      .values({
        tenantId,
        userId: effectiveUserId,
        ...parsed.data,
      } as any)
      .returning();
    res.json({ context: created });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', details: err.errors });
    }
    log.error('PUT /business-context failed', err);
    res.status(500).json({ message: 'Failed to save business context' });
  }
});

// ==================== Rep Specializations ====================

router.get('/specializations', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const userId = getUserId(req)!;
    const rows = await db
      .select()
      .from(repSpecializations)
      .where(and(eq(repSpecializations.tenantId, tenantId), eq(repSpecializations.userId, userId)))
      .orderBy(desc(repSpecializations.weight));
    res.json({ specializations: rows });
  } catch (err: any) {
    log.error('GET /specializations failed', err);
    res.status(500).json({ message: 'Failed to load specializations' });
  }
});

// Bulk replace the rep's specializations (simpler UX than individual CRUD).
const replaceSpecializationsSchema = z.object({
  specializations: z
    .array(
      z.object({
        specialty: z.enum(OUTREACH_SPECIALTIES),
        weight: z.number().min(0).max(100),
        experienceYears: z.number().int().min(0).max(60).optional(),
        personalNotes: z.string().optional(),
      }),
    )
    .max(10),
});

router.put('/specializations', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const userId = getUserId(req)!;
    const parsed = replaceSpecializationsSchema.parse(req.body);

    await db.transaction(async (tx) => {
      await tx
        .delete(repSpecializations)
        .where(
          and(eq(repSpecializations.tenantId, tenantId), eq(repSpecializations.userId, userId)),
        );
      if (parsed.specializations.length > 0) {
        await tx.insert(repSpecializations).values(
          parsed.specializations.map((s) => ({
            tenantId,
            userId,
            specialty: s.specialty,
            weight: s.weight,
            experienceYears: s.experienceYears,
            personalNotes: s.personalNotes,
          })),
        );
      }
    });

    const rows = await db
      .select()
      .from(repSpecializations)
      .where(and(eq(repSpecializations.tenantId, tenantId), eq(repSpecializations.userId, userId)))
      .orderBy(desc(repSpecializations.weight));

    res.json({ specializations: rows });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', details: err.errors });
    }
    log.error('PUT /specializations failed', err);
    res.status(500).json({ message: 'Failed to save specializations' });
  }
});

// ==================== Sequences ====================

router.get('/sequences', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const userId = getUserId(req)!;
    const rows = await db
      .select()
      .from(outreachSequences)
      .where(and(eq(outreachSequences.tenantId, tenantId), eq(outreachSequences.userId, userId)))
      .orderBy(desc(outreachSequences.updatedAt));
    res.json({ sequences: rows });
  } catch (err: any) {
    log.error('GET /sequences failed', err);
    res.status(500).json({ message: 'Failed to list sequences' });
  }
});

router.get('/sequences/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const seqRows = await db
      .select()
      .from(outreachSequences)
      .where(and(eq(outreachSequences.id, req.params.id), eq(outreachSequences.tenantId, tenantId)))
      .limit(1);
    const seq = seqRows[0];
    if (!seq) return res.status(404).json({ message: 'Sequence not found' });
    const steps = await db
      .select()
      .from(outreachSequenceSteps)
      .where(eq(outreachSequenceSteps.sequenceId, seq.id))
      .orderBy(outreachSequenceSteps.stepOrder);
    res.json({ sequence: seq, steps });
  } catch (err: any) {
    log.error('GET /sequences/:id failed', err);
    res.status(500).json({ message: 'Failed to load sequence' });
  }
});

// AI-generate + save a new sequence in one call
const generateSequenceInput = z.object({
  angle: z.string().min(3),
  name: z.string().optional(),
  includeEmail: z.boolean().default(true),
  includeLinkedin: z.boolean().default(false),
  isDreamAccountOnly: z.boolean().default(false),
  targetSpecialty: z.string().optional(),
});

router.post('/sequences/generate', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const userId = getUserId(req)!;
    const input = generateSequenceInput.parse(req.body);

    // Load rep specialties + business context
    const [specs, ctx] = await Promise.all([
      db
        .select()
        .from(repSpecializations)
        .where(
          and(eq(repSpecializations.tenantId, tenantId), eq(repSpecializations.userId, userId)),
        ),
      loadBusinessContext(tenantId, userId),
    ]);

    const specialties = input.targetSpecialty
      ? [{ specialty: input.targetSpecialty, weight: 100 }]
      : specs.map((s) => ({ specialty: s.specialty, weight: s.weight }));

    const repNotes = specs
      .map((s) => s.personalNotes)
      .filter(Boolean)
      .join('\n');

    const generated = await generateSequence({
      businessContext: ctx || null,
      specialties,
      repNotes,
      angle: input.angle,
      includeEmail: input.includeEmail,
      includeLinkedin: input.includeLinkedin,
      sequenceName: input.name,
    });

    // Persist sequence + steps
    const [savedSeq] = await db
      .insert(outreachSequences)
      .values({
        tenantId,
        userId,
        name: input.name || generated.name,
        description: generated.description,
        angle: input.angle,
        targetSpecialty: input.targetSpecialty || generated.targetSpecialty,
        includesEmail: input.includeEmail,
        includesLinkedin: input.includeLinkedin,
        isDreamAccountOnly: input.isDreamAccountOnly,
        generationContext: {
          specialtyBlend: specialties,
          businessContextId: ctx?.id,
          generatedAt: new Date().toISOString(),
        },
      })
      .returning();

    const savedSteps =
      generated.steps.length > 0
        ? await db
            .insert(outreachSequenceSteps)
            .values(
              generated.steps.map((s) => ({
                tenantId,
                sequenceId: savedSeq.id,
                stepOrder: s.stepOrder,
                channel: s.channel,
                dayOffset: s.dayOffset,
                subjectTemplate: s.subjectTemplate,
                bodyTemplate: s.bodyTemplate,
                variants: s.variants,
                spamFlags: s.spamFlags,
                notes: s.rationale,
              })),
            )
            .returning()
        : [];

    res.json({ sequence: savedSeq, steps: savedSteps });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', details: err.errors });
    }
    log.error('POST /sequences/generate failed', err);
    res.status(500).json({ message: err.message || 'Failed to generate sequence' });
  }
});

// Manual create / update of a sequence (edit after AI gen)
router.patch('/sequences/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const patch = insertOutreachSequenceSchema
      .partial()
      .omit({ tenantId: true, userId: true })
      .parse(req.body);
    const [updated] = await db
      .update(outreachSequences)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(and(eq(outreachSequences.id, req.params.id), eq(outreachSequences.tenantId, tenantId)))
      .returning();
    res.json({ sequence: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: 'Invalid input', details: err.errors });
    log.error('PATCH /sequences/:id failed', err);
    res.status(500).json({ message: 'Failed to update sequence' });
  }
});

router.patch('/sequence-steps/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const patch = insertOutreachSequenceStepSchema
      .partial()
      .omit({ tenantId: true, sequenceId: true })
      .parse(req.body);
    const [updated] = await db
      .update(outreachSequenceSteps)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(
        and(
          eq(outreachSequenceSteps.id, req.params.id),
          eq(outreachSequenceSteps.tenantId, tenantId),
        ),
      )
      .returning();
    // Re-lint after edit
    if (updated && (patch.subjectTemplate !== undefined || patch.bodyTemplate !== undefined)) {
      const flags = lintForSpam(`${updated.subjectTemplate || ''} ${updated.bodyTemplate}`);
      await db
        .update(outreachSequenceSteps)
        .set({ spamFlags: flags })
        .where(eq(outreachSequenceSteps.id, updated.id));
      updated.spamFlags = flags;
    }
    res.json({ step: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: 'Invalid input', details: err.errors });
    log.error('PATCH /sequence-steps/:id failed', err);
    res.status(500).json({ message: 'Failed to update step' });
  }
});

router.delete('/sequences/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    // Steps will be orphaned; cascade manually since no FK constraint
    const seqRows = await db
      .select()
      .from(outreachSequences)
      .where(and(eq(outreachSequences.id, req.params.id), eq(outreachSequences.tenantId, tenantId)))
      .limit(1);
    const seq = seqRows[0];
    if (!seq) return res.status(404).json({ message: 'Sequence not found' });
    await db.delete(outreachSequenceSteps).where(eq(outreachSequenceSteps.sequenceId, seq.id));
    await db.delete(outreachSequences).where(eq(outreachSequences.id, seq.id));
    res.json({ ok: true });
  } catch (err: any) {
    log.error('DELETE /sequences/:id failed', err);
    res.status(500).json({ message: 'Failed to delete sequence' });
  }
});

// ==================== Prospects (staging) ====================

router.get('/prospects', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const userId = getUserId(req)!;
    const rows = await db
      .select()
      .from(outreachProspects)
      .where(and(eq(outreachProspects.tenantId, tenantId), eq(outreachProspects.userId, userId)))
      .orderBy(desc(outreachProspects.updatedAt))
      .limit(200);
    res.json({ prospects: rows });
  } catch (err: any) {
    log.error('GET /prospects failed', err);
    res.status(500).json({ message: 'Failed to list prospects' });
  }
});

router.post('/prospects', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const userId = getUserId(req)!;
    const data = insertOutreachProspectSchema
      .omit({ tenantId: true, userId: true })
      .parse(req.body);
    const [row] = await db
      .insert(outreachProspects)
      .values({ tenantId, userId, ...data })
      .returning();
    res.json({ prospect: row });
  } catch (err: any) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: 'Invalid input', details: err.errors });
    log.error('POST /prospects failed', err);
    res.status(500).json({ message: 'Failed to save prospect' });
  }
});

router.patch('/prospects/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const patch = insertOutreachProspectSchema
      .partial()
      .omit({ tenantId: true, userId: true })
      .parse(req.body);
    const [updated] = await db
      .update(outreachProspects)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(and(eq(outreachProspects.id, req.params.id), eq(outreachProspects.tenantId, tenantId)))
      .returning();
    res.json({ prospect: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: 'Invalid input', details: err.errors });
    log.error('PATCH /prospects/:id failed', err);
    res.status(500).json({ message: 'Failed to update prospect' });
  }
});

router.delete('/prospects/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    await db
      .delete(outreachProspects)
      .where(
        and(eq(outreachProspects.id, req.params.id), eq(outreachProspects.tenantId, tenantId)),
      );
    res.json({ ok: true });
  } catch (err: any) {
    log.error('DELETE /prospects/:id failed', err);
    res.status(500).json({ message: 'Failed to delete prospect' });
  }
});

// ==================== Drafts ====================

const generateDraftInput = z.object({
  prospectId: z.string(),
  sequenceId: z.string().optional(),
  stepId: z.string().optional(),
  channel: z.enum(['email', 'linkedin_connect', 'linkedin_message', 'linkedin_inmail']),
  variantCount: z.number().int().min(1).max(6).optional(),
  angleOverride: z.string().optional(),
});

router.post('/drafts/generate', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const userId = getUserId(req)!;
    const input = generateDraftInput.parse(req.body);

    const [prospectRows, specs, ctx] = await Promise.all([
      db
        .select()
        .from(outreachProspects)
        .where(
          and(eq(outreachProspects.id, input.prospectId), eq(outreachProspects.tenantId, tenantId)),
        )
        .limit(1),
      db
        .select()
        .from(repSpecializations)
        .where(
          and(eq(repSpecializations.tenantId, tenantId), eq(repSpecializations.userId, userId)),
        ),
      loadBusinessContext(tenantId, userId),
    ]);

    const prospect = prospectRows[0];
    if (!prospect) return res.status(404).json({ message: 'Prospect not found' });

    const sequence = input.sequenceId
      ? (
          await db
            .select()
            .from(outreachSequences)
            .where(
              and(
                eq(outreachSequences.id, input.sequenceId),
                eq(outreachSequences.tenantId, tenantId),
              ),
            )
            .limit(1)
        )[0]
      : undefined;

    const step = input.stepId
      ? (
          await db
            .select()
            .from(outreachSequenceSteps)
            .where(
              and(
                eq(outreachSequenceSteps.id, input.stepId),
                eq(outreachSequenceSteps.tenantId, tenantId),
              ),
            )
            .limit(1)
        )[0]
      : undefined;

    const specialties = specs.map((s) => ({ specialty: s.specialty, weight: s.weight }));
    const repNotes = specs
      .map((s) => s.personalNotes)
      .filter(Boolean)
      .join('\n');

    const generated = await generateDraft({
      businessContext: ctx || null,
      specialties,
      repNotes,
      sequence: sequence || undefined,
      step: step || undefined,
      prospect,
      channel: input.channel,
      variantCount: input.variantCount || 3,
    });

    const [saved] = await db
      .insert(outreachDrafts)
      .values({
        tenantId,
        userId,
        sequenceId: input.sequenceId,
        stepId: input.stepId,
        prospectId: prospect.id,
        channel: input.channel,
        subject: generated.subject,
        body: generated.body,
        variants: generated.variants,
        selectedVariantIndex: generated.recommendedVariantIndex || 0,
        status: 'draft',
        generationContext: {
          specialtyBlend: specialties,
          angle: sequence?.angle || input.angleOverride,
          businessContextId: ctx?.id,
          spamFlags: generated.spamFlags,
          generatedAt: new Date().toISOString(),
        },
      })
      .returning();

    res.json({ draft: saved });
  } catch (err: any) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: 'Invalid input', details: err.errors });
    log.error('POST /drafts/generate failed', err);
    res.status(500).json({ message: err.message || 'Failed to generate draft' });
  }
});

router.get('/drafts', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const userId = getUserId(req)!;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const where = status
      ? and(
          eq(outreachDrafts.tenantId, tenantId),
          eq(outreachDrafts.userId, userId),
          eq(outreachDrafts.status, status),
        )
      : and(eq(outreachDrafts.tenantId, tenantId), eq(outreachDrafts.userId, userId));

    const rows = await db
      .select()
      .from(outreachDrafts)
      .where(where)
      .orderBy(desc(outreachDrafts.updatedAt))
      .limit(200);

    // Hydrate with prospect info
    const prospectIds = Array.from(new Set(rows.map((r) => r.prospectId)));
    const prospects = prospectIds.length
      ? await db.select().from(outreachProspects).where(inArray(outreachProspects.id, prospectIds))
      : [];
    const byId = new Map(prospects.map((p) => [p.id, p]));

    res.json({
      drafts: rows.map((r) => ({ ...r, prospect: byId.get(r.prospectId) || null })),
    });
  } catch (err: any) {
    log.error('GET /drafts failed', err);
    res.status(500).json({ message: 'Failed to list drafts' });
  }
});

router.patch('/drafts/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const patch = insertOutreachDraftSchema
      .partial()
      .omit({ tenantId: true, userId: true, prospectId: true })
      .parse(req.body);
    const [updated] = await db
      .update(outreachDrafts)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(and(eq(outreachDrafts.id, req.params.id), eq(outreachDrafts.tenantId, tenantId)))
      .returning();
    res.json({ draft: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: 'Invalid input', details: err.errors });
    log.error('PATCH /drafts/:id failed', err);
    res.status(500).json({ message: 'Failed to update draft' });
  }
});

router.post('/drafts/:id/mark-sent', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const [updated] = await db
      .update(outreachDrafts)
      .set({ status: 'sent', markedSentAt: new Date(), updatedAt: new Date() })
      .where(and(eq(outreachDrafts.id, req.params.id), eq(outreachDrafts.tenantId, tenantId)))
      .returning();
    res.json({ draft: updated });
  } catch (err: any) {
    log.error('POST /drafts/:id/mark-sent failed', err);
    res.status(500).json({ message: 'Failed to mark sent' });
  }
});

router.post('/drafts/:id/mark-replied', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    const sentiment = z
      .object({
        sentiment: z.enum(['positive', 'neutral', 'negative', 'ooo']).optional(),
        meetingBooked: z.boolean().optional(),
      })
      .parse(req.body);
    const [updated] = await db
      .update(outreachDrafts)
      .set({
        status: 'replied',
        markedRepliedAt: new Date(),
        repliedSentiment: sentiment.sentiment,
        meetingBooked: sentiment.meetingBooked || false,
        updatedAt: new Date(),
      })
      .where(and(eq(outreachDrafts.id, req.params.id), eq(outreachDrafts.tenantId, tenantId)))
      .returning();
    res.json({ draft: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: 'Invalid input', details: err.errors });
    log.error('POST /drafts/:id/mark-replied failed', err);
    res.status(500).json({ message: 'Failed to mark replied' });
  }
});

router.delete('/drafts/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req)!;
    await db
      .delete(outreachDrafts)
      .where(and(eq(outreachDrafts.id, req.params.id), eq(outreachDrafts.tenantId, tenantId)));
    res.json({ ok: true });
  } catch (err: any) {
    log.error('DELETE /drafts/:id failed', err);
    res.status(500).json({ message: 'Failed to delete draft' });
  }
});

export default router;
