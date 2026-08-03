/**
 * Daily-briefing assembly and generation (PROD-010) — port of the logic in
 * server/routes-daily-briefing.ts.
 *
 * Split from index.ts so it can run in CI: index.ts imports _shared/supabase.ts,
 * which pulls @supabase/supabase-js from esm.sh at RUNTIME and cannot be loaded
 * by Node. Everything here is pure or takes the client as a parameter with only
 * its TYPE imported.
 *
 * Column names were verified against shared/daily-briefing-schema.ts and
 * shared/schema.ts rather than assumed from the camelCase Drizzle field names.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const DAY_MS = 86_400_000;

export type BriefingRole = 'owner' | 'service_manager' | 'sales_rep';
export type BriefingVariant = 'numbers' | 'narrative';

export interface BriefingMetric {
  label: string;
  value: number | string;
  detail?: string;
}
export interface BriefingSection {
  heading: string;
  metrics: BriefingMetric[];
}
export interface BriefingData {
  role: BriefingRole;
  sections: BriefingSection[];
}
export interface GeneratedBriefing {
  subject: string;
  bullets: string[];
  source: 'ai' | 'fallback';
}

export const ROLE_LABELS: Record<BriefingRole, string> = {
  owner: 'Owner',
  service_manager: 'Service Manager',
  sales_rep: 'Sales Rep',
};

/** Statuses that mean a ticket is no longer open. Compared case-insensitively. */
const CLOSED_TICKET_STATUSES = new Set(['completed', 'closed', 'resolved', 'cancelled']);

export function briefingDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** Map a user's system role onto one of the three briefing flavors. */
export function deriveRole(role: string | null | undefined): BriefingRole {
  const r = (role ?? '').toLowerCase();
  if (r.includes('owner') || r.includes('admin') || r.includes('exec')) return 'owner';
  if (r.includes('service')) return 'service_manager';
  return 'sales_rep';
}

const iso = (ms: number) => new Date(ms).toISOString();

