/**
 * SMS/Photo Meter Reads with Vision Extraction Routes (US-SUPER-002).
 *
 * Customers text/email a phone photo of their MFP meter panel; Claude vision
 * extracts the counters (black/color/scan/fax), the read is validated against
 * the machine's rolling 90-day average, and — when it passes — a billable
 * meter_readings row is created and a confirmation SMS is queued. Reads that
 * fail validation (negative delta, or a jump beyond maxDeltaMultiplier × the
 * rolling average) or that can't be resolved to a machine/customer land in a
 * review queue with a clarification message.
 *
 * Endpoints:
 *   POST /api/meter-reads/inbound                    — simulated Twilio inbound webhook
 *   POST /api/meter-reads/submit                     — web/manual photo submission
 *   GET  /api/meter-reads/submissions?status=        — review queue (newest first)
 *   GET  /api/meter-reads/submissions/:id            — single submission
 *   POST /api/meter-reads/submissions/:id/approve    — reviewer approve (+ edits)
 *   POST /api/meter-reads/submissions/:id/reject     — reviewer reject
 *   GET  /api/meter-reads/settings                   — templates + threshold + *_set
 *   PUT  /api/meter-reads/settings                   — update (encrypts Twilio creds)
 *
 * Schema: shared/meter-read-vision-schema.ts (re-exported from shared/schema.ts).
 * Auth: requireAuth + tenant scoping on every query.
 *
 * Documented STUBs / TODOs:
 *   - extractMeterFromImage(): real Claude vision call when ANTHROPIC_API_KEY is
 *     set AND an image is provided; otherwise a deterministic offline FALLBACK so
 *     the pipeline is exercisable without network/keys.
 *   - sendOutboundSms(): Twilio send STUB (returns false when unconfigured).
 *     TODO: wire Twilio via credentials decrypted from the vault.
 *   - POST /inbound only SIMULATES Twilio's webhook; real Twilio signature
 *     verification + tenant-resolution-by-inbound-number is a TODO.
 *   - Twilio creds are stored under encryptedConfig with a light obfuscation +
 *     TODO(vault); GET /settings returns only *_set booleans, never raw creds.
 *   - Image file upload is a STUB on the frontend (URL only).
 *   - fromPhone → business_records.phone match is best-effort (single match).
 *   - Identical images are de-duplicated by SHA-256 hash for cost control.
 *   - TODO(rbac): requirePermission(['billing.meter_read.review']) once it exists.
 */

import { createHash } from 'crypto';
import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import {
  meterReadSubmissions,
  meterReadSettings,
  businessRecords,
  equipment,
  meterReadings,
  METER_READ_VALIDATION_STATUSES,
} from '@shared/schema';

const log = createModuleLogger('routes-meter-read-vision');

const NINETY_DAYS_MS = 90 * 86_400_000;

const DEFAULT_CONFIRM_TEMPLATE =
  'Thanks! We recorded your meter read: black {{black}}, color {{color}}. No action needed.';
const DEFAULT_CLARIFY_TEMPLATE =
  "Thanks for the photo! We couldn't match it to a specific machine. Please reply with your account name or the device serial number so we can record the read.";

// ---------------------------------------------------------------------------
// Extracted-values shape
// ---------------------------------------------------------------------------

interface ExtractedMeter {
  black: number;
  color: number;
  scan: number;
  fax: number;
  confidence: number;
  source: 'ai' | 'fallback';
}

const FALLBACK_EXTRACTION: ExtractedMeter = {
  black: 0,
  color: 0,
  scan: 0,
  fax: 0,
  confidence: 0,
  source: 'fallback',
};

// ---------------------------------------------------------------------------
// Vision adapter — Claude (Anthropic SDK)
// ---------------------------------------------------------------------------

/**
 * Extract MFP meter counters from a photo via Claude vision.
 *
 * When ANTHROPIC_API_KEY is set AND an image is provided, calls the model and
 * parses the JSON it returns. On ANY failure (no key, no image, API error,
 * parse error) returns a deterministic FALLBACK so the pipeline is exercisable
 * offline. `source` is only 'ai' on a clean parse.
 */
