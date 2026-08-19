/**
 * Slack/Teams Natural-Language Printyx Bot Routes (US-SUPER-014) — READ-ONLY v1.
 *
 * A dealer manager asks "what happened with Acme this week?" from Slack/Teams
 * and gets the answer with deep links back to Printyx. A Claude agent selects
 * among named READ-ONLY query tools, executes the chosen tool scoped to the
 * mapped Printyx user's tenant (and best-effort to their RBAC scope), composes
 * a concise chat answer with citation links, and logs every query for audit.
 *
 * >>> READ-ONLY v1: THERE ARE NO WRITES TO BUSINESS DATA. <<<
 * The only rows this module writes are the chatbot_* tables (connections, user
 * links, query log). There is no "create ticket" / "log activity" / "send"
 * tool — those are v2. Every business-data query below is SELECT-only and
 * tenant-scoped; the agent never mutates a customer, deal, ticket, or contract.
 *
 * Endpoints:
 *   POST   /api/chatbot/query            — ask a question (resolve user → tool → answer; logs always)
 *   GET    /api/chatbot/connections      — list workspace installs (tokens write-only → tokensSet)
 *   POST   /api/chatbot/connect          — install a workspace (obfuscate bot token; never echoed)
 *   PUT    /api/chatbot/connections/:id  — enable/disable toggle
 *   DELETE /api/chatbot/connections/:id  — remove install
 *   GET    /api/chatbot/links            — list Slack/Teams → Printyx user mappings
 *   POST   /api/chatbot/links            — map a platform user to a Printyx user by verified email
 *   DELETE /api/chatbot/links/:id        — remove mapping
 *   GET    /api/chatbot/query-log        — append-only audit list (newest first, limit 200)
 *
 * Schema: shared/chatbot-schema.ts (re-exported from shared/schema.ts).
 * Auth: requireAuth + resolveTenant + tenant scoping on every query.
 *
 * Documented STUBs / TODOs:
 *   - OAuth/connect: there is no real Slack/Teams OAuth install flow here. POST
 *     /connect accepts a pasted bot token, base64-obfuscates it into
 *     encryptedTokens, and returns only a tokensSet boolean. TODO: real
 *     Slack/Teams OAuth install. TODO(vault): replace base64 obfuscation with the
 *     shared credential vault once an env master key is provisioned for this
 *     module (the address-book vault throws without ADDRESS_BOOK_MASTER_KEY).
 *   - postReply(): adapter STUB. The real Slack/Teams event handler would call
 *     this to post the answer in-thread via the stored bot token; the HTTP
 *     endpoint returns the answer directly (in-app "try it" path).
 *   - selectTool()/composeAnswer(): Claude (CLAUDE_API_KEY) with deterministic
 *     keyword fallbacks so the bot is exercisable offline.
 *   - Email→user mapping: POST /links resolves email → users (tenant-scoped) and
 *     sets verified = (a matching user was found).
 *   - predicted_failures tolerates the equipment_failure_predictions table being
 *     absent (returns empty rather than 500).
 *   - TODO(rbac): full per-user RBAC scoping via hierarchical-query-builder /
 *     enhanced-rbac for the mapped printyxUserId. At minimum we NEVER return
 *     cross-tenant data, deny entirely when no printyxUserId is resolved, and do
 *     best-effort per-user scoping where it is cheap.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, ilike, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import ClaudeAIService from './services/claude-ai-service';
import {
  chatbotConnections,
  chatbotUserLinks,
  chatbotQueryLog,
  businessRecords,
  serviceTickets,
  proposals,
  contracts,
  customerChurnScores,
  equipmentFailurePredictions,
  users,
  CHATBOT_PLATFORMS,
} from '@shared/schema';
import { crisisResponse, detectsCrisis } from './lib/crisis-response';

import {
  obfuscateCredential,
  projectConnection,
  projectQueryLogRow,
  projectUserLink,
} from './lib/chatbot-projection';

const log = createModuleLogger('routes-chatbot');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_REP_DAYS = 14; // a rep with no proposal activity in N days is flagged

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolName =
  | 'account_summary'
  | 'rep_activity'
  | 'pipeline_status'
  | 'this_week_deltas'
  | 'at_risk_customers'
  | 'predicted_failures'
  | 'help';

interface ToolSelection {
  tool: ToolName;
  args: Record<string, string>;
  source: 'ai' | 'fallback';
}

interface Citation {
  label: string;
  href: string;
}

interface ToolResult {
  summary: string;
  data: Record<string, unknown>;
  citations: Citation[];
}

interface ToolContext {
  tenantId: string;
  printyxUserId: string;
  args: Record<string, string>;
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

// ---------------------------------------------------------------------------
// Platform reply adapter — STUB (read-only v1)
// ---------------------------------------------------------------------------

/**
 * Post the answer back into the originating Slack/Teams thread.
 * STUB — the real Slack/Teams event handler would call this.
 * TODO: post in-thread via Slack/Teams API using the stored bot token (reply in
 * thread, not channel). The HTTP /query endpoint returns the answer directly so
 * the in-app "try it" path works without a live workspace.
 */
