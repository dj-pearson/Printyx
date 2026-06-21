/**
 * Sales Rep Email Autopilot Routes (US-SUPER-016) — DRAFT MODE, NEVER auto-send.
 *
 * Per opted-in rep: read inbox + CRM, classify inbound email (Claude), and draft
 * replies in the rep's voice (last-50-sent style fingerprint + CRM context).
 * Drafts are saved as Gmail/Outlook drafts (provider create-draft scope ONLY)
 * AND surfaced in Printyx for review. THE REP SENDS FROM THEIR OWN MAIL CLIENT.
 *
 * >>> THERE IS NO SEND CAPABILITY IN v1. <<<
 * No endpoint and no button here sends mail. Accepting a draft only records the
 * rep's edits + edit-distance and leaves the draft in their mailbox; the rep
 * presses Send themselves in Gmail/Outlook. Connected OAuth scope is read +
 * create-draft ONLY — never send.
 *
 * Everything is scoped by (tenantId, userId): a rep only ever sees their own
 * mailbox/drafts/suppressions.
 *
 * Endpoints:
 *   GET    /api/email-autopilot/account                 — caller's account (no raw tokens)
 *   POST   /api/email-autopilot/connect                 — connect mailbox (encrypt tokens, build fingerprint)
 *   PUT    /api/email-autopilot/settings                — { enabled? } feature-flag/opt-in toggle
 *   POST   /api/email-autopilot/scan                    — overnight scan (cron-callable): classify + draft
 *   GET    /api/email-autopilot/drafts?status=          — caller's drafts (default 'draft'), newest first
 *   GET    /api/email-autopilot/drafts/:id              — single draft + thread context
 *   POST   /api/email-autopilot/drafts/:id/accept       — { finalBody? } records accept + edit-distance (NOT a send)
 *   POST   /api/email-autopilot/drafts/:id/reject       — records reject
 *   GET    /api/email-autopilot/suppressions
 *   POST   /api/email-autopilot/suppressions            — { contactEmail, reason? } never-auto-draft
 *   DELETE /api/email-autopilot/suppressions/:contactEmail
 *   GET    /api/email-autopilot/stats                   — drafts ready / accepted / rejected / avg edit-distance / tone-miss rate
 *
 * Schema: shared/email-autopilot-schema.ts (re-exported from shared/schema.ts).
 * Auth: requireAuth + tenant scoping on every query.
 *
 * Documented STUBs / TODOs:
 *   - connectMailbox/OAuth: there is no real OAuth flow here. POST /connect
 *     accepts pasted tokens, obfuscates them into encryptedTokens, and returns
 *     only *_set booleans. TODO: real Gmail/Outlook OAuth (read + create-draft
 *     scope ONLY — never send). TODO(vault): replace base64 obfuscation with the
 *     shared credential vault once an env master key is provisioned for this
 *     module (the address-book vault throws without ADDRESS_BOOK_MASTER_KEY).
 *   - fetchInbox(): STUB returning deterministic sample emails so the scan is
 *     exercisable offline. TODO: real Gmail/Outlook list via stored tokens.
 *   - buildVoiceFingerprint(): STUB from injected "last 50 sent". TODO: derive
 *     from the rep's real sent mail.
 *   - classifyEmail()/draftReply(): Claude (CLAUDE_API_KEY) with deterministic
 *     offline fallbacks; source 'ai' | 'fallback'.
 *   - createProviderDraft(): STUB returning a fake external draft id. TODO: real
 *     provider create-draft API (create-draft scope only — never send).
 *   - CRM contact match by primary_contact_email is best-effort (single match).
 *   - TODO(rbac): requirePermission(['sales.email_autopilot.use']) once it exists.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import ClaudeAIService from './services/claude-ai-service';
import {
  emailAutopilotAccounts,
  emailAutopilotDrafts,
  emailAutopilotSuppressions,
  businessRecords,
  EMAIL_CLASSIFICATIONS,
} from '@shared/schema';

const log = createModuleLogger('routes-email-autopilot');

const TONE_MISS_THRESHOLD = 50; // editDistancePct > 50 → "tone-miss"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InboxEmail {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
}

interface VoiceFingerprint {
  tone: string;
  avgSentenceLength: number;
  signature: string;
  sampleCount: number;
}

interface Classification {
  classification: (typeof EMAIL_CLASSIFICATIONS)[number];
  confidence: number;
  source: 'ai' | 'fallback';
}

interface DraftedReply {
  subject: string;
  body: string;
  source: 'ai' | 'fallback';
}

// ---------------------------------------------------------------------------
// Credential obfuscation (TODO(vault))
// ---------------------------------------------------------------------------

/**
 * Light credential obfuscation for at-rest storage under encryptedTokens.
 * TODO(vault): replace with the shared credential vault once an env master key
 * is provisioned for this module — the address-book vault throws when
 * ADDRESS_BOOK_MASTER_KEY is absent, which would make /connect fail offline/dev.
 * We never return the decrypted value; reads expose only a tokensSet boolean.
 */
