/**
 * Auto-Generated QBR Decks Routes (US-SUPER-004).
 *
 * Overnight-generated per-customer Quarterly Business Review decks: usage
 * trends, downtime proxy, top issues, supply-cost proxy, AI recommendations
 * (deterministic fallback when no Claude key), and a next-quarter forecast.
 * The generator assembles real fleet/usage/service data into content_jsonb,
 * renders HTML + (best-effort) PDF, stores artifacts, and UPSERTs one row per
 * (customer, quarter). The rep reviews/edits section overrides, then sends.
 * We NEVER auto-send.
 *
 * Endpoints:
 *   POST   /api/qbr/generate              — assemble + render decks (cron-callable)
 *   GET    /api/qbr                       — list (?customerId= ?quarter= ?status=)
 *   GET    /api/qbr/suppressions          — list suppressed customers
 *   POST   /api/qbr/suppressions          — flag a customer "no QBRs"
 *   DELETE /api/qbr/suppressions/:customerId
 *   GET    /api/qbr/:id                   — single deck + companyName
 *   PATCH  /api/qbr/:id                   — review: status->reviewed + sectionOverrides
 *   POST   /api/qbr/:id/send              — flip to 'sent' (email send is a STUB)
 *
 * Schema: shared/qbr-schema.ts (re-exported from shared/schema.ts).
 * Auth: requireAuth + tenant scoping on every query.
 * TODO(rbac): requirePermission(['sales.qbr.manage']) once it exists.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import ClaudeAIService from './services/claude-ai-service';
import {
  qbrReports,
  qbrSuppressions,
  QBR_STATUSES,
  businessRecords,
  equipment,
  meterReadings,
  serviceTickets,
  contracts,
} from '@shared/schema';

const log = createModuleLogger('routes-qbr');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Current quarter as "YYYY-Qn" (month is 0-based). */
function currentQuarter(d = new Date()): string {
  const y = d.getFullYear();
  const month = d.getMonth();
  return `${y}-Q${Math.floor(month / 3) + 1}`;
}

/** Parse "YYYY-Qn" into a [start, end) Date pair. */
function quarterRange(quarter: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarter);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const q = parseInt(m[2], 10);
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 1));
  return { start, end };
}

/** The four quarters ending with (and including) `quarter`, oldest first. */
function lastFourQuarters(quarter: string): string[] {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarter);
  if (!m) return [quarter];
  let year = parseInt(m[1], 10);
  let q = parseInt(m[2], 10);
  const out: string[] = [];
  for (let i = 0; i < 4; i++) {
    out.unshift(`${year}-Q${q}`);
    q -= 1;
    if (q < 1) {
      q = 4;
      year -= 1;
    }
  }
  return out;
}

function audit(
  action: 'GENERATE' | 'REVIEW' | 'SEND' | 'SUPPRESS' | 'UNSUPPRESS',
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
    '[AUDIT] qbr',
  );
}

// ---------------------------------------------------------------------------
// Content assembly types
// ---------------------------------------------------------------------------

interface UsageTrendPoint {
  quarter: string;
  black: number;
  color: number;
  total: number;
}

interface DowntimePoint {
  equipmentId: string;
  serial: string | null;
  model: string | null;
  ticketCount: number;
  open: number;
  closed: number;
}

interface QbrContent {
  cover: { companyName: string | null; quarter: string; assignedSalesRep: string | null };
  fleet: Array<{
    equipmentId: string;
    serial: string | null;
    model: string | null;
    manufacturer: string | null;
  }>;
  usageTrend: UsageTrendPoint[];
  downtimeByMachine: DowntimePoint[];
  downtimeNote: string;
  topIssues: Array<{ title: string; count: number }>;
  supplyCost: { estimatedQuarterly: number; note: string };
  recommendations: string[];
  recommendationsSource: 'ai' | 'fallback';
  forecast: {
    nextQuarter: string;
    projectedBlack: number;
    projectedColor: number;
    projectedTotal: number;
    note: string;
  };
  sectionOverrides: Record<string, string>;
}