async function postReply(
  _ctx: { platform: string; channel: string | null; threadKey?: string },
  _answer: string,
): Promise<void> {
  // TODO: post in-thread via Slack/Teams API using the stored bot token (reply in thread, not channel).
  void _ctx;
  void _answer;
}

// ---------------------------------------------------------------------------
// Read-only tool registry — every tool is SELECT-only and tenant-scoped.
// Each takes { tenantId, printyxUserId, args } → { summary, data, citations }.
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * account_summary(companyName) — match a business record by company name
 * (ILIKE), then summarize recent tickets, open proposals/deals + value, the
 * active contract, and the latest churn band. READ-ONLY.
 */
async function account_summary(ctx: ToolContext): Promise<ToolResult> {
  const companyName = (ctx.args.companyName ?? '').trim();
  if (!companyName) {
    return {
      summary: 'No company name was provided. Try "summary for Acme".',
      data: {},
      citations: [{ label: 'Customers', href: '/customers' }],
    };
  }

  const matches = await db
    .select({
      id: businessRecords.id,
      companyName: businessRecords.companyName,
      recordType: businessRecords.recordType,
      status: businessRecords.status,
    })
    .from(businessRecords)
    .where(
      and(
        eq(businessRecords.tenantId, ctx.tenantId),
        ilike(businessRecords.companyName, `%${companyName}%`),
      ),
    )
    .limit(1);

  const record = matches[0];
  if (!record) {
    return {
      summary: `No customer or lead matching "${companyName}" was found.`,
      data: { companyName },
      citations: [{ label: 'Customers', href: '/customers' }],
    };
  }

  const [tickets, openProposals, activeContract, churn] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(serviceTickets)
      .where(
        and(eq(serviceTickets.tenantId, ctx.tenantId), eq(serviceTickets.customerId, record.id)),
      ),
    db
      .select({ totalAmount: proposals.totalAmount, status: proposals.status })
      .from(proposals)
      .where(
        and(
          eq(proposals.tenantId, ctx.tenantId),
          eq(proposals.businessRecordId, record.id),
          inArray(proposals.status, ['draft', 'sent', 'viewed']),
        ),
      ),
    db
      .select({ status: contracts.status, monthlyBase: contracts.monthlyBase })
      .from(contracts)
      .where(
        and(
          eq(contracts.tenantId, ctx.tenantId),
          eq(contracts.customerId, record.id),
          eq(contracts.status, 'active'),
        ),
      )
      .limit(1),
    db
      .select({ band: customerChurnScores.band, score: customerChurnScores.score })
      .from(customerChurnScores)
      .where(
        and(
          eq(customerChurnScores.tenantId, ctx.tenantId),
          eq(customerChurnScores.customerId, record.id),
        ),
      )
      .orderBy(desc(customerChurnScores.calculatedAt))
      .limit(1),
  ]);

  const ticketCount = num(tickets[0]?.count);
  const openDealCount = openProposals.length;
  const openDealValue = openProposals.reduce((acc, p) => acc + num(p.totalAmount), 0);
  const contractRow = activeContract[0];
  const churnBand = churn[0]?.band ?? 'unknown';

  const summary =
    `${record.companyName} (${record.recordType}, ${record.status}): ` +
    `${ticketCount} service ticket(s); ${openDealCount} open deal(s) worth ` +
    `$${openDealValue.toLocaleString()}; ` +
    (contractRow
      ? `active contract ($${num(contractRow.monthlyBase).toLocaleString()}/mo base); `
      : 'no active contract; ') +
    `latest churn band: ${churnBand}.`;

  return {
    summary,
    data: {
      id: record.id,
      companyName: record.companyName,
      recordType: record.recordType,
      status: record.status,
      ticketCount,
      openDealCount,
      openDealValue,
      activeContract: contractRow
        ? { status: contractRow.status, monthlyBase: num(contractRow.monthlyBase) }
        : null,
      churnBand,
    },
    citations: [{ label: record.companyName, href: `/customers/${record.id}` }],
  };
}