/** PostgREST head+count — never transfers row bodies just to count them. */
async function countRows(
  admin: SupabaseClient,
  table: string,
  apply: (q: any) => any,
): Promise<number> {
  const { count } = await apply(admin.from(table).select('id', { count: 'exact', head: true }));
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Owner
// ---------------------------------------------------------------------------

export async function assembleOwnerData(
  admin: SupabaseClient,
  tenantId: string,
  nowMs: number = Date.now(),
): Promise<BriefingSection[]> {
  const dayAgo = iso(nowMs - DAY_MS);
  const weekAhead = iso(nowMs + 7 * DAY_MS);
  const thirtyDaysAhead = iso(nowMs + 30 * DAY_MS);
  const now = new Date(nowMs);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const p1Count = await countRows(admin, 'service_tickets', (q) =>
    q.eq('tenant_id', tenantId).eq('priority', 'urgent').gte('created_at', dayAgo),
  );

  // At-risk customers: the LATEST churn row per customer, then count at_risk.
  // Express did this with DISTINCT ON (customer_id) ORDER BY calculated_at DESC.
  // Counting at_risk rows directly would count stale bands and historical runs.
  const { data: churnRows } = await admin
    .from('customer_churn_scores')
    .select('customer_id, band, calculated_at')
    .eq('tenant_id', tenantId)
    .order('calculated_at', { ascending: false });
  const latestBand = new Map<string, string>();
  for (const r of churnRows ?? []) {
    const key = String(r.customer_id);
    if (!latestBand.has(key)) latestBand.set(key, String(r.band));
  }
  const atRiskCount = Array.from(latestBand.values()).filter((b) => b === 'at_risk').length;

  const contractsEnding = await countRows(admin, 'contracts', (q) =>
    q
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .gte('end_date', iso(nowMs))
      .lt('end_date', thirtyDaysAhead),
  );

  const { data: closingDeals } = await admin
    .from('proposals')
    .select('id, title, total_amount, valid_until')
    .eq('tenant_id', tenantId)
    .in('status', ['sent', 'viewed'])
    .gte('valid_until', iso(nowMs))
    .lt('valid_until', weekAhead);

  const topDeals = (closingDeals ?? [])
    .map((d: Record<string, unknown>) => ({ title: String(d.title), amount: num(d.total_amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const { data: acceptedRows } = await admin
    .from('proposals')
    .select('total_amount')
    .eq('tenant_id', tenantId)
    .eq('status', 'accepted')
    .gte('accepted_at', monthStart);
  const revenueMtd = (acceptedRows ?? []).reduce(
    (a: number, r: Record<string, unknown>) => a + num(r.total_amount),
    0,
  );

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

// ---------------------------------------------------------------------------
// Service manager
// ---------------------------------------------------------------------------

export async function assembleServiceManagerData(
  admin: SupabaseClient,
  tenantId: string,
  nowMs: number = Date.now(),
): Promise<BriefingSection[]> {
  const fortyEightHoursAgo = iso(nowMs - 48 * 3_600_000);
  const weekAhead = iso(nowMs + 7 * DAY_MS);
  const weekAgo = iso(nowMs - 7 * DAY_MS);

  // Open tickets older than 48h. Express filtered with lower(status) NOT IN (...);
  // PostgREST has no lower() in a filter, so open tickets are fetched and the
  // case-insensitive exclusion is applied here.
  const { data: staleTickets } = await admin
    .from('service_tickets')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .lt('created_at', fortyEightHoursAgo);
  const slaBreaches = (staleTickets ?? []).filter(
    (t: Record<string, unknown>) =>
      !CLOSED_TICKET_STATUSES.has(String(t.status ?? '').toLowerCase()),
  ).length;

  const predictedFailures = await countRows(admin, 'equipment_failure_predictions', (q) =>
    q
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .gte('predicted_window_start', iso(nowMs))
      .lt('predicted_window_start', weekAhead),
  );

  // Parts at/below reorder point. This compares TWO COLUMNS, which PostgREST
  // cannot express at all — the rows have to come back and be compared here.
  const { data: inventory } = await admin
    .from('inventory_items')
    .select('id, quantity_on_hand, reorder_point')
    .eq('tenant_id', tenantId);
  const partsShortages = (inventory ?? []).filter(
    (i: Record<string, unknown>) => num(i.quantity_on_hand) <= num(i.reorder_point),
  ).length;

  const callbacks = await countRows(admin, 'truck_stock_callbacks', (q) =>
    q.eq('tenant_id', tenantId).gte('created_at', weekAgo),
  );

  // Tech utilization: open tickets grouped by assigned technician. Express used
  // GROUP BY; the same fold happens here over the open set.
  const { data: assigned } = await admin
    .from('service_tickets')
    .select('assigned_technician_id, status')
    .eq('tenant_id', tenantId)
    .not('assigned_technician_id', 'is', null);
  const openByTech = new Map<string, number>();
  for (const t of assigned ?? []) {
    if (CLOSED_TICKET_STATUSES.has(String(t.status ?? '').toLowerCase())) continue;
    const tech = String(t.assigned_technician_id);
    openByTech.set(tech, (openByTech.get(tech) ?? 0) + 1);
  }
  const techsWithWork = openByTech.size;
  const totalOpenAssigned = Array.from(openByTech.values()).reduce((a, b) => a + b, 0);
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

// ---------------------------------------------------------------------------
// Sales rep
// ---------------------------------------------------------------------------

export async function assembleSalesRepData(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  nowMs: number = Date.now(),
): Promise<BriefingSection[]> {
  const dayAgo = iso(nowMs - DAY_MS);
  const weekAgo = iso(nowMs - 7 * DAY_MS);
  const ninetyDaysAhead = iso(nowMs + 90 * DAY_MS);

  const { data: nextActions } = await admin
    .from('proposals')
    .select('title, total_amount, status')
    .eq('tenant_id', tenantId)
    .eq('assigned_to', userId)
    .in('status', ['draft', 'sent'])
    .order('total_amount', { ascending: false })
    .limit(5);

  const stuckDeals = await countRows(admin, 'proposals', (q) =>
    q
      .eq('tenant_id', tenantId)
      .eq('assigned_to', userId)
      .in('status', ['draft', 'sent'])
      .lt('updated_at', weekAgo),
  );

  const prospectsEngaged = await countRows(admin, 'business_records', (q) =>
    q.eq('tenant_id', tenantId).eq('record_type', 'lead').gte('updated_at', dayAgo),
  );

  const renewalDrafts = await countRows(admin, 'renewal_auto_quotes', (q) =>
    q.eq('tenant_id', tenantId).eq('status', 'renewal_draft'),
  );
  const contractsDue = await countRows(admin, 'contracts', (q) =>
    q
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .gte('end_date', iso(nowMs))
      .lt('end_date', ninetyDaysAhead),
  );

  return [
    {
      heading: 'Next best actions',
      metrics:
        (nextActions ?? []).length > 0
          ? (nextActions ?? []).map((a: Record<string, unknown>) => ({
              label: String(a.title),
              value: `$${Math.round(num(a.total_amount)).toLocaleString()}`,
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

export async function assembleData(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  role: BriefingRole,
  nowMs: number = Date.now(),
): Promise<BriefingData> {
  let sections: BriefingSection[];
  if (role === 'owner') sections = await assembleOwnerData(admin, tenantId, nowMs);
  else if (role === 'service_manager')
    sections = await assembleServiceManagerData(admin, tenantId, nowMs);
  else sections = await assembleSalesRepData(admin, tenantId, userId, nowMs);
  return { role, sections };
}

// ---------------------------------------------------------------------------
// Generation — pure helpers
// ---------------------------------------------------------------------------

export function flattenMetrics(data: BriefingData): string[] {
  const lines: string[] = [];
  for (const section of data.sections) {
    for (const m of section.metrics) {
      lines.push(`${section.heading} — ${m.label}: ${m.value}${m.detail ? ` (${m.detail})` : ''}`);
    }
  }
  return lines;
}

export function buildFallback(data: BriefingData, date: string): GeneratedBriefing {
  const roleLabel = ROLE_LABELS[data.role];
  const bullets: string[] = [];
  for (const section of data.sections) {
    for (const m of section.metrics) {
      bullets.push(`${m.label}: ${m.value}${m.detail ? ` — ${m.detail}` : ''}`);
    }
  }
  return { subject: `${roleLabel} morning briefing — ${date}`, bullets, source: 'fallback' };
}

export function wordCount(bullets: string[], subject: string): number {
  return [subject, ...bullets].join(' ').trim().split(/\s+/).filter(Boolean).length;
}

export function buildPrompt(data: BriefingData, variant: BriefingVariant, date: string): string {
  const roleLabel = ROLE_LABELS[data.role];
  const metricLines = flattenMetrics(data).join('\n');
  const variantInstruction =
    variant === 'narrative'
      ? 'Lead with a short (1-2 sentence) narrative framing the day, THEN the bullets.'
      : 'Lead with the hard figures; put the most important numbers first.';
  return (
    `You are an assistant writing a CONCISE morning briefing for a copier-dealer ` +
    `${roleLabel} for ${date}.\n` +
    `Use ONLY these assembled figures (do not invent numbers):\n${metricLines}\n\n` +
    `${variantInstruction}\n` +
    `Keep the whole briefing under 400 words. Be actionable and specific.\n` +
    `Return ONLY JSON: {"subject": string, "bullets": string[]}. ` +
    `subject must be a short, scannable email subject line.`
  );
}

/**
 * Parse the model's reply into a briefing, or null when it is unusable.
 *
 * Extracted and strict on purpose: this is the seam where a bad AI response
 * could put malformed content in front of a customer-facing email. Anything
 * that is not an object with a string subject and a NON-EMPTY array of string
 * bullets is rejected so the caller falls back to the deterministic briefing.
 */
export function parseAiBriefing(text: string): { subject: string; bullets: string[] } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (
      parsed &&
      typeof parsed.subject === 'string' &&
      Array.isArray(parsed.bullets) &&
      parsed.bullets.every((b: unknown) => typeof b === 'string') &&
      parsed.bullets.length > 0
    ) {
      return { subject: parsed.subject, bullets: parsed.bullets };
    }
  } catch {
    // Malformed JSON is a fallback case, not an error.
  }
  return null;
}