function obfuscateCredential(plaintext: string): string {
  return Buffer.from(plaintext, 'utf8').toString('base64');
}

// ---------------------------------------------------------------------------
// Provider adapters — all offline-safe STUBs
// ---------------------------------------------------------------------------

/**
 * Fetch the rep's inbox. STUB: returns a few deterministic sample emails so the
 * scan is exercisable offline (no real OAuth/tokens needed). The sample mix
 * covers a needs_reply, an fyi, and a spam so classification + draft branches
 * are all exercised.
 * TODO: real Gmail/Outlook list via stored tokens (read scope only).
 */
async function fetchInbox(account: {
  emailAddress: string | null;
  provider: string;
}): Promise<InboxEmail[]> {
  // TODO: real Gmail/Outlook list via stored tokens.
  const seed = (account.emailAddress ?? account.provider ?? 'inbox').length;
  return [
    {
      messageId: `sample-needsreply-${seed}`,
      threadId: `thread-needsreply-${seed}`,
      from: 'pat.buyer@acmeco.example.com',
      subject: 'Question about our service contract renewal',
      snippet:
        'Hi, can you send over the updated pricing for our copier fleet? We need a proposal by Friday. Thanks!',
    },
    {
      messageId: `sample-fyi-${seed}`,
      threadId: `thread-fyi-${seed}`,
      from: 'noreply@newsletter.example.com',
      subject: 'FYI: Your monthly usage report is ready',
      snippet: 'Your usage report for last month is now available in the portal. No action needed.',
    },
    {
      messageId: `sample-spam-${seed}`,
      threadId: `thread-spam-${seed}`,
      from: 'deals@promo.example.com',
      subject: 'Congratulations! You won a free vacation prize - act now',
      snippet: 'Click here to claim your free prize before this unsubscribe offer expires!!!',
    },
  ];
}

/**
 * Build the rep's voice fingerprint from their last ~50 sent emails. STUB: a
 * deterministic fingerprint from injected samples.
 * TODO: derive from the rep's real sent mail.
 */
async function buildVoiceFingerprint(account: {
  emailAddress: string | null;
}): Promise<VoiceFingerprint> {
  // TODO: derive tone/length/signature from the rep's real last-50-sent mail.
  const name = (account.emailAddress ?? 'there').split('@')[0];
  return {
    tone: 'warm-professional',
    avgSentenceLength: 14,
    signature: `Best regards,\n${name}`,
    sampleCount: 50,
  };
}

/**
 * Create the reply as a DRAFT in the rep's provider mailbox. STUB: returns a
 * fake external draft id. NEVER sends.
 * TODO: real provider create-draft API (create-draft scope only — never send).
 */