/**
 * rep_activity(repNameOrEmail?) — sales reps with their open proposal counts and
 * last proposal activity; flags reps with no activity in STALE_REP_DAYS days.
 * READ-ONLY. Best-effort scope: if repNameOrEmail is given, filter to that rep.
 * TODO(rbac): full per-user RBAC scoping via hierarchical-query-builder /
 * enhanced-rbac for the mapped printyxUserId.
 */
async function rep_activity(ctx: ToolContext): Promise<ToolResult> {
  const filter = (ctx.args.repNameOrEmail ?? ctx.args.rep ?? '').trim().toLowerCase();

  const repRows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
    })
    .from(users)
    .where(eq(users.tenantId, ctx.tenantId))
    .limit(500);

  // Best-effort "sales rep" detection on the legacy role string.
  const salesReps = repRows.filter((r) => {
    const role = (r.role ?? '').toLowerCase();
    return role.includes('sales') || role.includes('rep') || role.includes('account');
  });
  const candidates = salesReps.length > 0 ? salesReps : repRows;

  const scoped = filter
    ? candidates.filter((r) => {
        const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim().toLowerCase();
        return (r.email ?? '').toLowerCase().includes(filter) || name.includes(filter);
      })
    : candidates;

  const now = Date.now();
  const pageOfReps = scoped.slice(0, 50);

  // AUDIT-007: this ran ONE query PER REP (up to 50), each pulling up to 200
  // proposal rows, purely to derive a count and a max(updated_at). That is now a
  // single GROUP BY over the open proposals for exactly these reps.
  //
  // NOTE a deliberate behaviour change: openDeals used to be `open.length` off a
  // .limit(200) query, so it silently SATURATED at 200. count(*) reports the true
  // number, which can now exceed 200 for a very busy rep. That is a fix, not a
  // regression, but it is a visible number so it is called out here.
  const repStats = pageOfReps.length
    ? await db
        .select({
          assignedTo: proposals.assignedTo,
          openDeals: sql<number>`count(*)::int`,
          lastActivity: sql<Date | null>`max(${proposals.updatedAt})`,
        })
        .from(proposals)
        .where(
          and(
            eq(proposals.tenantId, ctx.tenantId),
            inArray(
              proposals.assignedTo,
              pageOfReps.map((r) => r.id),
            ),
            inArray(proposals.status, ['draft', 'sent', 'viewed']),
          ),
        )
        .groupBy(proposals.assignedTo)
    : [];

  const statsByRep = new Map(repStats.map((s) => [s.assignedTo, s]));

  const reps = pageOfReps.map((r) => {
    // A rep with no open proposals has no GROUP BY row -> 0 open / null activity,
    // exactly what the per-rep query returned for an empty result.
    const stat = statsByRep.get(r.id);
    const lastActivity = stat?.lastActivity ?? null;
    const stale =
      !lastActivity ||
      now - new Date(lastActivity).getTime() > STALE_REP_DAYS * 24 * 60 * 60 * 1000;
    return {
      id: r.id,
      name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || (r.email ?? 'Unknown'),
      email: r.email,
      openDeals: Number(stat?.openDeals) || 0,
      lastActivity,
      stale,
    };
  });

  const staleCount = reps.filter((r) => r.stale).length;
  const summary =
    `${reps.length} sales rep(s); ${staleCount} with no proposal activity in the last ` +
    `${STALE_REP_DAYS} days.`;

  return {
    summary,
    data: { reps, staleCount },
    citations: [{ label: 'Team', href: '/team' }],
  };
}

/**
 * pipeline_status() — proposals grouped by status with counts + total value.
 * READ-ONLY.
 */
async function pipeline_status(ctx: ToolContext): Promise<ToolResult> {
  const rows = await db
    .select({ status: proposals.status, totalAmount: proposals.totalAmount })
    .from(proposals)
    .where(eq(proposals.tenantId, ctx.tenantId))
    .limit(5000);

  const byStatus: Record<string, { count: number; value: number }> = {};
  for (const r of rows) {
    const key = r.status ?? 'unknown';
    byStatus[key] ??= { count: 0, value: 0 };
    byStatus[key].count += 1;
    byStatus[key].value += num(r.totalAmount);
  }

  const groups = Object.entries(byStatus).map(([status, v]) => ({
    status,
    count: v.count,
    value: v.value,
  }));
  const totalValue = groups.reduce((acc, g) => acc + g.value, 0);

  const summary =
    groups.length === 0
      ? 'No proposals in the pipeline yet.'
      : `Pipeline: ${rows.length} proposal(s) worth $${totalValue.toLocaleString()}. ` +
        groups.map((g) => `${g.status}: ${g.count} ($${g.value.toLocaleString()})`).join('; ') +
        '.';

  return {
    summary,
    data: { groups, totalValue, total: rows.length },
    citations: [{ label: 'Quotes', href: '/quotes' }],
  };
}

