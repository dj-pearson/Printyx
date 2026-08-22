/**
 * Daily briefing generation and scheduling.
 *
 * Assembles the per-role briefing sections, renders and sends them, records
 * daily_briefing_log / user_notifications, and exposes runDueDailyBriefings for
 * services/cron-service.ts to call on its schedule.
 *
 * This was the bottom two thirds of server/routes-daily-briefing.ts until
 * PROD-008b retired that module: /api/daily-briefing is proxied to
 * supabase/functions/daily-briefing/, so all six of its HTTP handlers were
 * shadowed. runDueDailyBriefings was NOT — cron-service lazy-imports it — and
 * would have died silently with the routes around it. It belongs in services/
 * either way: nothing here is HTTP.
 */
import { z } from 'zod';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { createModuleLogger } from '../lib/logger';
import ClaudeAIService from './claude-ai-service';
import { sendEmail } from './email-service';
import {
  dueBriefingUsers,
  localDateInTimeZone,
  type BriefingScheduleUser,
} from '@shared/briefing-schedule';
import { userSettings } from '@shared/schema';
import {
  dailyBriefingPreferences,
  dailyBriefingLog,
  BRIEFING_FREQUENCIES,
  BRIEFING_VARIANTS,
  BRIEFING_ROLES,
  type BriefingRole,
  type BriefingVariant,
  users,
  userNotifications,
  serviceTickets,
  proposals,
  businessRecords,
  contracts,
  inventoryItems,
  equipmentFailurePredictions,
  truckStockCallbacks,
  renewalAutoQuotes,
} from '@shared/schema';

const log = createModuleLogger('daily-briefing-scheduler');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLOSED_TICKET_STATUSES = ['completed', 'closed', 'resolved', 'cancelled'];

/** Today's tenant-local-ish date as YYYY-MM-DD (server-local; cron TODO above). */
function briefingDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Derive a briefing role from the user's legacy role string. */
function deriveRole(role: string | null | undefined): BriefingRole {
  const r = (role ?? '').toLowerCase();
  if (r.includes('owner') || r.includes('admin')) return 'owner';
  if (r.includes('service') || r.includes('tech-manager') || r.includes('dispatch'))
    return 'service_manager';
  return 'sales_rep';
}

function audit(
  action: 'GENERATE' | 'OPEN' | 'UPDATE_PREFS',
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
    '[AUDIT] daily-briefing',
  );
}