export async function extractMeterFromImage(args: {
  imageBase64?: string;
  mediaType?: string;
  imageUrl?: string;
}): Promise<ExtractedMeter> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return FALLBACK_EXTRACTION;
    if (!args.imageBase64 && !args.imageUrl) return FALLBACK_EXTRACTION;

    const client = new Anthropic();
    const imageBlock = args.imageBase64
      ? {
          type: 'image',
          source: {
            type: 'base64',
            media_type: args.mediaType ?? 'image/jpeg',
            data: args.imageBase64,
          },
        }
      : { type: 'image', source: { type: 'url', url: args.imageUrl } };

    const resp = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            imageBlock as any,
            {
              type: 'text',
              text:
                'You are reading the meter / counter panel of a multifunction office printer (MFP). ' +
                'Identify the lifetime page counters. Return ONLY a JSON object, no prose, of the form ' +
                '{"black":int,"color":int,"scan":int,"fax":int,"confidence":0..1}. ' +
                'Use 0 for any counter not visible. "confidence" is your overall confidence (0..1).',
            },
          ],
        },
      ],
    });

    const text = (resp.content ?? [])
      .filter((b: any) => b && b.type === 'text')
      .map((b: any) => b.text as string)
      .join('');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return FALLBACK_EXTRACTION;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;

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
      confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
      source: 'ai',
    };
  } catch (err) {
    log.warn('Vision extraction failed; using fallback (offline-safe):', err as any);
    return FALLBACK_EXTRACTION;
  }
}

// ---------------------------------------------------------------------------
// Twilio send STUB + credential obfuscation
// ---------------------------------------------------------------------------

/**
 * Outbound SMS send STUB. Returns false when Twilio is unconfigured; never
 * throws (best-effort). TODO: wire Twilio via credentials decrypted from the
 * vault (server/services/address-book/credential-vault.ts) — for now the slice
 * stays offline-safe and we just record the message body on the submission.
 */
async function sendOutboundSms(to: string, body: string): Promise<boolean> {
  // TODO: wire Twilio via credentials decrypted from the vault.
  void to;
  void body;
  return false;
}

/**
 * Light credential obfuscation for at-rest storage under encryptedConfig.
 * TODO(vault): replace with the shared credential vault
 * (server/services/address-book/credential-vault.ts) once an env master key is
 * provisioned for this module — the vault throws when ADDRESS_BOOK_MASTER_KEY is
 * absent, which would make settings writes fail in offline/dev. We never return
 * the decrypted value; reads expose only *_set booleans.
 */