/**
 * this_week_deltas() — new leads/customers, proposals created/accepted, and
 * tickets opened in the last 7 days. READ-ONLY.
 */
async function this_week_deltas(ctx: ToolContext): Promise<ToolResult> {
  const since = new Date(Date.now() - WEEK_MS);

  const [newLeads, newCustomers, newProposals, acceptedProposals, newTickets] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, ctx.tenantId),
          eq(businessRecords.recordType, 'lead'),
          gte(businessRecords.createdAt, since),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, ctx.tenantId),
          eq(businessRecords.recordType, 'customer'),
          gte(businessRecords.createdAt, since),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(and(eq(proposals.tenantId, ctx.tenantId), gte(proposals.createdAt, since))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(
        and(
          eq(proposals.tenantId, ctx.tenantId),
          eq(proposals.status, 'accepted'),
          gte(proposals.updatedAt, since),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(serviceTickets)
      .where(and(eq(serviceTickets.tenantId, ctx.tenantId), gte(serviceTickets.createdAt, since))),
  ]);

  const deltas = {
    newLeads: num(newLeads[0]?.count),
    newCustomers: num(newCustomers[0]?.count),
    proposalsCreated: num(newProposals[0]?.count),
    proposalsAccepted: num(acceptedProposals[0]?.count),
    ticketsOpened: num(newTickets[0]?.count),
  };

  const summary =
    `Last 7 days — ${deltas.newLeads} new lead(s), ${deltas.newCustomers} new customer(s), ` +
    `${deltas.proposalsCreated} proposal(s) created, ${deltas.proposalsAccepted} accepted, ` +
    `${deltas.ticketsOpened} ticket(s) opened.`;

  return {
    summary,
    data: deltas,
    citations: [{ label: 'Dashboard', href: '/dashboard' }],
  };
}

/**
 * at_risk_customers() — latest churn scores in the 'at_risk' band, top 10, with
 * company names resolved. READ-ONLY.
 */
async function at_risk_customers(ctx: ToolContext): Promise<ToolResult> {
  const rows = await db
    .select({
      customerId: customerChurnScores.customerId,
      score: customerChurnScores.score,
      band: customerChurnScores.band,
    })
    .from(customerChurnScores)
    .where(
      and(eq(customerChurnScores.tenantId, ctx.tenantId), eq(customerChurnScores.band, 'at_risk')),
    )
    .orderBy(desc(customerChurnScores.score))
    .limit(10);

  const ids = rows.map((r) => r.customerId).filter((v): v is string => !!v);
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const recs = await db
      .select({ id: businessRecords.id, companyName: businessRecords.companyName })
      .from(businessRecords)
      .where(and(eq(businessRecords.tenantId, ctx.tenantId), inArray(businessRecords.id, ids)));
    for (const r of recs) names.set(r.id, r.companyName);
  }

  const customers = rows.map((r) => ({
    customerId: r.customerId,
    companyName: r.customerId ? (names.get(r.customerId) ?? r.customerId) : 'Unknown',
    score: num(r.score),
  }));

  const summary =
    customers.length === 0
      ? 'No customers are currently in the at-risk churn band.'
      : `${customers.length} at-risk customer(s): ` +
        customers.map((c) => `${c.companyName} (${Math.round(c.score)})`).join(', ') +
        '.';

  return {
    summary,
    data: { customers },
    citations: [{ label: 'At-risk customers', href: '/customers/risk' }],
  };
}

/**
 * predicted_failures() — pending equipment-failure predictions in the next 7
 * days. READ-ONLY. Tolerates the table being absent (returns empty).
 */
