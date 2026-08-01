/**
 * QBR deck assembly (PROD-010 port of server/routes-qbr.ts).
 *
 * Ports assembleContent/renderHtml from the Express handler. The aggregation is
 * deliberately kept identical: the Express version also fetches plain rows and
 * folds them in JS, so this is the same arithmetic over the same columns rather
 * than a reimplementation in SQL that could drift.
 *
 * Column names below were verified against shared/schema.ts + shared/qbr-schema.ts,
 * NOT assumed from the camelCase Drizzle field names — e.g. meter_readings stores
 * black_copies/color_copies, contracts stores monthly_base.
 *
 * KNOWN DIVERGENCE — PDF: the Express generator renders a PDF with Playwright /
 * Chromium, which cannot run in a Deno edge function. This module produces the
 * HTML artifact only and leaves pdf_url null. That is not a new failure mode: the
 * Express path already treats PDF rendering as best-effort and saves with a null
 * pdf_url whenever Chromium is unavailable, and the page renders "Not available"
 * for a null pdfUrl. See the header of index.ts for the full rationale.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ---------------------------------------------------------------------------
// Types (mirror the Express QbrContent shape — this is what the page reads)
// ---------------------------------------------------------------------------

export interface UsageTrendPoint {
  quarter: string;
  black: number;
  color: number;
  total: number;
}

export interface DowntimePoint {
  equipmentId: string;
  serial: string | null;
  model: string | null;
  ticketCount: number;
  open: number;
  closed: number;
}

export interface QbrContent {
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
  forecast: {
    nextQuarter: string;
    projectedBlack: number;
    projectedColor: number;
    projectedTotal: number;
    note: string;
  };
  sectionOverrides: Record<string, string>;
  recommendations: string[];
  recommendationsSource: string;
}

// ---------------------------------------------------------------------------
// Quarter math (ported verbatim in behavior from routes-qbr.ts)
// ---------------------------------------------------------------------------

export function currentQuarter(d = new Date()): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function quarterRange(quarter: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarter);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const q = parseInt(m[2], 10);
  const startMonth = (q - 1) * 3;
  return { start: new Date(year, startMonth, 1), end: new Date(year, startMonth + 3, 1) };
}

export function lastFourQuarters(quarter: string): string[] {
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

function nextQuarterOf(quarter: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarter);
  let year = m ? parseInt(m[1], 10) : new Date().getFullYear();
  let q = (m ? parseInt(m[2], 10) : 1) + 1;
  if (q > 4) {
    q = 1;
    year += 1;
  }
  return `${year}-Q${q}`;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export async function assembleContent(
  admin: SupabaseClient,
  tenantId: string,
  customerId: string,
  quarter: string,
): Promise<QbrContent> {
  const range = quarterRange(quarter);
  const quarters = lastFourQuarters(quarter);
  const fourQuartersAgo = quarterRange(quarters[0])?.start ?? new Date(0);

  const { data: customer } = await admin
    .from('business_records')
    .select('company_name, assigned_sales_rep')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  // Fleet.
  const { data: fleetRows } = await admin
    .from('equipment')
    .select('id, serial_number, model_number, manufacturer')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId);

  const fleet = (fleetRows ?? []).map((f: Record<string, unknown>) => ({
    equipmentId: String(f.id),
    serial: (f.serial_number as string) ?? null,
    model: (f.model_number as string) ?? null,
    manufacturer: (f.manufacturer as string) ?? null,
  }));
  const equipmentIds = fleet.map((f) => f.equipmentId);

  // Usage by quarter (last 4) across this customer's equipment.
  const usageMap = new Map<string, { black: number; color: number }>();
  for (const q of quarters) usageMap.set(q, { black: 0, color: 0 });
  if (equipmentIds.length > 0) {
    const { data: readings } = await admin
      .from('meter_readings')
      .select('reading_date, black_copies, color_copies')
      .eq('tenant_id', tenantId)
      .in('equipment_id', equipmentIds)
      .gte('reading_date', fourQuartersAgo.toISOString());
    for (const r of readings ?? []) {
      if (!r.reading_date) continue;
      const bucket = usageMap.get(currentQuarter(new Date(r.reading_date as string)));
      if (bucket) {
        bucket.black += num(r.black_copies);
        bucket.color += num(r.color_copies);
      }
    }
  }
  const usageTrend: UsageTrendPoint[] = quarters.map((q) => {
    const b = usageMap.get(q) ?? { black: 0, color: 0 };
    return { quarter: q, black: b.black, color: b.color, total: b.black + b.color };
  });

  // Service tickets for this quarter (downtime proxy + top issues).
  let ticketQuery = admin
    .from('service_tickets')
    .select('equipment_id, title, status, created_at')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId);
  if (range) ticketQuery = ticketQuery.gte('created_at', range.start.toISOString());
  const { data: ticketRows } = await ticketQuery;
  const quarterTickets = range
    ? (ticketRows ?? []).filter(
        (t: Record<string, unknown>) =>
          t.created_at && new Date(t.created_at as string) < range.end,
      )
    : (ticketRows ?? []);

  const closedStatuses = new Set(['completed', 'closed', 'resolved', 'cancelled']);
  const downtimeMap = new Map<string, DowntimePoint>();
  for (const f of fleet) {
    downtimeMap.set(f.equipmentId, {
      equipmentId: f.equipmentId,
      serial: f.serial,
      model: f.model,
      ticketCount: 0,
      open: 0,
      closed: 0,
    });
  }
  for (const t of quarterTickets) {
    const eqId = t.equipment_id as string | null;
    if (!eqId) continue;
    let dp = downtimeMap.get(eqId);
    if (!dp) {
      dp = { equipmentId: eqId, serial: null, model: null, ticketCount: 0, open: 0, closed: 0 };
      downtimeMap.set(eqId, dp);
    }
    dp.ticketCount += 1;
    if (closedStatuses.has(String(t.status ?? '').toLowerCase())) dp.closed += 1;
    else dp.open += 1;
  }
  const downtimeByMachine = Array.from(downtimeMap.values())
    .filter((d) => d.ticketCount > 0)
    .sort((a, b) => b.ticketCount - a.ticketCount);

  // Top 5 issue titles by frequency.
  const issueCounts = new Map<string, number>();
  for (const t of quarterTickets) {
    const title = String(t.title ?? '').trim();
    if (!title) continue;
    issueCounts.set(title, (issueCounts.get(title) ?? 0) + 1);
  }
  const topIssues = Array.from(issueCounts.entries())
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Supply cost proxy: sum(monthly_base) * 3 across active contracts. STUB — same
  // proxy and the same disclosure string as the Express generator.
  const { data: activeContracts } = await admin
    .from('contracts')
    .select('monthly_base')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('status', 'active');
  const monthlyBaseSum = (activeContracts ?? []).reduce(
    (a: number, c: Record<string, unknown>) => a + num(c.monthly_base),
    0,
  );
  const supplyCost = {
    estimatedQuarterly: Math.round(monthlyBaseSum * 3),
    note: 'STUB: proxied as sum(active contract monthly base) × 3 months. Wire to real supply/consumables cost when available.',
  };

  // Forecast: simple linear projection from the trend slope.
  const last = usageTrend[usageTrend.length - 1] ?? { black: 0, color: 0, total: 0 };
  const first = usageTrend[0] ?? { black: 0, color: 0, total: 0 };
  const steps = Math.max(usageTrend.length - 1, 1);
  const projectedBlack = Math.max(0, Math.round(last.black + (last.black - first.black) / steps));
  const projectedColor = Math.max(0, Math.round(last.color + (last.color - first.color) / steps));

  const base = {
    cover: {
      companyName: (customer?.company_name as string) ?? null,
      quarter,
      assignedSalesRep: (customer?.assigned_sales_rep as string) ?? null,
    },
    fleet,
    usageTrend,
    downtimeByMachine,
    downtimeNote:
      'Downtime is a PROXY: service-ticket counts (open/closed) per machine, not measured uptime.',
    topIssues,
    supplyCost,
    forecast: {
      nextQuarter: nextQuarterOf(quarter),
      projectedBlack,
      projectedColor,
      projectedTotal: projectedBlack + projectedColor,
      note: 'Simple linear projection from the 4-quarter usage trend.',
    },
    sectionOverrides: {} as Record<string, string>,
  };

  const { recommendations, source } = await generateRecommendations(base);
  return { ...base, recommendations, recommendationsSource: source };
}

// ---------------------------------------------------------------------------
// Recommendations — Claude when a key is configured, deterministic otherwise.
// ---------------------------------------------------------------------------

async function generateRecommendations(
  base: Omit<QbrContent, 'recommendations' | 'recommendationsSource'>,
): Promise<{ recommendations: string[]; source: string }> {
  const apiKey = safeEnv('CLAUDE_API_KEY') || safeEnv('ANTHROPIC_API_KEY');
  if (apiKey) {
    try {
      const prompt =
        `Write 3-5 short, concrete quarterly business review recommendations for a copier/print ` +
        `fleet customer. Return ONE per line, no numbering or preamble.\n\n` +
        `Fleet size: ${base.fleet.length}\n` +
        `Usage trend: ${base.usageTrend.map((u) => `${u.quarter}=${u.total}`).join(', ')}\n` +
        `Machines with tickets: ${base.downtimeByMachine.length}\n` +
        `Top issues: ${base.topIssues.map((i) => `${i.title} (${i.count})`).join('; ') || 'none'}\n` +
        `Projected next quarter volume: ${base.forecast.projectedTotal}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const text: string = json?.content?.[0]?.text ?? '';
        const lines = text
          .split('\n')
          .map((l: string) => l.replace(/^\s*[-*\d.)]+\s*/, '').trim())
          .filter(Boolean);
        if (lines.length) return { recommendations: lines.slice(0, 5), source: 'claude' };
      }
    } catch {
      // Fall through to the deterministic set — a QBR must still generate
      // when the AI call fails, exactly as the Express path does.
    }
  }
  return { recommendations: deterministicRecommendations(base), source: 'fallback' };
}