// ---------------------------------------------------------------------------
// AI recommendations (with deterministic, data-cited fallback)
// ---------------------------------------------------------------------------

function buildFallbackRecommendations(
  content: Omit<QbrContent, 'recommendations' | 'recommendationsSource'>,
): string[] {
  const recs: string[] = [];
  const trend = content.usageTrend;
  if (trend.length >= 2) {
    const prev = trend[trend.length - 2];
    const curr = trend[trend.length - 1];
    const colorDelta = prev.color > 0 ? ((curr.color - prev.color) / prev.color) * 100 : 0;
    const totalDelta = prev.total > 0 ? ((curr.total - prev.total) / prev.total) * 100 : 0;
    if (colorDelta >= 10) {
      recs.push(
        `Color volume up ${Math.round(colorDelta)}% Q-over-Q (${prev.color.toLocaleString()} → ${curr.color.toLocaleString()}) — consider a color-shift plan or a higher color tier.`,
      );
    } else if (colorDelta <= -10) {
      recs.push(
        `Color volume down ${Math.round(Math.abs(colorDelta))}% Q-over-Q — review whether a lower color commitment fits.`,
      );
    }
    if (totalDelta >= 15) {
      recs.push(
        `Total print volume up ${Math.round(totalDelta)}% Q-over-Q — fleet may be under-tiered; propose a re-tier at renewal.`,
      );
    }
  }
  const noisy = content.downtimeByMachine
    .filter((d) => d.ticketCount >= 3)
    .sort((a, b) => b.ticketCount - a.ticketCount)[0];
  if (noisy) {
    recs.push(
      `${noisy.serial || noisy.model || 'A device'} logged ${noisy.ticketCount} service tickets this quarter — pitch a replacement/upgrade to cut downtime.`,
    );
  }
  if (content.topIssues.length > 0) {
    recs.push(
      `Most frequent issue: "${content.topIssues[0].title}" (${content.topIssues[0].count}x) — proactively address before the review.`,
    );
  }
  if (content.fleet.length > 0) {
    recs.push(
      `Fleet of ${content.fleet.length} device(s) under review — confirm all are on the optimal supply + service plan.`,
    );
  }
  if (recs.length === 0) {
    recs.push(
      'No notable usage or service signals this quarter — reaffirm the relationship and confirm satisfaction.',
    );
  }
  return recs;
}