async function createProviderDraft(
  account: { provider: string },
  _draft: { subject: string; body: string; threadId: string },
): Promise<string | null> {
  // TODO: real provider create-draft API (create-draft scope only — never send).
  void account;
  void _draft;
  return `draft-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// ---------------------------------------------------------------------------
// Classification + drafting (Claude with deterministic fallback)
// ---------------------------------------------------------------------------

const SPAM_KEYWORDS = [
  'congratulations',
  'free prize',
  'act now',
  'click here',
  'unsubscribe offer',
];
const FYI_KEYWORDS = ['fyi', 'no action needed', 'newsletter', 'report is ready', 'do not reply'];

function fallbackClassify(email: InboxEmail): Classification {
  const hay = `${email.subject} ${email.snippet} ${email.from}`.toLowerCase();
  if (SPAM_KEYWORDS.some((k) => hay.includes(k))) {
    return { classification: 'spam', confidence: 0.6, source: 'fallback' };
  }
  if (FYI_KEYWORDS.some((k) => hay.includes(k))) {
    return { classification: 'fyi', confidence: 0.6, source: 'fallback' };
  }
  return { classification: 'needs_reply', confidence: 0.55, source: 'fallback' };
}

/**
 * Classify an inbound email needs_reply | fyi | spam via Claude; deterministic
 * keyword heuristic fallback on any failure / missing key.
 */
async function classifyEmail(email: InboxEmail): Promise<Classification> {
  try {
    if (!process.env.CLAUDE_API_KEY) return fallbackClassify(email);
    const prompt =
      'Classify this inbound work email. Return ONLY a JSON object ' +
      '{"classification":"needs_reply"|"fyi"|"spam","confidence":0..1}, no prose.\n\n' +
      `From: ${email.from}\nSubject: ${email.subject}\nSnippet: ${email.snippet}`;
    const text = await ClaudeAIService.generateCompletion({
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallbackClassify(email);
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const cls = String(parsed.classification);
    if (!(EMAIL_CLASSIFICATIONS as readonly string[]).includes(cls)) return fallbackClassify(email);
    const conf =
      typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence);
    return {
      classification: cls as (typeof EMAIL_CLASSIFICATIONS)[number],
      confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.7,
      source: 'ai',
    };
  } catch (err) {
    log.warn('classifyEmail failed; using fallback (offline-safe):', err as any);
    return fallbackClassify(email);
  }
}

function fallbackDraft(
  email: InboxEmail,
  fingerprint: VoiceFingerprint,
  crmContext: string | null,
): DraftedReply {
  const subject = email.subject.toLowerCase().startsWith('re:')
    ? email.subject
    : `Re: ${email.subject}`;
  const sig = fingerprint.signature ?? 'Best regards';
  const ctx = crmContext ? `\n\n(For context on our account: ${crmContext})` : '';
  const body =
    `Hi,\n\n` +
    `Thanks for reaching out about "${email.subject}". ` +
    `I've reviewed your note and will follow up shortly with the details you asked for.${ctx}\n\n` +
    `Please let me know if there's anything else I can help with in the meantime.\n\n` +
    `${sig}`;
  return { subject, body, source: 'fallback' };
}

/**
 * Draft a reply in the rep's voice via Claude; deterministic templated fallback
 * on any failure / missing key. The draft is created in the rep's mailbox for
 * review — it is NEVER sent automatically.
 */