function obfuscateCredential(plaintext: string): string {
  return Buffer.from(plaintext, 'utf8').toString('base64');
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

async function getOrCreateSettings(tenantId: string) {
  const existing = await db.query.meterReadSettings.findFirst({
    where: eq(meterReadSettings.tenantId, tenantId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(meterReadSettings)
    .values({
      tenantId,
      confirmTemplate: DEFAULT_CONFIRM_TEMPLATE,
      clarifyTemplate: DEFAULT_CLARIFY_TEMPLATE,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.meterReadSettings.findFirst({
    where: eq(meterReadSettings.tenantId, tenantId),
  });
}

/** Derive the write-only *_set booleans from encryptedConfig. */
function credSetMarkers(encryptedConfig: unknown): {
  twilioAccountSidSet: boolean;
  twilioAuthTokenSet: boolean;
  twilioFromNumberSet: boolean;
} {
  const cfg = (encryptedConfig ?? {}) as Record<string, unknown>;
  return {
    twilioAccountSidSet:
      typeof cfg.twilioAccountSid === 'string' && cfg.twilioAccountSid.length > 0,
    twilioAuthTokenSet: typeof cfg.twilioAuthToken === 'string' && cfg.twilioAuthToken.length > 0,
    twilioFromNumberSet:
      typeof cfg.twilioFromNumber === 'string' && cfg.twilioFromNumber.length > 0,
  };
}

/** Public settings projection: templates + threshold + *_set booleans (no creds). */
function projectSettings(row: {
  tenantId: string;
  maxDeltaMultiplier: number;
  confirmTemplate: string | null;
  clarifyTemplate: string | null;
  encryptedConfig: unknown;
  updatedAt: Date | null;
}) {
  return {
    tenantId: row.tenantId,
    maxDeltaMultiplier: row.maxDeltaMultiplier,
    confirmTemplate: row.confirmTemplate ?? DEFAULT_CONFIRM_TEMPLATE,
    clarifyTemplate: row.clarifyTemplate ?? DEFAULT_CLARIFY_TEMPLATE,
    updatedAt: row.updatedAt,
    ...credSetMarkers(row.encryptedConfig),
  };
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function audit(
  action: 'INBOUND' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'UPDATE_SETTINGS',
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
    '[AUDIT] meter-read-vision',
  );
}

function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) =>
    key in vars ? String(vars[key]) : `{{${key}}}`,
  );
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

interface ProcessArgs {
  tenantId: string;
  userId: string | undefined;
  source: 'sms' | 'email' | 'web' | 'manual';
  fromPhone?: string;
  machineId?: string;
  customerId?: string;
  imageBase64?: string;
  imageUrl?: string;
  mediaType?: string;
}

/**
 * Resolve customer + machine, extract counters, validate against the 90-day
 * rolling average, persist a meter_read_submissions row (auto-creating a
 * meter_readings row on a clean auto-approval), and return the persisted row
 * plus the outbound message.
 */
async function processSubmission(args: ProcessArgs) {
  const { tenantId, source } = args;
  const settings = await getOrCreateSettings(tenantId);
  const maxDeltaMultiplier = settings?.maxDeltaMultiplier ?? 3;
  const confirmTemplate = settings?.confirmTemplate ?? DEFAULT_CONFIRM_TEMPLATE;
  const clarifyTemplate = settings?.clarifyTemplate ?? DEFAULT_CLARIFY_TEMPLATE;

  // --- Resolve machine + customer ------------------------------------------
  let machineId: string | null = null;
  let customerId: string | null = args.customerId ?? null;

  if (args.machineId) {
    const machine = await db.query.equipment.findFirst({
      where: and(eq(equipment.id, args.machineId), eq(equipment.tenantId, tenantId)),
      columns: { id: true, customerId: true },
    });
    if (machine) {
      machineId = machine.id;
      if (!customerId) customerId = machine.customerId ?? null;
    }
  }

  // Resolve a customer from the caller phone (best-effort, single match).
  if (!customerId && args.fromPhone) {
    const norm = args.fromPhone.replace(/\D/g, '');
    if (norm.length >= 7) {
      const candidates = await db
        .select({ id: businessRecords.id, phone: businessRecords.phone })
        .from(businessRecords)
        .where(eq(businessRecords.tenantId, tenantId));
      const hit = candidates.find(
        (c) => c.phone && c.phone.replace(/\D/g, '').endsWith(norm.slice(-10)),
      );
      if (hit) customerId = hit.id;
    }
  }

  // If we have a customer but no machine, resolve the customer's SINGLE machine.
  if (!machineId && customerId) {
    const machines = await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(and(eq(equipment.tenantId, tenantId), eq(equipment.customerId, customerId)))
      .limit(2);
    if (machines.length === 1) machineId = machines[0].id;
  }

  // --- Image hash + de-dup --------------------------------------------------
  const imageKey = args.imageBase64 ?? args.imageUrl ?? '';
  const imageHash = imageKey ? sha256(imageKey) : null;

  let extracted: ExtractedMeter | null = null;
  if (imageHash) {
    const prior = await db.query.meterReadSubmissions.findFirst({
      where: and(
        eq(meterReadSubmissions.tenantId, tenantId),
        eq(meterReadSubmissions.imageHash, imageHash),
      ),
      orderBy: [desc(meterReadSubmissions.createdAt)],
    });
    if (prior?.extractedValues) {
      extracted = prior.extractedValues as ExtractedMeter; // reuse — cost control
    }
  }
  if (!extracted) {
    extracted = await extractMeterFromImage({
      imageBase64: args.imageBase64,
      imageUrl: args.imageUrl,
      mediaType: args.mediaType,
    });
  }

  // --- Validate against the rolling 90-day average -------------------------
  let validationStatus: (typeof METER_READ_VALIDATION_STATUSES)[number] = 'pending';
  const validationDetail: Record<string, unknown> = {
    rollingAvgBlack: null,
    lastBlack: null,
    deltaBlack: null,
    maxDeltaMultiplier,
    extractionSource: extracted.source,
    confidence: extracted.confidence,
  };
  let outboundMessage = '';
  let createdMeterReadingId: string | null = null;

  if (!machineId || !customerId) {
    // Ambiguous — can't bill. Ask for clarification.
    validationStatus = 'pending';
    validationDetail.reason = !machineId
      ? 'Could not resolve the machine from the photo/phone.'
      : 'Could not resolve the customer.';
    outboundMessage = clarifyTemplate;
  } else {
    const since = new Date(Date.now() - NINETY_DAYS_MS);
    const recent = await db
      .select({
        bwMeterReading: meterReadings.bwMeterReading,
        readingDate: meterReadings.readingDate,
      })
      .from(meterReadings)
      .where(
        and(
          eq(meterReadings.tenantId, tenantId),
          eq(meterReadings.equipmentId, machineId),
          gte(meterReadings.readingDate, since),
        ),
      )
      .orderBy(desc(meterReadings.readingDate));

    const blacks = recent
      .map((r) => (r.bwMeterReading == null ? null : Number(r.bwMeterReading)))
      .filter((n): n is number => n != null && Number.isFinite(n));
    const lastBlack = blacks.length ? blacks[0] : null;
    const rollingAvg = blacks.length ? blacks.reduce((a, b) => a + b, 0) / blacks.length : null;
    const newBlack = extracted.black;
    const deltaBlack = lastBlack == null ? null : newBlack - lastBlack;

    validationDetail.rollingAvgBlack = rollingAvg;
    validationDetail.lastBlack = lastBlack;
    validationDetail.deltaBlack = deltaBlack;
    validationDetail.newBlack = newBlack;

    let flagged = false;
    let reason = 'Within expected range.';

    if (lastBlack != null && deltaBlack != null && deltaBlack < 0) {
      flagged = true;
      reason = `Black counter went backwards (${lastBlack} → ${newBlack}).`;
    } else if (
      lastBlack != null &&
      deltaBlack != null &&
      rollingAvg != null &&
      rollingAvg > 0 &&
      deltaBlack > maxDeltaMultiplier * rollingAvg
    ) {
      flagged = true;
      reason = `Black delta ${deltaBlack} exceeds ${maxDeltaMultiplier}× the rolling avg (${Math.round(
        rollingAvg,
      )}).`;
    } else if (extracted.source === 'fallback') {
      // Offline/fallback extraction has no real numbers — never auto-bill.
      flagged = true;
      reason = 'Extraction unavailable (fallback); needs manual entry.';
    }

    validationDetail.reason = reason;

    if (flagged) {
      validationStatus = 'flagged';
      outboundMessage = clarifyTemplate;
    } else {
      // Auto-approve → create the billable read.
      try {
        const [reading] = await db
          .insert(meterReadings)
          .values({
            tenantId,
            equipmentId: machineId,
            createdBy: args.userId ?? 'system',
            readingDate: new Date(),
            bwMeterReading: extracted.black,
            colorMeterReading: extracted.color,
            scanMeterReading: extracted.scan,
            faxMeterReading: extracted.fax,
            collectionMethod: source === 'email' ? 'email' : 'manual',
            readingMethod: source,
          })
          .returning({ id: meterReadings.id });
        createdMeterReadingId = reading?.id ?? null;
        validationStatus = 'auto_approved';
        outboundMessage = renderTemplate(confirmTemplate, {
          black: extracted.black,
          color: extracted.color,
          scan: extracted.scan,
          fax: extracted.fax,
        });
      } catch (err) {
        // Tolerate a missing-column / insert failure — keep the submission, flag it.
        log.warn('Auto-approve meter_readings insert failed; flagging instead:', err as any);
        validationStatus = 'flagged';
        validationDetail.reason = 'Auto-approval billable insert failed; needs review.';
        outboundMessage = clarifyTemplate;
      }
    }
  }

  // --- Best-effort outbound SMS (STUB) -------------------------------------
  if (outboundMessage && args.fromPhone) {
    await sendOutboundSms(args.fromPhone, outboundMessage);
  }

  // --- Persist the submission ----------------------------------------------
  const [submission] = await db
    .insert(meterReadSubmissions)
    .values({
      tenantId,
      source,
      fromPhone: args.fromPhone ?? null,
      customerId,
      machineId,
      rawImageUrl: args.imageUrl ?? null,
      imageHash,
      extractedValues: extracted,
      validationStatus,
      validationDetail,
      outboundMessage: outboundMessage || null,
      meterReadingId: createdMeterReadingId,
      submittedAt: new Date(),
    })
    .returning();

  return { submission, outboundMessage };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const inboundSchema = z.object({
  fromPhone: z.string().min(1).optional(),
  imageBase64: z.string().min(1).optional(),
  imageUrl: z.string().min(1).optional(),
  mediaType: z.string().min(1).optional(),
  machineId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
});

const submitSchema = z.object({
  machineId: z.string().min(1),
  imageBase64: z.string().min(1).optional(),
  imageUrl: z.string().min(1).optional(),
  mediaType: z.string().min(1).optional(),
  source: z.enum(['web', 'manual']).optional(),
});

const approveSchema = z.object({
  black: z.number().int().min(0).optional(),
  color: z.number().int().min(0).optional(),
  scan: z.number().int().min(0).optional(),
  fax: z.number().int().min(0).optional(),
  machineId: z.string().min(1).optional(),
});

const settingsSchema = z.object({
  maxDeltaMultiplier: z.number().int().min(1).max(100).optional(),
  confirmTemplate: z.string().max(1000).optional(),
  clarifyTemplate: z.string().max(1000).optional(),
  twilioAccountSid: z.string().min(1).optional(),
  twilioAuthToken: z.string().min(1).optional(),
  twilioFromNumber: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Enrichment helpers (attach machine serial + customer company name)
// ---------------------------------------------------------------------------

async function enrich(tenantId: string, rows: Array<typeof meterReadSubmissions.$inferSelect>) {
  const machineIds = Array.from(
    new Set(rows.map((r) => r.machineId).filter((v): v is string => !!v)),
  );
  const customerIds = Array.from(
    new Set(rows.map((r) => r.customerId).filter((v): v is string => !!v)),
  );

  const machines = machineIds.length
    ? await db
        .select({
          id: equipment.id,
          serialNumber: equipment.serialNumber,
          modelNumber: equipment.modelNumber,
        })
        .from(equipment)
        .where(eq(equipment.tenantId, tenantId))
    : [];
  const customers = customerIds.length
    ? await db
        .select({ id: businessRecords.id, companyName: businessRecords.companyName })
        .from(businessRecords)
        .where(eq(businessRecords.tenantId, tenantId))
    : [];
  const machineMap = new Map(machines.map((m) => [m.id, m]));
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  return rows.map((r) => ({
    ...r,
    serialNumber: r.machineId ? (machineMap.get(r.machineId)?.serialNumber ?? null) : null,
    modelNumber: r.machineId ? (machineMap.get(r.machineId)?.modelNumber ?? null) : null,
    companyName: r.customerId ? (customerMap.get(r.customerId)?.companyName ?? null) : null,
  }));
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerMeterReadVisionRoutes(app: Express) {
  /**
   * POST /api/meter-reads/inbound
   * Simulated Twilio inbound webhook. Real Twilio signature verification +
   * tenant-resolution-by-inbound-number is a TODO; here we trust the
   * authenticated tenant context.
   */
  app.post('/api/meter-reads/inbound', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = inboundSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      // TODO: verify Twilio signature + resolve tenant by the inbound number.
      const result = await processSubmission({
        tenantId,
        userId,
        source: 'sms',
        fromPhone: parsed.data.fromPhone,
        machineId: parsed.data.machineId,
        customerId: parsed.data.customerId,
        imageBase64: parsed.data.imageBase64,
        imageUrl: parsed.data.imageUrl,
        mediaType: parsed.data.mediaType,
      });

      audit('INBOUND', {
        tenantId,
        userId,
        extra: { id: result.submission?.id, status: result.submission?.validationStatus },
      });
      res.status(201).json(result);
    } catch (error: any) {
      log.error('Inbound meter read failed:', error);
      res
        .status(500)
        .json({ message: 'Failed to process inbound meter read', error: error?.message });
    }
  });

  /**
   * POST /api/meter-reads/submit
   * Web/manual photo submission (no phone). machineId required.
   */
  app.post('/api/meter-reads/submit', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = submitSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      const result = await processSubmission({
        tenantId,
        userId,
        source: parsed.data.source ?? 'web',
        machineId: parsed.data.machineId,
        imageBase64: parsed.data.imageBase64,
        imageUrl: parsed.data.imageUrl,
        mediaType: parsed.data.mediaType,
      });

      audit('SUBMIT', {
        tenantId,
        userId,
        extra: { id: result.submission?.id, status: result.submission?.validationStatus },
      });
      res.status(201).json(result);
    } catch (error: any) {
      log.error('Submit meter read failed:', error);
      res.status(500).json({ message: 'Failed to submit meter read', error: error?.message });
    }
  });

  /**
   * GET /api/meter-reads/submissions?status=
   * Review queue, newest first. ?status=pending|auto_approved|flagged|approved|
   * rejected|all (default returns all).
   */
  app.get('/api/meter-reads/submissions', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const conditions = [eq(meterReadSubmissions.tenantId, tenantId)];
      if (status && status !== 'all') {
        conditions.push(eq(meterReadSubmissions.validationStatus, status));
      }

      const rows = await db
        .select()
        .from(meterReadSubmissions)
        .where(and(...conditions))
        .orderBy(desc(meterReadSubmissions.createdAt))
        .limit(500);

      const data = await enrich(tenantId, rows);
      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to list submissions:', error);
      res.status(500).json({ message: 'Failed to list submissions', error: error?.message });
    }
  });

  /** GET /api/meter-reads/submissions/:id — single submission + names. */
  app.get('/api/meter-reads/submissions/:id', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const row = await db.query.meterReadSubmissions.findFirst({
        where: and(
          eq(meterReadSubmissions.id, req.params.id),
          eq(meterReadSubmissions.tenantId, tenantId),
        ),
      });
      if (!row) return res.status(404).json({ message: 'Submission not found' });

      const [enriched] = await enrich(tenantId, [row]);
      res.json(enriched);
    } catch (error: any) {
      log.error('Failed to load submission:', error);
      res.status(500).json({ message: 'Failed to load submission', error: error?.message });
    }
  });

  /**
   * POST /api/meter-reads/submissions/:id/approve
   * Reviewer approves (with optional value/machine overrides). Creates a
   * billable meter_readings row and marks the submission 'approved'.
   */
  app.post(
    '/api/meter-reads/submissions/:id/approve',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const parsed = approveSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }

        const submission = await db.query.meterReadSubmissions.findFirst({
          where: and(
            eq(meterReadSubmissions.id, req.params.id),
            eq(meterReadSubmissions.tenantId, tenantId),
          ),
        });
        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        const machineId = parsed.data.machineId ?? submission.machineId;
        if (!machineId) {
          return res
            .status(400)
            .json({ message: 'A machine is required to approve. Provide machineId.' });
        }

        const extracted = (submission.extractedValues ?? {}) as Partial<ExtractedMeter>;
        const black = parsed.data.black ?? Number(extracted.black ?? 0);
        const color = parsed.data.color ?? Number(extracted.color ?? 0);
        const scan = parsed.data.scan ?? Number(extracted.scan ?? 0);
        const fax = parsed.data.fax ?? Number(extracted.fax ?? 0);

        const now = new Date();
        let meterReadingId: string | null = submission.meterReadingId ?? null;
        const detail = {
          ...((submission.validationDetail ?? {}) as Record<string, unknown>),
        };

        try {
          const [reading] = await db
            .insert(meterReadings)
            .values({
              tenantId,
              equipmentId: machineId,
              createdBy: userId ?? 'system',
              readingDate: now,
              bwMeterReading: black,
              colorMeterReading: color,
              scanMeterReading: scan,
              faxMeterReading: fax,
              collectionMethod: 'email',
              readingMethod: 'manual',
            })
            .returning({ id: meterReadings.id });
          meterReadingId = reading?.id ?? meterReadingId;
        } catch (err) {
          // Tolerate a billable insert failure — still mark approved, with a note.
          log.warn('Approve meter_readings insert failed; marking approved with note:', err as any);
          detail.approveNote = 'Billable meter_readings insert failed (missing columns?).';
        }

        const [updated] = await db
          .update(meterReadSubmissions)
          .set({
            validationStatus: 'approved',
            machineId,
            meterReadingId,
            validationDetail: detail,
            reviewedByUserId: userId ?? null,
            reviewedAt: now,
          })
          .where(
            and(
              eq(meterReadSubmissions.id, req.params.id),
              eq(meterReadSubmissions.tenantId, tenantId),
            ),
          )
          .returning();

        audit('APPROVE', { tenantId, userId, extra: { id: req.params.id, meterReadingId } });
        res.json(updated);
      } catch (error: any) {
        log.error('Failed to approve submission:', error);
        res.status(500).json({ message: 'Failed to approve submission', error: error?.message });
      }
    },
  );

  /** POST /api/meter-reads/submissions/:id/reject — reviewer rejects. */
  app.post(
    '/api/meter-reads/submissions/:id/reject',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const [updated] = await db
          .update(meterReadSubmissions)
          .set({
            validationStatus: 'rejected',
            reviewedByUserId: userId ?? null,
            reviewedAt: new Date(),
          })
          .where(
            and(
              eq(meterReadSubmissions.id, req.params.id),
              eq(meterReadSubmissions.tenantId, tenantId),
            ),
          )
          .returning();
        if (!updated) return res.status(404).json({ message: 'Submission not found' });

        audit('REJECT', { tenantId, userId, extra: { id: req.params.id } });
        res.json(updated);
      } catch (error: any) {
        log.error('Failed to reject submission:', error);
        res.status(500).json({ message: 'Failed to reject submission', error: error?.message });
      }
    },
  );

  /** GET /api/meter-reads/settings — templates + threshold + *_set booleans. */
  app.get('/api/meter-reads/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const settings = await getOrCreateSettings(tenantId);
      if (!settings) return res.status(500).json({ message: 'Failed to load settings' });
      res.json(projectSettings(settings));
    } catch (error: any) {
      log.error('Failed to load settings:', error);
      res.status(500).json({ message: 'Failed to load settings', error: error?.message });
    }
  });

  /**
   * PUT /api/meter-reads/settings
   * Update templates / threshold / Twilio creds. Twilio creds are obfuscated
   * into encryptedConfig and NEVER echoed; the response carries only *_set
   * booleans.
   */
  app.put('/api/meter-reads/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = settingsSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      const current = await getOrCreateSettings(tenantId);
      if (!current) return res.status(500).json({ message: 'Failed to load settings' });

      const updates: Record<string, unknown> = {
        updatedByUserId: userId,
        updatedAt: new Date(),
      };
      if (parsed.data.maxDeltaMultiplier !== undefined)
        updates.maxDeltaMultiplier = parsed.data.maxDeltaMultiplier;
      if (parsed.data.confirmTemplate !== undefined)
        updates.confirmTemplate = parsed.data.confirmTemplate;
      if (parsed.data.clarifyTemplate !== undefined)
        updates.clarifyTemplate = parsed.data.clarifyTemplate;

      // Merge encrypted Twilio creds (only overwrite the ones supplied).
      const cfg: Record<string, unknown> = {
        ...((current.encryptedConfig ?? {}) as Record<string, unknown>),
      };
      if (parsed.data.twilioAccountSid !== undefined)
        cfg.twilioAccountSid = obfuscateCredential(parsed.data.twilioAccountSid);
      if (parsed.data.twilioAuthToken !== undefined)
        cfg.twilioAuthToken = obfuscateCredential(parsed.data.twilioAuthToken);
      if (parsed.data.twilioFromNumber !== undefined)
        cfg.twilioFromNumber = obfuscateCredential(parsed.data.twilioFromNumber);
      if (
        parsed.data.twilioAccountSid !== undefined ||
        parsed.data.twilioAuthToken !== undefined ||
        parsed.data.twilioFromNumber !== undefined
      ) {
        updates.encryptedConfig = cfg;
      }

      const [updated] = await db
        .update(meterReadSettings)
        .set(updates)
        .where(eq(meterReadSettings.tenantId, tenantId))
        .returning();

      audit('UPDATE_SETTINGS', {
        tenantId,
        userId,
        extra: {
          maxDeltaMultiplier: parsed.data.maxDeltaMultiplier,
          twilioAccountSidSet: parsed.data.twilioAccountSid !== undefined,
          twilioAuthTokenSet: parsed.data.twilioAuthToken !== undefined,
          twilioFromNumberSet: parsed.data.twilioFromNumber !== undefined,
        },
      });

      res.json(projectSettings(updated));
    } catch (error: any) {
      log.error('Failed to update settings:', error);
      res.status(500).json({ message: 'Failed to update settings', error: error?.message });
    }
  });
}