async function generateRecommendations(
  content: Omit<QbrContent, 'recommendations' | 'recommendationsSource'>,
): Promise<{ recommendations: string[]; source: 'ai' | 'fallback' }> {
  const fallback = buildFallbackRecommendations(content);
  try {
    const trend = content.usageTrend
      .map((t) => `${t.quarter}: ${t.black} B/W, ${t.color} color (${t.total} total)`)
      .join('; ');
    const issues = content.topIssues.map((i) => `${i.title} (${i.count}x)`).join(', ');
    const prompt =
      `You are a copier-dealer account manager preparing a Quarterly Business Review for ` +
      `${content.cover.companyName ?? 'a customer'} for ${content.cover.quarter}.\n` +
      `Fleet size: ${content.fleet.length} devices.\n` +
      `Usage trend (last 4 quarters): ${trend || 'no data'}.\n` +
      `Top service issues: ${issues || 'none'}.\n` +
      `Estimated quarterly supply cost: $${content.supplyCost.estimatedQuarterly}.\n` +
      `Forecast next quarter: ${content.forecast.projectedTotal} total pages.\n\n` +
      `Write 3-5 concise, specific account recommendations. Cite the actual numbers above. ` +
      `Return ONLY a JSON array of strings, no prose.`;

    const text = await ClaudeAIService.generateCompletion({
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (
        Array.isArray(parsed) &&
        parsed.every((x) => typeof x === 'string') &&
        parsed.length > 0
      ) {
        return { recommendations: parsed, source: 'ai' };
      }
    }
    return { recommendations: fallback, source: 'fallback' };
  } catch (error: any) {
    log.warn(
      { err: error?.message },
      'AI recommendations unavailable; using deterministic fallback',
    );
    return { recommendations: fallback, source: 'fallback' };
  }
}

// ---------------------------------------------------------------------------
// HTML + PDF rendering
// ---------------------------------------------------------------------------

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderHtml(content: QbrContent): string {
  const o = content.sectionOverrides ?? {};
  const section = (key: string, fallback: string) =>
    o[key] ? `<p class="override">${esc(o[key])}</p>` : fallback;

  const usageRows = content.usageTrend
    .map(
      (t) =>
        `<tr><td>${esc(t.quarter)}</td><td class="r">${t.black.toLocaleString()}</td><td class="r">${t.color.toLocaleString()}</td><td class="r">${t.total.toLocaleString()}</td></tr>`,
    )
    .join('');
  const downtimeRows = content.downtimeByMachine
    .map(
      (d) =>
        `<tr><td>${esc(d.serial || d.equipmentId)}</td><td>${esc(d.model || '—')}</td><td class="r">${d.ticketCount}</td><td class="r">${d.open}</td><td class="r">${d.closed}</td></tr>`,
    )
    .join('');
  const issueRows = content.topIssues.map((i) => `<li>${esc(i.title)} — ${i.count}x</li>`).join('');
  const recRows = content.recommendations.map((r) => `<li>${esc(r)}</li>`).join('');
  const fleetRows = content.fleet
    .map(
      (f) =>
        `<tr><td>${esc(f.serial || f.equipmentId)}</td><td>${esc(f.model || '—')}</td><td>${esc(f.manufacturer || '—')}</td></tr>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:32px;}
  h1{font-size:26px;margin:0 0 4px;color:#0f766e;}
  h2{font-size:18px;margin:24px 0 8px;border-bottom:2px solid #0f766e;padding-bottom:4px;}
  .sub{color:#6b7280;font-size:13px;margin-bottom:16px;}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px;}
  th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;}
  th{background:#f0fdfa;}
  td.r,th.r{text-align:right;}
  ul{margin:6px 0;padding-left:20px;font-size:13px;}
  .note{color:#9ca3af;font-size:11px;font-style:italic;}
  .override{background:#fffbeb;border-left:3px solid #f59e0b;padding:6px 10px;font-size:13px;}
</style></head><body>
  <h1>Quarterly Business Review — ${esc(content.cover.quarter)}</h1>
  <div class="sub">${esc(content.cover.companyName || 'Customer')}${content.cover.assignedSalesRep ? ` · Rep: ${esc(content.cover.assignedSalesRep)}` : ''}</div>

  <h2>Fleet</h2>
  ${section('fleet', `<table><thead><tr><th>Serial</th><th>Model</th><th>Manufacturer</th></tr></thead><tbody>${fleetRows || '<tr><td colspan="3">No equipment on file.</td></tr>'}</tbody></table>`)}

  <h2>Usage Trend (last 4 quarters)</h2>
  ${section('usageTrend', `<table><thead><tr><th>Quarter</th><th class="r">B/W</th><th class="r">Color</th><th class="r">Total</th></tr></thead><tbody>${usageRows || '<tr><td colspan="4">No meter data.</td></tr>'}</tbody></table>`)}

  <h2>Downtime by Machine</h2>
  ${section('downtimeByMachine', `<table><thead><tr><th>Serial</th><th>Model</th><th class="r">Tickets</th><th class="r">Open</th><th class="r">Closed</th></tr></thead><tbody>${downtimeRows || '<tr><td colspan="5">No service tickets.</td></tr>'}</tbody></table><div class="note">${esc(content.downtimeNote)}</div>`)}

  <h2>Top Issues</h2>
  ${section('topIssues', `<ul>${issueRows || '<li>No recurring issues this quarter.</li>'}</ul>`)}

  <h2>Supply Cost</h2>
  ${section('supplyCost', `<p>Estimated quarterly supply cost: <strong>$${content.supplyCost.estimatedQuarterly.toLocaleString()}</strong></p><div class="note">${esc(content.supplyCost.note)}</div>`)}

  <h2>Recommendations</h2>
  ${section('recommendations', `<ul>${recRows}</ul><div class="note">Source: ${content.recommendationsSource === 'ai' ? 'AI-generated' : 'rule-based fallback'}.</div>`)}

  <h2>Forecast</h2>
  ${section('forecast', `<p>Next quarter (${esc(content.forecast.nextQuarter)}) projection: <strong>${content.forecast.projectedTotal.toLocaleString()}</strong> total pages (${content.forecast.projectedBlack.toLocaleString()} B/W, ${content.forecast.projectedColor.toLocaleString()} color).</p><div class="note">${esc(content.forecast.note)}</div>`)}
</body></html>`;
}

/**
 * Render the deck HTML to a PDF buffer via headless Chromium.
 * The sandbox may lack a Chromium binary — on ANY launch/render failure we
 * return null so the report still saves with pdfUrl=null.
 */
async function renderPdf(html: string): Promise<Buffer | null> {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      const buf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(buf);
    } finally {
      await browser.close();
    }
  } catch (error: any) {
    log.warn({ err: error?.message }, 'PDF render unavailable (no Chromium?); saving without PDF');
    return null;
  }
}