async function getOrCreatePreferences(tenantId: string, userId: string) {
  const existing = await db.query.dailyBriefingPreferences.findFirst({
    where: and(
      eq(dailyBriefingPreferences.tenantId, tenantId),
      eq(dailyBriefingPreferences.userId, userId),
    ),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(dailyBriefingPreferences)
    .values({ tenantId, userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.dailyBriefingPreferences.findFirst({
    where: and(
      eq(dailyBriefingPreferences.tenantId, tenantId),
      eq(dailyBriefingPreferences.userId, userId),
    ),
  });
}

// ---------------------------------------------------------------------------
// Per-role data assembly (best-effort; STUBs/proxies documented inline)
// ---------------------------------------------------------------------------

interface BriefingMetric {
  label: string;
  value: number | string;
  detail?: string;
}

interface BriefingSection {
  heading: string;
  metrics: BriefingMetric[];
}

interface BriefingData {
  role: BriefingRole;
  sections: BriefingSection[];
}

async function assembleOwnerData(tenantId: string): Promise<BriefingSection[]> {
  const now = Date.now();
  const dayAgo = new Date(now - 86_400_000);
  const weekAhead = new Date(now + 7 * 86_400_000);
  const thirtyDaysAhead = new Date(now + 30 * 86_400_000);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // P1 incidents: urgent tickets created in the last 24h.
  const p1Rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.tenantId, tenantId),
        eq(serviceTickets.priority, 'urgent'),
        gte(serviceTickets.createdAt, dayAgo),
      ),
    );
  const p1Count = Number(p1Rows[0]?.n ?? 0);

  // At-risk: latest churn scores in the at_risk band (count distinct customers).
  const atRiskRows = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM (
      SELECT DISTINCT ON (customer_id) band
      FROM customer_churn_scores
      WHERE tenant_id = ${tenantId}
      ORDER BY customer_id, calculated_at DESC
    ) latest
    WHERE latest.band = 'at_risk'
  `);
  const atRiskCount = Number((atRiskRows as any).rows?.[0]?.n ?? (atRiskRows as any)[0]?.n ?? 0);

  // Contracts ending within 30 days.
  const contractsEndingRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(contracts)
    .where(
      and(
        eq(contracts.tenantId, tenantId),
        eq(contracts.status, 'active'),
        gte(contracts.endDate, new Date(now)),
        lt(contracts.endDate, thirtyDaysAhead),
      ),
    );
  const contractsEnding = Number(contractsEndingRows[0]?.n ?? 0);

  // Top deals closing this week: sent/viewed proposals with validUntil within 7d.
  const closingDeals = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      totalAmount: proposals.totalAmount,
      validUntil: proposals.validUntil,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.tenantId, tenantId),
        inArray(proposals.status, ['sent', 'viewed']),
        gte(proposals.validUntil, new Date(now)),
        lt(proposals.validUntil, weekAhead),
      ),
    );
  const topDeals = closingDeals
    .map((d) => ({ title: d.title, amount: num(d.totalAmount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Revenue vs target MTD: STUB — sum accepted proposals this month; no target table.
  const acceptedRows = await db
    .select({ totalAmount: proposals.totalAmount })
    .from(proposals)
    .where(
      and(
        eq(proposals.tenantId, tenantId),
        eq(proposals.status, 'accepted'),
        gte(proposals.acceptedAt, monthStart),
      ),
    );
  const revenueMtd = acceptedRows.reduce((a, r) => a + num(r.totalAmount), 0);

  return [
    {
      heading: 'Urgent attention',
      metrics: [
        { label: 'P1 incidents (last 24h)', value: p1Count, detail: 'urgent service tickets' },
        {
          label: 'At-risk customers',
          value: atRiskCount,
          detail: `latest churn band "at_risk" (+ ${contractsEnding} contract(s) ending ≤30d)`,
        },
      ],
    },
    {
      heading: 'Deals closing this week',
      metrics:
        topDeals.length > 0
          ? topDeals.map((d) => ({
              label: d.title,
              value: `$${Math.round(d.amount).toLocaleString()}`,
            }))
          : [{ label: 'No deals closing this week', value: 0 }],
    },
    {
      heading: 'Revenue (MTD)',
      metrics: [
        {
          label: 'Accepted-proposal revenue MTD',
          value: `$${Math.round(revenueMtd).toLocaleString()}`,
          detail: 'STUB: no revenue-target table; vs-target unavailable',
        },
      ],
    },
  ];
}

async function assembleServiceManagerData(tenantId: string): Promise<BriefingSection[]> {
  const now = Date.now();
  const fortyEightHoursAgo = new Date(now - 48 * 3_600_000); // 48 hours
  const weekAhead = new Date(now + 7 * 86_400_000);
  const weekAgo = new Date(now - 7 * 86_400_000);

  // Open tickets older than 48h (SLA proxy): not in closed statuses + created >48h ago.
  const slaRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.tenantId, tenantId),
        sql`lower(${serviceTickets.status}) not in ('completed','closed','resolved','cancelled')`,
        lt(serviceTickets.createdAt, fortyEightHoursAgo),
      ),
    );
  const slaBreaches = Number(slaRows[0]?.n ?? 0);

  // Predicted failures next 7 days (US-SUPER-001): pending predictions with a
  // window starting within the next 7 days.
  const predRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(equipmentFailurePredictions)
    .where(
      and(
        eq(equipmentFailurePredictions.tenantId, tenantId),
        eq(equipmentFailurePredictions.status, 'pending'),
        gte(equipmentFailurePredictions.predictedWindowStart, new Date(now)),
        lt(equipmentFailurePredictions.predictedWindowStart, weekAhead),
      ),
    );
  const predictedFailures = Number(predRows[0]?.n ?? 0);

  // Parts shortages: inventory at/below reorder point.
  const shortageRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.tenantId, tenantId),
        sql`coalesce(${inventoryItems.quantityOnHand}, 0) <= coalesce(${inventoryItems.reorderPoint}, 0)`,
      ),
    );
  const partsShortages = Number(shortageRows[0]?.n ?? 0);

  // Callbacks in the last 7 days (truck-stock missing-part callbacks).
  const callbackRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(truckStockCallbacks)
    .where(
      and(eq(truckStockCallbacks.tenantId, tenantId), gte(truckStockCallbacks.createdAt, weekAgo)),
    );
  const callbacks = Number(callbackRows[0]?.n ?? 0);

  // Tech utilization: STUB — open tickets per assigned technician proxy.
  const openByTech = await db
    .select({
      tech: serviceTickets.assignedTechnicianId,
      n: sql<number>`count(*)`,
    })
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.tenantId, tenantId),
        sql`lower(${serviceTickets.status}) not in ('completed','closed','resolved','cancelled')`,
        sql`${serviceTickets.assignedTechnicianId} is not null`,
      ),
    )
    .groupBy(serviceTickets.assignedTechnicianId);
  const techsWithWork = openByTech.length;
  const totalOpenAssigned = openByTech.reduce((a, r) => a + Number(r.n ?? 0), 0);
  const avgPerTech =
    techsWithWork > 0 ? Math.round((totalOpenAssigned / techsWithWork) * 10) / 10 : 0;

  return [
    {
      heading: 'Service health',
      metrics: [
        {
          label: 'Open tickets past 48h',
          value: slaBreaches,
          detail: 'SLA proxy: open >48h since creation',
        },
        {
          label: 'Predicted failures (next 7d)',
          value: predictedFailures,
          detail: 'pending equipment-failure predictions',
        },
      ],
    },
    {
      heading: 'Parts & callbacks',
      metrics: [
        { label: 'Parts at/below reorder point', value: partsShortages },
        { label: 'Callbacks (last 7d)', value: callbacks },
      ],
    },
    {
      heading: 'Tech utilization',
      metrics: [
        {
          label: 'Avg open tickets per active tech',
          value: avgPerTech,
          detail: `STUB: tickets-per-assigned-tech proxy (${techsWithWork} tech(s) with open work)`,
        },
      ],
    },
  ];
}

async function assembleSalesRepData(tenantId: string, userId: string): Promise<BriefingSection[]> {
  const now = Date.now();
  const dayAgo = new Date(now - 86_400_000);
  const weekAgo = new Date(now - 7 * 86_400_000);
  const ninetyDaysAhead = new Date(now + 90 * 86_400_000);

  // Next-best-actions: this rep's draft/sent proposals ranked by value (top 5).
  // probability is a STUB (no scored win-probability column).
  const nextActions = await db
    .select({
      title: proposals.title,
      totalAmount: proposals.totalAmount,
      status: proposals.status,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.tenantId, tenantId),
        eq(proposals.assignedTo, userId),
        inArray(proposals.status, ['draft', 'sent']),
      ),
    )
    .orderBy(desc(proposals.totalAmount))
    .limit(5);

  // Deals stuck >7d: draft/sent proposals for this rep not updated in 7d.
  const stuckRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(proposals)
    .where(
      and(
        eq(proposals.tenantId, tenantId),
        eq(proposals.assignedTo, userId),
        inArray(proposals.status, ['draft', 'sent']),
        lt(proposals.updatedAt, weekAgo),
      ),
    );
  const stuckDeals = Number(stuckRows[0]?.n ?? 0);

  // Prospects engaged in the last 24h (tenant-scoped lead activity proxy;
  // business_records has no per-rep owner column reliably populated, so we
  // tenant-scope and note this).
  const engagedRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(businessRecords)
    .where(
      and(
        eq(businessRecords.tenantId, tenantId),
        eq(businessRecords.recordType, 'lead'),
        gte(businessRecords.updatedAt, dayAgo),
      ),
    );
  const prospectsEngaged = Number(engagedRows[0]?.n ?? 0);

  // Renewals due: renewal drafts + contracts ending within 90 days (tenant-scoped).
  const renewalDraftRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(renewalAutoQuotes)
    .where(
      and(eq(renewalAutoQuotes.tenantId, tenantId), eq(renewalAutoQuotes.status, 'renewal_draft')),
    );
  const renewalDrafts = Number(renewalDraftRows[0]?.n ?? 0);
  const renewalsDueRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(contracts)
    .where(
      and(
        eq(contracts.tenantId, tenantId),
        eq(contracts.status, 'active'),
        gte(contracts.endDate, new Date(now)),
        lt(contracts.endDate, ninetyDaysAhead),
      ),
    );
  const contractsDue = Number(renewalsDueRows[0]?.n ?? 0);

  return [
    {
      heading: 'Next best actions',
      metrics:
        nextActions.length > 0
          ? nextActions.map((a) => ({
              label: a.title,
              value: `$${Math.round(num(a.totalAmount)).toLocaleString()}`,
              detail: `${a.status} · win-probability STUB`,
            }))
          : [{ label: 'No open proposals assigned to you', value: 0 }],
    },
    {
      heading: 'Pipeline hygiene',
      metrics: [
        { label: 'Deals stuck >7 days', value: stuckDeals },
        {
          label: 'Prospects engaged (last 24h)',
          value: prospectsEngaged,
          detail: 'tenant-scoped lead activity proxy',
        },
      ],
    },
    {
      heading: 'Renewals',
      metrics: [
        {
          label: 'Renewals due',
          value: renewalDrafts + contractsDue,
          detail: `${renewalDrafts} draft(s) + ${contractsDue} contract(s) ending ≤90d`,
        },
      ],
    },
  ];
}

async function assembleData(
  tenantId: string,
  userId: string,
  role: BriefingRole,
): Promise<BriefingData> {
  let sections: BriefingSection[];
  if (role === 'owner') sections = await assembleOwnerData(tenantId);
  else if (role === 'service_manager') sections = await assembleServiceManagerData(tenantId);
  else sections = await assembleSalesRepData(tenantId, userId);
  return { role, sections };
}

// ---------------------------------------------------------------------------
// Briefing generation (Claude with deterministic fallback)
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<BriefingRole, string> = {
  owner: 'Owner',
  service_manager: 'Service Manager',
  sales_rep: 'Sales Rep',
};

interface GeneratedBriefing {
  subject: string;
  bullets: string[];
  source: 'ai' | 'fallback';
}

function flattenMetrics(data: BriefingData): string[] {
  const lines: string[] = [];
  for (const section of data.sections) {
    for (const m of section.metrics) {
      lines.push(`${section.heading} — ${m.label}: ${m.value}${m.detail ? ` (${m.detail})` : ''}`);
    }
  }
  return lines;
}

function buildFallback(data: BriefingData, date: string): GeneratedBriefing {
  const roleLabel = ROLE_LABELS[data.role];
  const bullets: string[] = [];
  for (const section of data.sections) {
    for (const m of section.metrics) {
      bullets.push(`${m.label}: ${m.value}${m.detail ? ` — ${m.detail}` : ''}`);
    }
  }
  return {
    subject: `${roleLabel} morning briefing — ${date}`,
    bullets,
    source: 'fallback',
  };
}

async function generateBriefing(
  data: BriefingData,
  variant: BriefingVariant,
  date: string,
): Promise<GeneratedBriefing> {
  const fallback = buildFallback(data, date);
  try {
    const roleLabel = ROLE_LABELS[data.role];
    const metricLines = flattenMetrics(data).join('\n');
    const variantInstruction =
      variant === 'narrative'
        ? 'Lead with a short (1-2 sentence) narrative framing the day, THEN the bullets.'
        : 'Lead with the hard figures; put the most important numbers first.';
    const prompt =
      `You are an assistant writing a CONCISE morning briefing for a copier-dealer ` +
      `${roleLabel} for ${date}.\n` +
      `Use ONLY these assembled figures (do not invent numbers):\n${metricLines}\n\n` +
      `${variantInstruction}\n` +
      `Keep the whole briefing under 400 words. Be actionable and specific.\n` +
      `Return ONLY JSON: {"subject": string, "bullets": string[]}. ` +
      `subject must be a short, scannable email subject line.`;

    const text = await ClaudeAIService.generateCompletion({
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (
        parsed &&
        typeof parsed.subject === 'string' &&
        Array.isArray(parsed.bullets) &&
        parsed.bullets.every((b: unknown) => typeof b === 'string') &&
        parsed.bullets.length > 0
      ) {
        return { subject: parsed.subject, bullets: parsed.bullets, source: 'ai' };
      }
    }
    return fallback;
  } catch (error: any) {
    log.warn({ err: error?.message }, 'AI briefing unavailable; using deterministic fallback');
    return fallback;
  }
}

function wordCount(bullets: string[], subject: string): number {
  return [subject, ...bullets].join(' ').trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const generateSchema = z.object({
  userId: z.string().min(1).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
  force: z.boolean().optional(),
  all: z.boolean().optional(),
});

const prefsSchema = z.object({
  frequency: z.enum(BRIEFING_FREQUENCIES).optional(),
  abVariant: z.enum(BRIEFING_VARIANTS).optional(),
  role: z.enum(BRIEFING_ROLES).optional(),
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Per-user generation (shared by the HTTP endpoint and the cron)
// ---------------------------------------------------------------------------

interface BriefingTargetUser {
  id: string;
  email: string | null;
  role: string | null;
}

interface BriefingGenOutcome {
  generated: boolean;
  skippedOff: boolean;
  emailed: boolean;
  inApp: boolean;
}

/** Generate + deliver one user's briefing for `date`. */
async function generateBriefingForUser(
  tenantId: string,
  u: BriefingTargetUser,
  date: string,
  force: boolean,
): Promise<BriefingGenOutcome> {
  const prefs = await getOrCreatePreferences(tenantId, u.id);
  if (!prefs) return { generated: false, skippedOff: false, emailed: false, inApp: false };
  if (prefs.frequency === 'off' && !force) {
    return { generated: false, skippedOff: true, emailed: false, inApp: false };
  }

  const role = (prefs.role as BriefingRole | null) ?? deriveRole(u.role);
  const variant = (prefs.abVariant as BriefingVariant) ?? 'numbers';

  const data = await assembleData(tenantId, u.id, role);
  const briefing = await generateBriefing(data, variant, date);

  const content = {
    role,
    variant,
    sections: data.sections,
    bullets: briefing.bullets,
    links: [{ label: 'Open briefings', url: '/briefings' }],
    wordCount: wordCount(briefing.bullets, briefing.subject),
    source: briefing.source,
  };

  // In-app badge (best-effort: user_notifications tenant_id is uuid + enums).
  let inAppSent = false;
  if (prefs.inAppEnabled) {
    try {
      await db.insert(userNotifications).values({
        tenantId: tenantId as any,
        userId: u.id,
        type: 'daily_briefing',
        priority: 'medium',
        category: 'system',
        title: briefing.subject,
        message: briefing.bullets[0] ?? 'Your morning briefing is ready.',
        actionUrl: '/briefings',
      });
      inAppSent = true;
    } catch (err: any) {
      log.warn(
        { err: err?.message, userId: u.id },
        'In-app briefing notification insert failed (non-fatal)',
      );
    }
  }

  // Email (best-effort).
  let emailSent = false;
  if (prefs.emailEnabled && u.email) {
    try {
      const html = `<h2>${briefing.subject}</h2><ul>${briefing.bullets
        .map((b) => `<li>${b}</li>`)
        .join('')}</ul>`;
      const result = await sendEmail({
        to: u.email,
        subject: briefing.subject,
        html,
        text: briefing.bullets.join('\n'),
      });
      emailSent = !!result?.success;
    } catch (err: any) {
      log.warn({ err: err?.message, userId: u.id }, 'Briefing email send failed (non-fatal)');
    }
  }

  await db.insert(dailyBriefingLog).values({
    tenantId,
    userId: u.id,
    role,
    briefingDate: date,
    variant,
    subject: briefing.subject,
    emailSent,
    inAppSent,
    content,
  });

  await db
    .update(dailyBriefingPreferences)
    .set({ lastSentAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(dailyBriefingPreferences.tenantId, tenantId),
        eq(dailyBriefingPreferences.userId, u.id),
      ),
    );

  return { generated: true, skippedOff: false, emailed: emailSent, inApp: inAppSent };
}

/**
 * Cron entry (US-SUPER-015 AC1): hourly tick that generates briefings for every
 * active user whose LOCAL time is 6am (user_settings.timezone), respecting the
 * per-user frequency (daily/weekly/off) and same-day dedupe. Called from
 * CronService; safe to run hourly because lastSentAt dedupes within the day.
 */
export async function runDueDailyBriefings(now: Date = new Date()): Promise<{
  candidates: number;
  due: number;
  generated: number;
  emailed: number;
  inApp: number;
}> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      tenantId: users.tenantId,
      timezone: userSettings.timezone,
      frequency: dailyBriefingPreferences.frequency,
      lastSentAt: dailyBriefingPreferences.lastSentAt,
    })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .leftJoin(
      dailyBriefingPreferences,
      and(
        eq(dailyBriefingPreferences.userId, users.id),
        eq(dailyBriefingPreferences.tenantId, users.tenantId),
      ),
    )
    .where(eq(users.isActive, true));

  // Resolve same-day dedupe against each user's local last-sent date.
  const candidates = rows.map((r) => ({
    ...r,
    lastSentDate: r.lastSentAt
      ? localDateInTimeZone(r.lastSentAt, r.timezone || 'America/New_York')
      : null,
  }));
  const due = dueBriefingUsers(
    candidates as Array<(typeof candidates)[number] & BriefingScheduleUser>,
    now,
  );

  let generated = 0;
  let emailed = 0;
  let inApp = 0;
  for (const u of due) {
    if (!u.tenantId) continue;
    try {
      const date = localDateInTimeZone(now, u.timezone || 'America/New_York');
      const r = await generateBriefingForUser(
        u.tenantId,
        { id: u.id, email: u.email, role: u.role },
        date,
        false,
      );
      if (r.generated) generated++;
      if (r.emailed) emailed++;
      if (r.inApp) inApp++;
    } catch (err: any) {
      log.warn(
        { err: err?.message, userId: u.id },
        'Scheduled briefing generation failed (non-fatal)',
      );
    }
  }

  log.info(
    { candidates: rows.length, due: due.length, generated, emailed, inApp },
    '[CRON] daily briefings tick',
  );
  return { candidates: rows.length, due: due.length, generated, emailed, inApp };
}