async function draftReply(
  email: InboxEmail,
  fingerprint: VoiceFingerprint,
  crmContext: string | null,
): Promise<DraftedReply> {
  try {
    if (!process.env.CLAUDE_API_KEY) return fallbackDraft(email, fingerprint, crmContext);
    const prompt =
      "Draft a reply to the inbound email below, matching the sales rep's voice. " +
      `Tone: ${fingerprint.tone}. Avg sentence length: ${fingerprint.avgSentenceLength} words. ` +
      `Sign off exactly as: ${fingerprint.signature}. ` +
      (crmContext ? `CRM context about the sender's account: ${crmContext}. ` : '') +
      'Cite the inbound subject. Do NOT send anything — this is a draft for human review. ' +
      'Return ONLY a JSON object {"subject":string,"body":string}, no prose.\n\n' +
      `From: ${email.from}\nSubject: ${email.subject}\nSnippet: ${email.snippet}`;
    const text = await ClaudeAIService.generateCompletion({
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallbackDraft(email, fingerprint, crmContext);
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const subject =
      typeof parsed.subject === 'string' && parsed.subject
        ? parsed.subject
        : `Re: ${email.subject}`;
    const body = typeof parsed.body === 'string' && parsed.body ? parsed.body : '';
    if (!body) return fallbackDraft(email, fingerprint, crmContext);
    return { subject, body, source: 'ai' };
  } catch (err) {
    log.warn('draftReply failed; using fallback (offline-safe):', err as any);
    return fallbackDraft(email, fingerprint, crmContext);
  }
}

// ---------------------------------------------------------------------------
// Edit-distance (Levenshtein → % changed)
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Levenshtein-based percentage (0..100) of how much the rep changed the draft. */
function editDistancePct(a: string, b: string): number {
  const original = a ?? '';
  const edited = b ?? '';
  const denom = Math.max(original.length, edited.length);
  if (denom === 0) return 0;
  const dist = levenshtein(original, edited);
  return Math.round((dist / denom) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Account helpers
// ---------------------------------------------------------------------------

async function getOrCreateAccount(tenantId: string, userId: string) {
  const existing = await db.query.emailAutopilotAccounts.findFirst({
    where: and(
      eq(emailAutopilotAccounts.tenantId, tenantId),
      eq(emailAutopilotAccounts.userId, userId),
    ),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(emailAutopilotAccounts)
    .values({ tenantId, userId, provider: 'gmail', enabled: false })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.emailAutopilotAccounts.findFirst({
    where: and(
      eq(emailAutopilotAccounts.tenantId, tenantId),
      eq(emailAutopilotAccounts.userId, userId),
    ),
  });
}

/** Public account projection — tokensSet boolean, NEVER raw tokens. */
function projectAccount(row: {
  provider: string;
  emailAddress: string | null;
  encryptedTokens: unknown;
  voiceFingerprint: unknown;
  enabled: boolean;
  lastScanAt: Date | null;
}) {
  const tokens = (row.encryptedTokens ?? {}) as Record<string, unknown>;
  return {
    provider: row.provider,
    emailAddress: row.emailAddress,
    enabled: row.enabled,
    lastScanAt: row.lastScanAt,
    tokensSet:
      (typeof tokens.accessToken === 'string' && tokens.accessToken.length > 0) ||
      (typeof tokens.refreshToken === 'string' && tokens.refreshToken.length > 0),
    voiceFingerprintSet: !!row.voiceFingerprint,
  };
}

function audit(
  action:
    | 'CONNECT'
    | 'UPDATE_SETTINGS'
    | 'SCAN'
    | 'DRAFT_CREATED'
    | 'ACCEPT'
    | 'REJECT'
    | 'SUPPRESS'
    | 'UNSUPPRESS',
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
    '[AUDIT] email-autopilot',
  );
}

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const connectSchema = z.object({
  provider: z.enum(['gmail', 'outlook']),
  emailAddress: z.string().email(),
  accessToken: z.string().min(1).optional(),
  refreshToken: z.string().min(1).optional(),
});

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
});

const acceptSchema = z.object({
  finalBody: z.string().max(8000).optional(),
});

const suppressSchema = z.object({
  contactEmail: z.string().email(),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerEmailAutopilotRoutes(app: Express) {
  /** GET /api/email-autopilot/account — the caller's account (no raw tokens). */
  app.get('/api/email-autopilot/account', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      if (!userId) return res.status(400).json({ message: 'User ID is required' });

      const account = await getOrCreateAccount(tenantId, userId);
      if (!account) return res.status(500).json({ message: 'Failed to load account' });
      res.json(projectAccount(account));
    } catch (error: any) {
      log.error('Failed to load account:', error);
      res.status(500).json({ message: 'Failed to load account', error: error?.message });
    }
  });

  /**
   * POST /api/email-autopilot/connect
   * Connect the rep's mailbox. There is NO real OAuth here — pasted tokens are
   * obfuscated into encryptedTokens (never echoed) and a voice fingerprint is
   * built + cached. Connected scope is read + create-draft ONLY — never send.
   */
  app.post('/api/email-autopilot/connect', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      if (!userId) return res.status(400).json({ message: 'User ID is required' });

      const parsed = connectSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      const current = await getOrCreateAccount(tenantId, userId);
      if (!current) return res.status(500).json({ message: 'Failed to load account' });

      // TODO: real Gmail/Outlook OAuth (read + create-draft scope ONLY — never send).
      const tokens: Record<string, unknown> = {
        ...((current.encryptedTokens ?? {}) as Record<string, unknown>),
      };
      if (parsed.data.accessToken !== undefined)
        tokens.accessToken = obfuscateCredential(parsed.data.accessToken);
      if (parsed.data.refreshToken !== undefined)
        tokens.refreshToken = obfuscateCredential(parsed.data.refreshToken);

      const fingerprint = await buildVoiceFingerprint({ emailAddress: parsed.data.emailAddress });

      const [updated] = await db
        .update(emailAutopilotAccounts)
        .set({
          provider: parsed.data.provider,
          emailAddress: parsed.data.emailAddress,
          encryptedTokens: tokens,
          voiceFingerprint: fingerprint,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(emailAutopilotAccounts.tenantId, tenantId),
            eq(emailAutopilotAccounts.userId, userId),
          ),
        )
        .returning();

      audit('CONNECT', {
        tenantId,
        userId,
        extra: {
          provider: parsed.data.provider,
          accessTokenSet: parsed.data.accessToken !== undefined,
          refreshTokenSet: parsed.data.refreshToken !== undefined,
        },
      });

      res.json({ connected: true, ...projectAccount(updated) });
    } catch (error: any) {
      log.error('Failed to connect mailbox:', error);
      res.status(500).json({ message: 'Failed to connect mailbox', error: error?.message });
    }
  });

  /** PUT /api/email-autopilot/settings — { enabled? } feature-flag/opt-in toggle. */
  app.put('/api/email-autopilot/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      if (!userId) return res.status(400).json({ message: 'User ID is required' });

      const parsed = settingsSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      await getOrCreateAccount(tenantId, userId);

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;

      const [updated] = await db
        .update(emailAutopilotAccounts)
        .set(updates)
        .where(
          and(
            eq(emailAutopilotAccounts.tenantId, tenantId),
            eq(emailAutopilotAccounts.userId, userId),
          ),
        )
        .returning();

      audit('UPDATE_SETTINGS', { tenantId, userId, extra: { enabled: parsed.data.enabled } });
      res.json(projectAccount(updated));
    } catch (error: any) {
      log.error('Failed to update settings:', error);
      res.status(500).json({ message: 'Failed to update settings', error: error?.message });
    }
  });

  /**
   * POST /api/email-autopilot/scan
   * The overnight scan (cron-callable). Requires an enabled account. fetchInbox →
   * classify each email; for a needs_reply that isn't from a suppressed contact
   * and has no existing draft for that messageId → match CRM contact (best-effort),
   * draftReply, createProviderDraft, insert a draft row (status 'draft').
   * THIS NEVER SENDS — it only creates drafts in the rep's mailbox for review.
   */
  app.post('/api/email-autopilot/scan', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      if (!userId) return res.status(400).json({ message: 'User ID is required' });

      const account = await getOrCreateAccount(tenantId, userId);
      if (!account) return res.status(500).json({ message: 'Failed to load account' });
      if (!account.enabled) {
        return res.json({ skipped: true, reason: 'email autopilot disabled for this rep' });
      }

      const fingerprint = (account.voiceFingerprint ??
        (await buildVoiceFingerprint({ emailAddress: account.emailAddress }))) as VoiceFingerprint;

      const inbox = await fetchInbox({
        emailAddress: account.emailAddress,
        provider: account.provider,
      });

      // Suppressed contacts for this rep.
      const suppressions = await db
        .select({ contactEmail: emailAutopilotSuppressions.contactEmail })
        .from(emailAutopilotSuppressions)
        .where(
          and(
            eq(emailAutopilotSuppressions.tenantId, tenantId),
            eq(emailAutopilotSuppressions.userId, userId),
          ),
        );
      const suppressed = new Set(suppressions.map((s) => (s.contactEmail ?? '').toLowerCase()));

      // Existing drafts (dedupe by providerMessageId for this rep).
      const existing = await db
        .select({ providerMessageId: emailAutopilotDrafts.providerMessageId })
        .from(emailAutopilotDrafts)
        .where(
          and(eq(emailAutopilotDrafts.tenantId, tenantId), eq(emailAutopilotDrafts.userId, userId)),
        );
      const alreadyDrafted = new Set(
        existing.map((d) => d.providerMessageId).filter((v): v is string => !!v),
      );

      let scanned = 0;
      let drafted = 0;
      let skippedSuppressed = 0;
      let skippedFyiSpam = 0;

      for (const email of inbox) {
        scanned++;
        const fromEmail = (email.from ?? '').toLowerCase();

        const classification = await classifyEmail(email);
        if (classification.classification !== 'needs_reply') {
          skippedFyiSpam++;
          continue;
        }
        if (suppressed.has(fromEmail)) {
          skippedSuppressed++;
          continue;
        }
        if (alreadyDrafted.has(email.messageId)) {
          continue;
        }

        // Best-effort CRM contact match by primary_contact_email.
        let crmContactId: string | null = null;
        let crmContext: string | null = null;
        if (fromEmail) {
          const contact = await db
            .select({ id: businessRecords.id, companyName: businessRecords.companyName })
            .from(businessRecords)
            .where(
              and(
                eq(businessRecords.tenantId, tenantId),
                eq(businessRecords.primaryContactEmail, email.from),
              ),
            )
            .limit(1);
          if (contact[0]) {
            crmContactId = contact[0].id;
            crmContext = contact[0].companyName ?? null;
          }
        }

        const reply = await draftReply(email, fingerprint, crmContext);
        const externalDraftId = await createProviderDraft(
          { provider: account.provider },
          { subject: reply.subject, body: reply.body, threadId: email.threadId },
        );

        const [row] = await db
          .insert(emailAutopilotDrafts)
          .values({
            tenantId,
            userId,
            providerMessageId: email.messageId,
            threadId: email.threadId,
            contactEmail: email.from,
            crmContactId,
            classification: classification.classification,
            classificationConfidence: classification.confidence,
            inboundSubject: email.subject,
            inboundSnippet: email.snippet,
            draftSubject: reply.subject,
            draftBody: reply.body,
            draftSource: reply.source,
            externalDraftId,
            status: 'draft',
          })
          .returning({ id: emailAutopilotDrafts.id });

        drafted++;
        alreadyDrafted.add(email.messageId);

        // [AUDIT] every draft creation — include the prompt-shaping context + a
        // draft snippet + the outcome (drafted in the rep's mailbox, never sent).
        audit('DRAFT_CREATED', {
          tenantId,
          userId,
          extra: {
            draftId: row?.id,
            messageId: email.messageId,
            classification: classification.classification,
            confidence: classification.confidence,
            draftSource: reply.source,
            crmContactId,
            inboundSubject: email.subject,
            draftSnippet: reply.body.slice(0, 200),
            externalDraftId,
            outcome: 'drafted_in_mailbox_pending_review_never_sent',
          },
        });
      }

      await db
        .update(emailAutopilotAccounts)
        .set({ lastScanAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(emailAutopilotAccounts.tenantId, tenantId),
            eq(emailAutopilotAccounts.userId, userId),
          ),
        );

      audit('SCAN', {
        tenantId,
        userId,
        extra: { scanned, drafted, skippedSuppressed, skippedFyiSpam },
      });

      res.json({ scanned, drafted, skippedSuppressed, skippedFyiSpam });
    } catch (error: any) {
      log.error('Scan failed:', error);
      res.status(500).json({ message: 'Failed to scan inbox', error: error?.message });
    }
  });

  /**
   * GET /api/email-autopilot/drafts?status=
   * The caller's drafts (default 'draft'), newest first, with a toneMiss flag
   * where editDistancePct > 50.
   */
  app.get('/api/email-autopilot/drafts', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      if (!userId) return res.status(400).json({ message: 'User ID is required' });

      const status = typeof req.query.status === 'string' ? req.query.status : 'draft';
      const conditions = [
        eq(emailAutopilotDrafts.tenantId, tenantId),
        eq(emailAutopilotDrafts.userId, userId),
      ];
      if (status && status !== 'all') {
        conditions.push(eq(emailAutopilotDrafts.status, status));
      }

      const rows = await db
        .select()
        .from(emailAutopilotDrafts)
        .where(and(...conditions))
        .orderBy(desc(emailAutopilotDrafts.createdAt))
        .limit(500);

      const data = rows.map((r) => ({
        ...r,
        toneMiss: r.editDistancePct != null && r.editDistancePct > TONE_MISS_THRESHOLD,
      }));
      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to list drafts:', error);
      res.status(500).json({ message: 'Failed to list drafts', error: error?.message });
    }
  });

  /** GET /api/email-autopilot/drafts/:id — single draft + thread context. */
  app.get('/api/email-autopilot/drafts/:id', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      if (!userId) return res.status(400).json({ message: 'User ID is required' });

      const row = await db.query.emailAutopilotDrafts.findFirst({
        where: and(
          eq(emailAutopilotDrafts.id, req.params.id),
          eq(emailAutopilotDrafts.tenantId, tenantId),
          eq(emailAutopilotDrafts.userId, userId),
        ),
      });
      if (!row) return res.status(404).json({ message: 'Draft not found' });

      res.json({
        ...row,
        toneMiss: row.editDistancePct != null && row.editDistancePct > TONE_MISS_THRESHOLD,
      });
    } catch (error: any) {
      log.error('Failed to load draft:', error);
      res.status(500).json({ message: 'Failed to load draft', error: error?.message });
    }
  });

  /**
   * POST /api/email-autopilot/drafts/:id/accept
   * Records that the rep accepted/edited the draft (status 'accepted', finalBody,
   * editDistancePct, reviewedAt). THIS DOES NOT SEND — the draft remains in the
   * rep's mailbox and the rep presses Send themselves in Gmail/Outlook.
   */
  app.post(
    '/api/email-autopilot/drafts/:id/accept',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
        if (!userId) return res.status(400).json({ message: 'User ID is required' });

        const parsed = acceptSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }

        const draft = await db.query.emailAutopilotDrafts.findFirst({
          where: and(
            eq(emailAutopilotDrafts.id, req.params.id),
            eq(emailAutopilotDrafts.tenantId, tenantId),
            eq(emailAutopilotDrafts.userId, userId),
          ),
        });
        if (!draft) return res.status(404).json({ message: 'Draft not found' });

        const finalBody = parsed.data.finalBody ?? draft.draftBody ?? '';
        const pct = editDistancePct(draft.draftBody ?? '', finalBody);

        const [updated] = await db
          .update(emailAutopilotDrafts)
          .set({
            status: 'accepted',
            finalBody,
            editDistancePct: pct,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(emailAutopilotDrafts.id, req.params.id),
              eq(emailAutopilotDrafts.tenantId, tenantId),
              eq(emailAutopilotDrafts.userId, userId),
            ),
          )
          .returning();

        audit('ACCEPT', {
          tenantId,
          userId,
          extra: {
            draftId: req.params.id,
            editDistancePct: pct,
            toneMiss: pct > TONE_MISS_THRESHOLD,
            inboundSubject: draft.inboundSubject,
            draftSnippet: (draft.draftBody ?? '').slice(0, 200),
            finalSnippet: finalBody.slice(0, 200),
            // Accepting records the edit only — the rep sends from their own mail client.
            outcome: 'accepted_saved_as_draft_not_sent',
          },
        });

        res.json({
          ...updated,
          toneMiss: pct > TONE_MISS_THRESHOLD,
        });
      } catch (error: any) {
        log.error('Failed to accept draft:', error);
        res.status(500).json({ message: 'Failed to accept draft', error: error?.message });
      }
    },
  );

  /** POST /api/email-autopilot/drafts/:id/reject — status 'rejected'. */
  app.post(
    '/api/email-autopilot/drafts/:id/reject',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
        if (!userId) return res.status(400).json({ message: 'User ID is required' });

        const [updated] = await db
          .update(emailAutopilotDrafts)
          .set({ status: 'rejected', reviewedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(emailAutopilotDrafts.id, req.params.id),
              eq(emailAutopilotDrafts.tenantId, tenantId),
              eq(emailAutopilotDrafts.userId, userId),
            ),
          )
          .returning();
        if (!updated) return res.status(404).json({ message: 'Draft not found' });

        audit('REJECT', {
          tenantId,
          userId,
          extra: { draftId: req.params.id, outcome: 'rejected' },
        });
        res.json(updated);
      } catch (error: any) {
        log.error('Failed to reject draft:', error);
        res.status(500).json({ message: 'Failed to reject draft', error: error?.message });
      }
    },
  );

  /** GET /api/email-autopilot/suppressions — the caller's never-auto-draft list. */
  app.get(
    '/api/email-autopilot/suppressions',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
        if (!userId) return res.status(400).json({ message: 'User ID is required' });

        const rows = await db
          .select()
          .from(emailAutopilotSuppressions)
          .where(
            and(
              eq(emailAutopilotSuppressions.tenantId, tenantId),
              eq(emailAutopilotSuppressions.userId, userId),
            ),
          )
          .orderBy(desc(emailAutopilotSuppressions.createdAt));
        res.json({ data: rows, total: rows.length });
      } catch (error: any) {
        log.error('Failed to list suppressions:', error);
        res.status(500).json({ message: 'Failed to list suppressions', error: error?.message });
      }
    },
  );

  /** POST /api/email-autopilot/suppressions — { contactEmail, reason? }. */
  app.post(
    '/api/email-autopilot/suppressions',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
        if (!userId) return res.status(400).json({ message: 'User ID is required' });

        const parsed = suppressSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }

        const [row] = await db
          .insert(emailAutopilotSuppressions)
          .values({
            tenantId,
            userId,
            contactEmail: parsed.data.contactEmail,
            reason: parsed.data.reason ?? null,
          })
          .onConflictDoNothing()
          .returning();

        audit('SUPPRESS', {
          tenantId,
          userId,
          extra: { contactEmail: parsed.data.contactEmail },
        });
        res
          .status(201)
          .json(row ?? { contactEmail: parsed.data.contactEmail, alreadySuppressed: true });
      } catch (error: any) {
        log.error('Failed to suppress contact:', error);
        res.status(500).json({ message: 'Failed to suppress contact', error: error?.message });
      }
    },
  );

  /** DELETE /api/email-autopilot/suppressions/:contactEmail */
  app.delete(
    '/api/email-autopilot/suppressions/:contactEmail',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
        if (!userId) return res.status(400).json({ message: 'User ID is required' });

        await db
          .delete(emailAutopilotSuppressions)
          .where(
            and(
              eq(emailAutopilotSuppressions.tenantId, tenantId),
              eq(emailAutopilotSuppressions.userId, userId),
              eq(emailAutopilotSuppressions.contactEmail, req.params.contactEmail),
            ),
          );
        audit('UNSUPPRESS', {
          tenantId,
          userId,
          extra: { contactEmail: req.params.contactEmail },
        });
        res.json({ success: true });
      } catch (error: any) {
        log.error('Failed to remove suppression:', error);
        res.status(500).json({ message: 'Failed to remove suppression', error: error?.message });
      }
    },
  );

  /**
   * GET /api/email-autopilot/stats — { draftsReady, accepted, rejected,
   * avgEditDistancePct (over accepted), toneMissRate (% accepted > 50) }.
   */
  app.get('/api/email-autopilot/stats', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      if (!userId) return res.status(400).json({ message: 'User ID is required' });

      const rows = await db
        .select({
          status: emailAutopilotDrafts.status,
          editDistancePct: emailAutopilotDrafts.editDistancePct,
        })
        .from(emailAutopilotDrafts)
        .where(
          and(eq(emailAutopilotDrafts.tenantId, tenantId), eq(emailAutopilotDrafts.userId, userId)),
        );

      const draftsReady = rows.filter((r) => r.status === 'draft').length;
      const acceptedRows = rows.filter((r) => r.status === 'accepted');
      const accepted = acceptedRows.length;
      const rejected = rows.filter((r) => r.status === 'rejected').length;

      const dists = acceptedRows
        .map((r) => r.editDistancePct)
        .filter((n): n is number => n != null && Number.isFinite(n));
      const avgEditDistancePct =
        dists.length > 0
          ? Math.round((dists.reduce((a, b) => a + b, 0) / dists.length) * 10) / 10
          : null;
      const toneMisses = dists.filter((n) => n > TONE_MISS_THRESHOLD).length;
      const toneMissRate = accepted > 0 ? Math.round((toneMisses / accepted) * 1000) / 10 : null;

      res.json({ draftsReady, accepted, rejected, avgEditDistancePct, toneMissRate });
    } catch (error: any) {
      log.error('Failed to load stats:', error);
      res.status(500).json({ message: 'Failed to load stats', error: error?.message });
    }
  });
}