/**
 * Best-effort artifact upload via Supabase Storage when configured. There is no
 * project-wide server-side storage.upload abstraction, so this lazily creates a
 * service-role client only when env is present. ANY failure returns null so the
 * report still saves with a null URL.
 */
async function uploadArtifact(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string | null> {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.QBR_STORAGE_BUCKET || 'qbr';
    if (!url || !key) return null;
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, key);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, { contentType, upsert: true });
    if (error) {
      log.warn({ err: error.message }, 'Artifact upload failed; storing null URL');
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
    return data?.publicUrl ?? null;
  } catch (error: any) {
    log.warn({ err: error?.message }, 'Artifact upload unavailable; storing null URL');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-customer deck assembly
// ---------------------------------------------------------------------------

async function assembleContent(
  tenantId: string,
  customerId: string,
  quarter: string,
): Promise<QbrContent> {
  const range = quarterRange(quarter);
  const quarters = lastFourQuarters(quarter);
  const fourQuartersAgo = quarterRange(quarters[0])?.start ?? new Date(0);

  const customer = await db.query.businessRecords.findFirst({
    where: and(eq(businessRecords.id, customerId), eq(businessRecords.tenantId, tenantId)),
    columns: { companyName: true, assignedSalesRep: true },
  });

  // Fleet.
  const fleetRows = await db
    .select({
      equipmentId: equipment.id,
      serial: equipment.serialNumber,
      model: equipment.modelNumber,
      manufacturer: equipment.manufacturer,
    })
    .from(equipment)
    .where(and(eq(equipment.tenantId, tenantId), eq(equipment.customerId, customerId)));

  const equipmentIds = fleetRows.map((f) => f.equipmentId);

  // Usage by quarter (last 4) for this customer's equipment.
  const usageMap = new Map<string, { black: number; color: number }>();
  for (const q of quarters) usageMap.set(q, { black: 0, color: 0 });
  if (equipmentIds.length > 0) {
    const readings = await db
      .select({
        readingDate: meterReadings.readingDate,
        black: meterReadings.blackCopies,
        color: meterReadings.colorCopies,
      })
      .from(meterReadings)
      .where(
        and(
          eq(meterReadings.tenantId, tenantId),
          inArray(meterReadings.equipmentId, equipmentIds),
          gte(meterReadings.readingDate, fourQuartersAgo),
        ),
      );
    for (const r of readings) {
      if (!r.readingDate) continue;
      const d = new Date(r.readingDate);
      const q = currentQuarter(d);
      const bucket = usageMap.get(q);
      if (bucket) {
        bucket.black += num(r.black);
        bucket.color += num(r.color);
      }
    }
  }
  const usageTrend: UsageTrendPoint[] = quarters.map((q) => {
    const b = usageMap.get(q) ?? { black: 0, color: 0 };
    return { quarter: q, black: b.black, color: b.color, total: b.black + b.color };
  });

  // Service tickets for this quarter (downtime proxy + top issues).
  const ticketConds = [
    eq(serviceTickets.tenantId, tenantId),
    eq(serviceTickets.customerId, customerId),
  ];
  if (range) ticketConds.push(gte(serviceTickets.createdAt, range.start));
  const tickets = await db
    .select({
      equipmentId: serviceTickets.equipmentId,
      title: serviceTickets.title,
      status: serviceTickets.status,
      createdAt: serviceTickets.createdAt,
    })
    .from(serviceTickets)
    .where(and(...ticketConds));
  const quarterTickets = range
    ? tickets.filter((t) => t.createdAt && new Date(t.createdAt) < range.end)
    : tickets;

  const closedStatuses = new Set(['completed', 'closed', 'resolved', 'cancelled']);
  const downtimeMap = new Map<string, DowntimePoint>();
  for (const f of fleetRows) {
    downtimeMap.set(f.equipmentId, {
      equipmentId: f.equipmentId,
      serial: f.serial ?? null,
      model: f.model ?? null,
      ticketCount: 0,
      open: 0,
      closed: 0,
    });
  }
  for (const t of quarterTickets) {
    if (!t.equipmentId) continue;
    let dp = downtimeMap.get(t.equipmentId);
    if (!dp) {
      dp = {
        equipmentId: t.equipmentId,
        serial: null,
        model: null,
        ticketCount: 0,
        open: 0,
        closed: 0,
      };
      downtimeMap.set(t.equipmentId, dp);
    }
    dp.ticketCount += 1;
    if (closedStatuses.has((t.status ?? '').toLowerCase())) dp.closed += 1;
    else dp.open += 1;
  }
  const downtimeByMachine = Array.from(downtimeMap.values())
    .filter((d) => d.ticketCount > 0)
    .sort((a, b) => b.ticketCount - a.ticketCount);

  // Top 5 issue titles by frequency.
  const issueCounts = new Map<string, number>();
  for (const t of quarterTickets) {
    const title = (t.title ?? '').trim();
    if (!title) continue;
    issueCounts.set(title, (issueCounts.get(title) ?? 0) + 1);
  }
  const topIssues = Array.from(issueCounts.entries())
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Supply cost proxy: sum(monthlyBase) * 3 across active contracts. STUB.
  const activeContracts = await db
    .select({ monthlyBase: contracts.monthlyBase })
    .from(contracts)
    .where(
      and(
        eq(contracts.tenantId, tenantId),
        eq(contracts.customerId, customerId),
        eq(contracts.status, 'active'),
      ),
    );
  const monthlyBaseSum = activeContracts.reduce((a, c) => a + num(c.monthlyBase), 0);
  const supplyCost = {
    estimatedQuarterly: Math.round(monthlyBaseSum * 3),
    note: 'STUB: proxied as sum(active contract monthly base) × 3 months. Wire to real supply/consumables cost when available.',
  };

  // Forecast: simple linear projection from the trend slope.
  const last = usageTrend[usageTrend.length - 1] ?? { black: 0, color: 0, total: 0 };
  const first = usageTrend[0] ?? { black: 0, color: 0, total: 0 };
  const steps = Math.max(usageTrend.length - 1, 1);
  const blackSlope = (last.black - first.black) / steps;
  const colorSlope = (last.color - first.color) / steps;
  const projectedBlack = Math.max(0, Math.round(last.black + blackSlope));
  const projectedColor = Math.max(0, Math.round(last.color + colorSlope));
  const nextQuarterArr = lastFourQuarters(quarter);
  const [, qNum] = /-Q(\d)$/.exec(quarter) ?? [];
  let ny = parseInt(quarter.slice(0, 4), 10);
  let nq = parseInt(qNum ?? '1', 10) + 1;
  if (nq > 4) {
    nq = 1;
    ny += 1;
  }
  const nextQuarter = `${ny}-Q${nq}`;
  void nextQuarterArr;

  const base: Omit<QbrContent, 'recommendations' | 'recommendationsSource'> = {
    cover: {
      companyName: customer?.companyName ?? null,
      quarter,
      assignedSalesRep: customer?.assignedSalesRep ?? null,
    },
    fleet: fleetRows.map((f) => ({
      equipmentId: f.equipmentId,
      serial: f.serial ?? null,
      model: f.model ?? null,
      manufacturer: f.manufacturer ?? null,
    })),
    usageTrend,
    downtimeByMachine,
    downtimeNote:
      'Downtime is a PROXY: service-ticket counts (open/closed) per machine, not measured uptime.',
    topIssues,
    supplyCost,
    forecast: {
      nextQuarter,
      projectedBlack,
      projectedColor,
      projectedTotal: projectedBlack + projectedColor,
      note: 'Simple linear projection from the 4-quarter usage trend.',
    },
    sectionOverrides: {},
  };

  const { recommendations, source } = await generateRecommendations(base);
  return { ...base, recommendations, recommendationsSource: source };
}

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const generateSchema = z.object({
  quarter: z
    .string()
    .regex(/^\d{4}-Q[1-4]$/, 'quarter must be like 2026-Q2')
    .optional(),
  customerId: z.string().min(1).optional(),
});

const patchSchema = z.object({
  status: z.enum(['draft', 'reviewed']).optional(),
  sectionOverrides: z.record(z.string()).optional(),
});

const suppressSchema = z.object({
  customerId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerQbrRoutes(app: Express) {
  /**
   * POST /api/qbr/generate — assemble + render decks for the quarter.
   * body { quarter?, customerId? }. Skips suppressed customers and (when no
   * customerId given) customers without an active contract.
   */
  app.post('/api/qbr/generate', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = generateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      const quarter = parsed.data.quarter ?? currentQuarter();

      // Suppressed customers.
      const suppressions = await db
        .select({ customerId: qbrSuppressions.customerId })
        .from(qbrSuppressions)
        .where(eq(qbrSuppressions.tenantId, tenantId));
      const suppressed = new Set(suppressions.map((s) => s.customerId));

      // Target customers.
      let targetIds: string[];
      if (parsed.data.customerId) {
        targetIds = [parsed.data.customerId];
      } else {
        const activeCustomers = await db
          .selectDistinct({ id: businessRecords.id })
          .from(businessRecords)
          .innerJoin(
            contracts,
            and(
              eq(contracts.customerId, businessRecords.id),
              eq(contracts.tenantId, tenantId),
              eq(contracts.status, 'active'),
            ),
          )
          .where(
            and(
              eq(businessRecords.tenantId, tenantId),
              eq(businessRecords.recordType, 'customer'),
              eq(businessRecords.status, 'active'),
            ),
          );
        targetIds = activeCustomers.map((c) => c.id);
      }

      let generated = 0;
      let skippedSuppressed = 0;
      let skippedNoContract = 0;

      for (const customerId of targetIds) {
        if (suppressed.has(customerId)) {
          skippedSuppressed++;
          continue;
        }
        // When a specific customer was requested, still require an active contract.
        if (parsed.data.customerId) {
          const hasContract = await db
            .select({ id: contracts.id })
            .from(contracts)
            .where(
              and(
                eq(contracts.tenantId, tenantId),
                eq(contracts.customerId, customerId),
                eq(contracts.status, 'active'),
              ),
            )
            .limit(1);
          if (hasContract.length === 0) {
            skippedNoContract++;
            continue;
          }
        }

        const content = await assembleContent(tenantId, customerId, quarter);
        const html = renderHtml(content);
        const pdf = await renderPdf(html);

        const htmlUrl = await uploadArtifact(
          Buffer.from(html, 'utf-8'),
          `qbr/${tenantId}/${customerId}-${quarter}.html`,
          'text/html',
        );
        const pdfUrl = pdf
          ? await uploadArtifact(
              pdf,
              `qbr/${tenantId}/${customerId}-${quarter}.pdf`,
              'application/pdf',
            )
          : null;

        await db
          .insert(qbrReports)
          .values({
            tenantId,
            customerId,
            quarter,
            status: 'draft',
            content: content as unknown as Record<string, unknown>,
            pdfUrl,
            htmlUrl,
            generatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [qbrReports.tenantId, qbrReports.customerId, qbrReports.quarter],
            set: {
              status: 'draft',
              content: content as unknown as Record<string, unknown>,
              pdfUrl,
              htmlUrl,
              generatedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        generated++;
      }

      audit('GENERATE', {
        tenantId,
        userId,
        extra: { quarter, generated, skippedSuppressed, skippedNoContract },
      });
      res.json({ quarter, generated, skippedSuppressed, skippedNoContract });
    } catch (error: any) {
      log.error('QBR generation failed:', error);
      res.status(500).json({ message: 'Failed to generate QBRs', error: error?.message });
    }
  });

  /** GET /api/qbr — list, tenant-scoped, newest first, with companyName. */
  app.get('/api/qbr', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const customerId =
        typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
      const quarter = typeof req.query.quarter === 'string' ? req.query.quarter : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const conditions = [eq(qbrReports.tenantId, tenantId)];
      if (customerId) conditions.push(eq(qbrReports.customerId, customerId));
      if (quarter) conditions.push(eq(qbrReports.quarter, quarter));
      if (status) conditions.push(eq(qbrReports.status, status));

      const rows = await db
        .select()
        .from(qbrReports)
        .where(and(...conditions))
        .orderBy(desc(qbrReports.generatedAt))
        .limit(500);

      const customerIds = Array.from(new Set(rows.map((r) => r.customerId)));
      const names = customerIds.length
        ? await db
            .select({ id: businessRecords.id, companyName: businessRecords.companyName })
            .from(businessRecords)
            .where(
              and(eq(businessRecords.tenantId, tenantId), inArray(businessRecords.id, customerIds)),
            )
        : [];
      const nameMap = new Map(names.map((n) => [n.id, n.companyName]));

      const data = rows.map((r) => ({ ...r, companyName: nameMap.get(r.customerId) ?? null }));
      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to list QBRs:', error);
      res.status(500).json({ message: 'Failed to list QBRs', error: error?.message });
    }
  });

  /** GET /api/qbr/suppressions */
  app.get('/api/qbr/suppressions', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const rows = await db
        .select({
          id: qbrSuppressions.id,
          customerId: qbrSuppressions.customerId,
          reason: qbrSuppressions.reason,
          createdAt: qbrSuppressions.createdAt,
          companyName: businessRecords.companyName,
        })
        .from(qbrSuppressions)
        .leftJoin(
          businessRecords,
          and(
            eq(businessRecords.id, qbrSuppressions.customerId),
            eq(businessRecords.tenantId, tenantId),
          ),
        )
        .where(eq(qbrSuppressions.tenantId, tenantId));
      res.json({ data: rows, total: rows.length });
    } catch (error: any) {
      log.error('Failed to list QBR suppressions:', error);
      res.status(500).json({ message: 'Failed to list suppressions', error: error?.message });
    }
  });

  /** POST /api/qbr/suppressions — flag a customer "no QBRs". */
  app.post('/api/qbr/suppressions', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = suppressSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      const [row] = await db
        .insert(qbrSuppressions)
        .values({
          tenantId,
          customerId: parsed.data.customerId,
          reason: parsed.data.reason ?? null,
          createdByUserId: userId,
        })
        .onConflictDoNothing()
        .returning();

      audit('SUPPRESS', { tenantId, userId, extra: { customerId: parsed.data.customerId } });
      res.status(201).json(row ?? { customerId: parsed.data.customerId, alreadySuppressed: true });
    } catch (error: any) {
      log.error('Failed to suppress customer:', error);
      res.status(500).json({ message: 'Failed to suppress customer', error: error?.message });
    }
  });

  /** DELETE /api/qbr/suppressions/:customerId */
  app.delete(
    '/api/qbr/suppressions/:customerId',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        await db
          .delete(qbrSuppressions)
          .where(
            and(
              eq(qbrSuppressions.tenantId, tenantId),
              eq(qbrSuppressions.customerId, req.params.customerId),
            ),
          );
        audit('UNSUPPRESS', { tenantId, userId, extra: { customerId: req.params.customerId } });
        res.json({ success: true });
      } catch (error: any) {
        log.error('Failed to remove QBR suppression:', error);
        res.status(500).json({ message: 'Failed to remove suppression', error: error?.message });
      }
    },
  );

  /** GET /api/qbr/:id — single deck + companyName. */
  app.get('/api/qbr/:id', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const row = await db.query.qbrReports.findFirst({
        where: and(eq(qbrReports.id, req.params.id), eq(qbrReports.tenantId, tenantId)),
      });
      if (!row) return res.status(404).json({ message: 'QBR report not found' });

      const customer = await db.query.businessRecords.findFirst({
        where: and(eq(businessRecords.id, row.customerId), eq(businessRecords.tenantId, tenantId)),
        columns: { companyName: true },
      });
      res.json({ ...row, companyName: customer?.companyName ?? null });
    } catch (error: any) {
      log.error('Failed to load QBR:', error);
      res.status(500).json({ message: 'Failed to load QBR', error: error?.message });
    }
  });

  /**
   * PATCH /api/qbr/:id — review the deck.
   * Merges sectionOverrides into content.sectionOverrides and (optionally) sets
   * status to 'reviewed'. Sending uses the dedicated /send endpoint.
   */
  app.patch('/api/qbr/:id', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      const existing = await db.query.qbrReports.findFirst({
        where: and(eq(qbrReports.id, req.params.id), eq(qbrReports.tenantId, tenantId)),
      });
      if (!existing) return res.status(404).json({ message: 'QBR report not found' });

      const currentContent = (existing.content as Record<string, any> | null) ?? {};
      const mergedContent = parsed.data.sectionOverrides
        ? {
            ...currentContent,
            sectionOverrides: {
              ...(currentContent.sectionOverrides ?? {}),
              ...parsed.data.sectionOverrides,
            },
          }
        : currentContent;

      const [updated] = await db
        .update(qbrReports)
        .set({
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          content: mergedContent,
          updatedAt: new Date(),
        })
        .where(and(eq(qbrReports.id, req.params.id), eq(qbrReports.tenantId, tenantId)))
        .returning();

      audit('REVIEW', {
        tenantId,
        userId,
        extra: { id: req.params.id, status: parsed.data.status },
      });
      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update QBR:', error);
      res.status(500).json({ message: 'Failed to update QBR', error: error?.message });
    }
  });

  /**
   * POST /api/qbr/:id/send — flip to 'sent'.
   * TODO: deliver via existing email infra with a branded template + UTM
   * open/click tracking. For now this only records the send.
   */
  app.post('/api/qbr/:id/send', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const [row] = await db
        .update(qbrReports)
        .set({
          status: 'sent',
          sentAt: new Date(),
          sentByUserId: userId ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(qbrReports.id, req.params.id), eq(qbrReports.tenantId, tenantId)))
        .returning();
      if (!row) return res.status(404).json({ message: 'QBR report not found' });

      audit('SEND', { tenantId, userId, extra: { id: req.params.id } });
      res.json(row);
    } catch (error: any) {
      log.error('Failed to send QBR:', error);
      res.status(500).json({ message: 'Failed to send QBR', error: error?.message });
    }
  });

  void QBR_STATUSES;
}