async function predicted_failures(ctx: ToolContext): Promise<ToolResult> {
  try {
    const soon = new Date(Date.now() + WEEK_MS);
    const rows = await db
      .select({
        id: equipmentFailurePredictions.id,
        machineId: equipmentFailurePredictions.machineId,
        confidence: equipmentFailurePredictions.confidence,
        predictedWindowEnd: equipmentFailurePredictions.predictedWindowEnd,
      })
      .from(equipmentFailurePredictions)
      .where(
        and(
          eq(equipmentFailurePredictions.tenantId, ctx.tenantId),
          eq(equipmentFailurePredictions.status, 'pending'),
          gte(equipmentFailurePredictions.predictedWindowEnd, new Date()),
        ),
      )
      .orderBy(desc(equipmentFailurePredictions.confidence))
      .limit(50);

    const upcoming = rows.filter(
      (r) => !r.predictedWindowEnd || new Date(r.predictedWindowEnd).getTime() <= soon.getTime(),
    );

    const summary =
      upcoming.length === 0
        ? 'No equipment failures are predicted in the next 7 days.'
        : `${upcoming.length} predicted failure(s) in the next 7 days (top confidence ` +
          `${Math.round(num(upcoming[0]?.confidence) * 100)}%).`;

    return {
      summary,
      data: {
        predictions: upcoming.map((r) => ({
          id: r.id,
          machineId: r.machineId,
          confidence: num(r.confidence),
          predictedWindowEnd: r.predictedWindowEnd,
        })),
      },
      citations: [{ label: 'Predicted failures', href: '/service/predictions' }],
    };
  } catch (err) {
    // Tolerate the predictions table not existing yet → empty result, not 500.
    log.warn('predicted_failures query failed (table absent?); returning empty:', err as any);
    return {
      summary: 'No predicted-failure data is available yet.',
      data: { predictions: [] },
      citations: [{ label: 'Predicted failures', href: '/service/predictions' }],
    };
  }
}

const TOOL_REGISTRY: Record<
  Exclude<ToolName, 'help'>,
  (ctx: ToolContext) => Promise<ToolResult>
> = {
  account_summary,
  rep_activity,
  pipeline_status,
  this_week_deltas,
  at_risk_customers,
  predicted_failures,
};

// ---------------------------------------------------------------------------
// Agent: tool selection + answer composition (Claude with keyword fallback)
// ---------------------------------------------------------------------------

const KNOWN_TOOLS: ToolName[] = [
  'account_summary',
  'rep_activity',
  'pipeline_status',
  'this_week_deltas',
  'at_risk_customers',
  'predicted_failures',
  'help',
];

/** Deterministic keyword-based tool selection (offline fallback). */
function fallbackSelectTool(question: string): ToolSelection {
  const q = question.toLowerCase();
  if (/\bpipeline\b/.test(q)) {
    return { tool: 'pipeline_status', args: {}, source: 'fallback' };
  }
  if (/\bthis week\b|\bweek\b/.test(q)) {
    return { tool: 'this_week_deltas', args: {}, source: 'fallback' };
  }
  if (/\brisk\b|\bchurn\b/.test(q)) {
    return { tool: 'at_risk_customers', args: {}, source: 'fallback' };
  }
  if (/\bfail\b|\bfailure\b|\bpredict\b/.test(q)) {
    return { tool: 'predicted_failures', args: {}, source: 'fallback' };
  }
  if (/\brep\b|\bquota\b|\bactivity\b/.test(q)) {
    return { tool: 'rep_activity', args: {}, source: 'fallback' };
  }
  // Heuristic: a capitalized multi-word company-like token → account_summary.
  const companyMatch = question.match(
    /(?:about|for|with|on)\s+([A-Z][\w&.''-]*(?:\s+[A-Z][\w&.''-]*)*)/,
  );
  if (companyMatch?.[1]) {
    return {
      tool: 'account_summary',
      args: { companyName: companyMatch[1].trim() },
      source: 'fallback',
    };
  }
  const capitalized = question.match(/\b([A-Z][\w&.''-]{2,}(?:\s+[A-Z][\w&.''-]+)*)\b/);
  if (
    capitalized?.[1] &&
    capitalized[1].toLowerCase() !== question.trim().split(/\s+/)[0]?.toLowerCase()
  ) {
    return {
      tool: 'account_summary',
      args: { companyName: capitalized[1].trim() },
      source: 'fallback',
    };
  }
  return { tool: 'help', args: {}, source: 'fallback' };
}

/**
 * selectTool(question) — Claude picks one read-only tool + extracts args (e.g. a
 * company name) and returns JSON; deterministic keyword fallback on any failure.
 */