function deterministicRecommendations(
  base: Omit<QbrContent, 'recommendations' | 'recommendationsSource'>,
): string[] {
  const out: string[] = [];
  const trend = base.usageTrend;
  const first = trend[0]?.total ?? 0;
  const last = trend[trend.length - 1]?.total ?? 0;

  if (last > first * 1.1) {
    out.push('Print volume is trending up — review whether current contract tiers still fit.');
  } else if (last < first * 0.9) {
    out.push('Print volume is trending down — consider right-sizing the fleet or contract tier.');
  } else {
    out.push('Print volume is stable — maintain current contract structure.');
  }

  const worst = base.downtimeByMachine[0];
  if (worst) {
    out.push(
      `${worst.model ?? worst.serial ?? 'One machine'} generated the most service tickets (${worst.ticketCount}) — evaluate replacement or preventive maintenance.`,
    );
  }
  if (base.topIssues[0]) {
    out.push(
      `Most frequent issue: "${base.topIssues[0].title}" (${base.topIssues[0].count}×) — address the root cause.`,
    );
  }
  if (base.fleet.length === 0) {
    out.push('No equipment is on file for this customer — verify fleet records are current.');
  }
  out.push(`Projected ${base.forecast.nextQuarter} volume: ${base.forecast.projectedTotal} pages.`);
  return out.slice(0, 5);
}