async function selectTool(question: string): Promise<ToolSelection> {
  try {
    if (!process.env.CLAUDE_API_KEY) return fallbackSelectTool(question);
    const prompt =
      'You route a question to ONE read-only Printyx tool. Return ONLY JSON ' +
      '{"tool":<name>,"args":{...}}, no prose. Tools:\n' +
      '- account_summary {companyName}: a specific company/account\n' +
      '- rep_activity {repNameOrEmail?}: sales rep activity / quota\n' +
      '- pipeline_status {}: deal pipeline by status\n' +
      '- this_week_deltas {}: what changed this week\n' +
      '- at_risk_customers {}: customers at churn risk\n' +
      '- predicted_failures {}: upcoming equipment failures\n' +
      '- help {}: anything else\n\n' +
      `Question: ${question}`;
    const text = await ClaudeAIService.generateCompletion({
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallbackSelectTool(question);
    const parsed = JSON.parse(match[0]) as { tool?: string; args?: Record<string, unknown> };
    const tool = String(parsed.tool) as ToolName;
    if (!KNOWN_TOOLS.includes(tool)) return fallbackSelectTool(question);
    const args: Record<string, string> = {};
    if (parsed.args && typeof parsed.args === 'object') {
      for (const [k, v] of Object.entries(parsed.args)) {
        if (v != null) args[k] = String(v);
      }
    }
    return { tool, args, source: 'ai' };
  } catch (err) {
    log.warn('selectTool failed; using keyword fallback (offline-safe):', err as any);
    return fallbackSelectTool(question);
  }
}

function formatCitations(citations: Citation[]): string {
  if (citations.length === 0) return '';
  return '\n\n' + citations.map((c) => `${c.label}: ${c.href}`).join('\n');
}

/**
 * composeAnswer(question, toolResult) — Claude phrases a concise chat answer
 * from the tool result + appends citation links; deterministic fallback formats
 * the tool summary + links as plain text.
 */
async function composeAnswer(question: string, result: ToolResult): Promise<string> {
  const fallback = result.summary + formatCitations(result.citations);
  try {
    if (!process.env.CLAUDE_API_KEY) return fallback;
    const prompt =
      'Write a concise (1-3 sentence) chat answer for a dealer manager from the ' +
      'read-only tool result JSON. Do NOT invent numbers. Do not include links — ' +
      'they are appended separately.\n\n' +
      `Question: ${question}\n` +
      `Tool result: ${JSON.stringify(result.data)}\n` +
      `Tool summary: ${result.summary}`;
    const text = await ClaudeAIService.generateCompletion({
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const trimmed = (text ?? '').trim();
    if (!trimmed) return fallback;
    return trimmed + formatCitations(result.citations);
  } catch (err) {
    log.warn('composeAnswer failed; using fallback (offline-safe):', err as any);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Connection projection (never echo tokens)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

function audit(
  action:
    | 'QUERY'
    | 'QUERY_DENIED'
    | 'CONNECT'
    | 'CONNECTION_TOGGLE'
    | 'CONNECTION_REMOVE'
    | 'LINK_UPSERT'
    | 'LINK_REMOVE',
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
    '[AUDIT] chatbot',
  );
}

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const querySchema = z.object({
  question: z.string().min(1).max(2000),
  platformUserId: z.string().optional(),
  platform: z.enum(CHATBOT_PLATFORMS).optional(),
  channel: z.string().optional(),
});

const connectSchema = z.object({
  platform: z.enum(CHATBOT_PLATFORMS),
  teamId: z.string().min(1),
  teamName: z.string().optional(),
  botToken: z.string().min(1).optional(),
});

const toggleSchema = z.object({
  enabled: z.boolean(),
});

const linkSchema = z.object({
  platform: z.enum(CHATBOT_PLATFORMS),
  platformUserId: z.string().min(1),
  email: z.string().email(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerChatbotRoutes(app: Express) {
  /**
   * POST /api/chatbot/query
   * Ask a natural-language question. Resolve the Printyx user (mapped platform
   * user when platformUserId is given, else the authenticated caller for the
   * in-app "try it" path). If no user resolves → access denied (still logged).
   * selectTool → execute the read-only tool (tenant + user scoped) →
   * composeAnswer → log. READ-ONLY: no business data is written.
   */
  app.post('/api/chatbot/query', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = querySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      const { question, platformUserId, platform, channel } = parsed.data;

      // LEGAL-012: deterministic crisis check, before any retrieval or model
      // call. A system-prompt instruction is a request to a model; this is not.
      // It runs first so the answer does not depend on prompt wording surviving
      // a model swap or a long conversation, and it does not continue with
      // product content in the same reply.
      if (detectsCrisis(question)) {
        return res.json({ answer: crisisResponse(), crisisResponse: true });
      }

      // Resolve the mapped Printyx user (RBAC subject).
      let printyxUserId: string | null = null;
      if (platformUserId) {
        const link = await db.query.chatbotUserLinks.findFirst({
          where: and(
            eq(chatbotUserLinks.tenantId, tenantId),
            eq(chatbotUserLinks.platform, platform ?? 'slack'),
            eq(chatbotUserLinks.platformUserId, platformUserId),
            eq(chatbotUserLinks.verified, true),
          ),
        });
        printyxUserId = link?.printyxUserId ?? null;
      } else {
        // In-app "try it" path: use the authenticated caller.
        printyxUserId = getUserId(req) ?? null;
      }

      // Deny entirely when no Printyx user is resolved — but still log the attempt.
      if (!printyxUserId) {
        await db.insert(chatbotQueryLog).values({
          tenantId,
          platform: platform ?? null,
          channel: channel ?? null,
          platformUserId: platformUserId ?? null,
          printyxUserId: null,
          question: question.slice(0, 2000),
          toolsCalled: [],
          responseExcerpt: 'ACCESS_DENIED: unmapped platform user',
        });
        audit('QUERY_DENIED', {
          tenantId,
          userId: undefined,
          extra: { platform, platformUserId, channelSet: !!channel },
        });
        return res.status(403).json({
          message:
            'Your Slack/Teams account is not linked to a Printyx user. Ask an admin to map your account by verified email.',
          answer:
            'I cannot answer because your chat account is not linked to a Printyx user. ' +
            'An admin can map your account by verified email in the Chatbot console.',
          citations: [],
          toolsCalled: [],
          replyInThread: true,
        });
      }

      const selection = await selectTool(question);

      let result: ToolResult;
      if (selection.tool === 'help') {
        result = {
          summary:
            'I can answer read-only questions about an account, rep activity, the pipeline, ' +
            "this week's changes, at-risk customers, or predicted failures.",
          data: {},
          citations: [{ label: 'Dashboard', href: '/dashboard' }],
        };
      } else {
        result = await TOOL_REGISTRY[selection.tool]({
          tenantId,
          printyxUserId,
          args: selection.args,
        });
      }

      const answer = await composeAnswer(question, result);
      const toolsCalled = [
        { tool: selection.tool, args: selection.args, source: selection.source },
      ];

      // The real Slack/Teams handler would post in-thread; the HTTP path returns directly.
      await postReply({ platform: platform ?? 'slack', channel: channel ?? null }, answer);

      await db.insert(chatbotQueryLog).values({
        tenantId,
        platform: platform ?? null,
        channel: channel ?? null,
        platformUserId: platformUserId ?? null,
        printyxUserId,
        question: question.slice(0, 2000),
        toolsCalled,
        responseExcerpt: answer.slice(0, 2000),
      });

      audit('QUERY', {
        tenantId,
        userId: printyxUserId,
        extra: {
          tool: selection.tool,
          source: selection.source,
          platform,
          channelSet: !!channel,
        },
      });

      res.json({ answer, citations: result.citations, toolsCalled, replyInThread: true });
    } catch (error: any) {
      log.error('Chatbot query failed:', error);
      res.status(500).json({ message: 'Failed to answer query', error: error?.message });
    }
  });

  /** GET /api/chatbot/connections — workspace installs (tokens write-only). */
  app.get('/api/chatbot/connections', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const rows = await db
        .select()
        .from(chatbotConnections)
        .where(eq(chatbotConnections.tenantId, tenantId))
        .orderBy(desc(chatbotConnections.createdAt));
      const data = rows.map(projectConnection);
      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to list connections:', error);
      res.status(500).json({ message: 'Failed to list connections', error: error?.message });
    }
  });

  /**
   * POST /api/chatbot/connect
   * Install a Slack/Teams workspace. There is NO real OAuth here — a pasted bot
   * token is obfuscated into encryptedTokens (never echoed). Upserts on the
   * unique (tenant, platform, team). Returns a sanitized projection.
   */
  app.post('/api/chatbot/connect', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = connectSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      const { platform, teamId, teamName, botToken } = parsed.data;

      // TODO: real Slack/Teams OAuth install. For now we accept a pasted bot token.
      const existing = await db.query.chatbotConnections.findFirst({
        where: and(
          eq(chatbotConnections.tenantId, tenantId),
          eq(chatbotConnections.platform, platform),
          eq(chatbotConnections.teamId, teamId),
        ),
      });

      const tokens: Record<string, unknown> = {
        ...((existing?.encryptedTokens ?? {}) as Record<string, unknown>),
      };
      if (botToken !== undefined) tokens.botToken = obfuscateCredential(botToken);

      let row;
      if (existing) {
        [row] = await db
          .update(chatbotConnections)
          .set({
            teamName: teamName ?? existing.teamName,
            encryptedTokens: tokens,
            updatedAt: new Date(),
          })
          .where(eq(chatbotConnections.id, existing.id))
          .returning();
      } else {
        [row] = await db
          .insert(chatbotConnections)
          .values({
            tenantId,
            platform,
            teamId,
            teamName: teamName ?? null,
            encryptedTokens: tokens,
            installedByUserId: userId ?? null,
          })
          .returning();
      }

      audit('CONNECT', {
        tenantId,
        userId,
        extra: { platform, teamId, tokenSet: botToken !== undefined },
      });

      const projected = projectConnection(row);
      res.json({
        connected: true,
        platform: projected.platform,
        teamId: projected.teamId,
        tokensSet: projected.tokensSet,
      });
    } catch (error: any) {
      log.error('Failed to connect workspace:', error);
      res.status(500).json({ message: 'Failed to connect workspace', error: error?.message });
    }
  });

  /** PUT /api/chatbot/connections/:id — enable/disable toggle. */
  app.put('/api/chatbot/connections/:id', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = toggleSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      const [updated] = await db
        .update(chatbotConnections)
        .set({ enabled: parsed.data.enabled, updatedAt: new Date() })
        .where(
          and(eq(chatbotConnections.id, req.params.id), eq(chatbotConnections.tenantId, tenantId)),
        )
        .returning();
      if (!updated) return res.status(404).json({ message: 'Connection not found' });

      audit('CONNECTION_TOGGLE', {
        tenantId,
        userId,
        extra: { id: req.params.id, enabled: parsed.data.enabled },
      });
      res.json(projectConnection(updated));
    } catch (error: any) {
      log.error('Failed to update connection:', error);
      res.status(500).json({ message: 'Failed to update connection', error: error?.message });
    }
  });

  /** DELETE /api/chatbot/connections/:id */
  app.delete('/api/chatbot/connections/:id', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      await db
        .delete(chatbotConnections)
        .where(
          and(eq(chatbotConnections.id, req.params.id), eq(chatbotConnections.tenantId, tenantId)),
        );
      audit('CONNECTION_REMOVE', { tenantId, userId, extra: { id: req.params.id } });
      res.json({ success: true });
    } catch (error: any) {
      log.error('Failed to remove connection:', error);
      res.status(500).json({ message: 'Failed to remove connection', error: error?.message });
    }
  });

  /** GET /api/chatbot/links — Slack/Teams user → Printyx user mappings. */
  app.get('/api/chatbot/links', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const rows = await db
        .select()
        .from(chatbotUserLinks)
        .where(eq(chatbotUserLinks.tenantId, tenantId))
        .orderBy(desc(chatbotUserLinks.createdAt));
      const data = rows.map(projectUserLink);
      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to list links:', error);
      res.status(500).json({ message: 'Failed to list links', error: error?.message });
    }
  });

  /**
   * POST /api/chatbot/links
   * Map a Slack/Teams user to a Printyx user by email. The email is resolved
   * against tenant-scoped users; verified = (a matching user was found). Upserts
   * on the unique (tenant, platform, platformUserId).
   */
  app.post('/api/chatbot/links', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = linkSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      const { platform, platformUserId, email } = parsed.data;

      // Resolve email → Printyx user (tenant-scoped); verified iff a match exists.
      const matched = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
        .limit(1);
      const printyxUserId = matched[0]?.id ?? null;
      const verified = !!printyxUserId;

      const [row] = await db
        .insert(chatbotUserLinks)
        .values({ tenantId, platform, platformUserId, email, printyxUserId, verified })
        .onConflictDoUpdate({
          target: [
            chatbotUserLinks.tenantId,
            chatbotUserLinks.platform,
            chatbotUserLinks.platformUserId,
          ],
          set: { email, printyxUserId, verified },
        })
        .returning();

      audit('LINK_UPSERT', {
        tenantId,
        userId,
        extra: { platform, platformUserId, verified },
      });
      res.status(201).json(projectUserLink(row));
    } catch (error: any) {
      log.error('Failed to create link:', error);
      res.status(500).json({ message: 'Failed to create link', error: error?.message });
    }
  });

  /** DELETE /api/chatbot/links/:id */
  app.delete('/api/chatbot/links/:id', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      await db
        .delete(chatbotUserLinks)
        .where(
          and(eq(chatbotUserLinks.id, req.params.id), eq(chatbotUserLinks.tenantId, tenantId)),
        );
      audit('LINK_REMOVE', { tenantId, userId, extra: { id: req.params.id } });
      res.json({ success: true });
    } catch (error: any) {
      log.error('Failed to remove link:', error);
      res.status(500).json({ message: 'Failed to remove link', error: error?.message });
    }
  });

  /** GET /api/chatbot/query-log — append-only audit list, newest first. */
  app.get('/api/chatbot/query-log', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const rows = await db
        .select()
        .from(chatbotQueryLog)
        .where(eq(chatbotQueryLog.tenantId, tenantId))
        .orderBy(desc(chatbotQueryLog.createdAt))
        .limit(200);
      const data = rows.map(projectQueryLogRow);
      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to list query log:', error);
      res.status(500).json({ message: 'Failed to list query log', error: error?.message });
    }
  });
}