function safeEnv(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * A section override replaces the generated block entirely — same truthiness test
 * and same `override` class as the Express renderer, so an edited deck looks the
 * same whichever backend produced it.
 */
function section(content: QbrContent, key: string, generated: string): string {
  const override = content.sectionOverrides?.[key];
  return override ? `<p class="override">${esc(override)}</p>` : generated;
}

export function renderHtml(content: QbrContent): string {
  const rows = (cells: string[][]) =>
    cells.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>QBR ${esc(content.cover.quarter)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111;margin:40px;line-height:1.5}
  h1{font-size:28px;margin:0 0 4px} h2{font-size:18px;margin:28px 0 8px}
  table{border-collapse:collapse;width:100%;font-size:14px}
  th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left}
  .muted{color:#6b7280;font-size:12px}
</style></head><body>
<h1>Quarterly Business Review — ${esc(content.cover.quarter)}</h1>
<div class="muted">${esc(content.cover.companyName ?? 'Customer')}${
    content.cover.assignedSalesRep ? ` · Rep: ${esc(content.cover.assignedSalesRep)}` : ''
  }</div>

<h2>Fleet</h2>
${section(
  content,
  'fleet',
  content.fleet.length
    ? `<table><tr><th>Serial</th><th>Model</th><th>Manufacturer</th></tr>${rows(
        content.fleet.map((f) => [
          esc(f.serial || f.equipmentId),
          esc(f.model || '—'),
          esc(f.manufacturer || '—'),
        ]),
      )}</table>`
    : '<p class="muted">No equipment on file.</p>',
)}

<h2>Usage Trend</h2>
${section(
  content,
  'usageTrend',
  `<table><tr><th>Quarter</th><th>Black</th><th>Color</th><th>Total</th></tr>${rows(
    content.usageTrend.map((u) => [
      esc(u.quarter),
      String(u.black),
      String(u.color),
      String(u.total),
    ]),
  )}</table>`,
)}

<h2>Downtime by Machine</h2>
${section(
  content,
  'downtimeByMachine',
  content.downtimeByMachine.length
    ? `<table><tr><th>Serial</th><th>Model</th><th>Tickets</th><th>Open</th><th>Closed</th></tr>${rows(
        content.downtimeByMachine.map((d) => [
          esc(d.serial || d.equipmentId),
          esc(d.model || '—'),
          String(d.ticketCount),
          String(d.open),
          String(d.closed),
        ]),
      )}</table><p class="muted">${esc(content.downtimeNote)}</p>`
    : '<p class="muted">No service tickets this quarter.</p>',
)}

<h2>Top Issues</h2>
${section(
  content,
  'topIssues',
  content.topIssues.length
    ? `<ul>${content.topIssues.map((i) => `<li>${esc(i.title)} — ${i.count}×</li>`).join('')}</ul>`
    : '<p class="muted">None recorded.</p>',
)}

<h2>Supply Cost</h2>
${section(
  content,
  'supplyCost',
  `<p>Estimated quarterly: $${content.supplyCost.estimatedQuarterly.toLocaleString()}</p><p class="muted">${esc(
    content.supplyCost.note,
  )}</p>`,
)}

<h2>Recommendations</h2>
${section(
  content,
  'recommendations',
  `<ul>${content.recommendations.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
   <p class="muted">Source: ${esc(content.recommendationsSource)}</p>`,
)}

<h2>Forecast</h2>
${section(
  content,
  'forecast',
  `<p>${esc(content.forecast.nextQuarter)}: ${content.forecast.projectedTotal} pages
   (black ${content.forecast.projectedBlack}, color ${content.forecast.projectedColor})</p>
   <p class="muted">${esc(content.forecast.note)}</p>`,
)}
</body></html>`;
}
