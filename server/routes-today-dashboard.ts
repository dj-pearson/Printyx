import { Router } from 'express';
import { db } from './db';
import { eq, and, gte, lte, desc, sql, isNull, isNotNull, or, inArray } from 'drizzle-orm';
import { businessRecordActivities, businessRecords, deals } from '@shared/schema';
import { leadScoreCalculations } from '@shared/lead-scoring-schema';
import { pipelineStages } from '@shared/pipeline-configuration-schema';
import type { Request, Response } from 'express';
import { startOfDay, endOfDay, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';
// Supabase authentication middleware and helpers
import { protectedRoute } from './middleware/supabase-auth';
import { getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-today-dashboard');

interface TenantRequest extends Request {
  tenantId?: string;
  supabaseUser?: {
    id: string;
    email: string;
    tenantId?: string;
    roleId?: string;
  };
}

// QUALITY-002 (batch: phantom-shape server file). Every panel below used to read
// columns and a query namespace that do not exist, and the endpoint could not
// return 200 for anyone:
//
//   db.query.activities        - there is no `activities` export in shared/schema,
//                                so all four activity reads resolved to undefined
//                                and `|| []` turned that into an empty panel. The
//                                optional chaining is what made it silent.
//   businessRecordActivities.status      - no such column (real: outcome / completedDate)
//   leadScoreCalculations.qualificationStatus - no such column (real: leadTier / leadGrade)
//   businessRecords.estimatedDealValue   - no such column (real: estimatedAmount)
//   deals.dealStage / dealName / dealValue - no such columns (real: stageId / title / amount)
//
// The lead read was the fatal one. drizzle does not throw when a column is
// undefined; it emits the operand as empty, so the query became
// `... and  = $3` and Postgres rejected the whole statement with a syntax
// error. Verified by building that exact query and printing toSQL(). So
// GET /api/dashboards/today returned 500 on every request, and the four empty
// activity panels were never even reached.
//
// Everything is rebound to real columns. Where a phantom column encoded a
// predicate with no real equivalent, the predicate is expressed with what the
// schema actually has rather than approximated with an invented one - see the
// stage and lead-tier comments below.
export function registerTodayDashboardRoutes(app: Router) {
  /**
   * GET /api/dashboards/today
   * Returns personalized daily workflow view with:
   * - Overdue activities
   * - Today's schedule
   * - Upcoming activities (next 3 days)
   * - Hot leads (AI-scored)
   * - Pipeline alerts (stalled deals)
   * - Recent wins
   * - Quick stats
   *
   * Protected with Supabase JWT authentication
   */
  app.get('/api/dashboards/today', protectedRoute, async (req: TenantRequest, res: Response) => {
    try {
      // Use Supabase auth helpers to get tenant and user context
      const tenantId = getTenantId(req);

      // NOT personalized, despite the doc comment above. getUserId(req) was read
      // into a variable that nothing used, and every panel below filters by
      // tenant alone - so two reps in the same tenant see an identical "your
      // day". Scoping activities to createdBy and deals to ownerId is the
      // obvious shape, but it changes what the page shows and is a product call,
      // not a typo. Left as-is and recorded rather than changed under cover of a
      // type fix.

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const yesterday = subDays(now, 1);
      const threeDaysFromNow = addDays(now, 3);
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);

      // "Still open" was `status = 'pending'`, and business_record_activities has
      // no status column. completed_date IS NULL is the same idea in terms the
      // table actually has: an activity with no completion timestamp is
      // outstanding. (`outcome` is the other candidate, but it is nullable and
      // free-text - completed, no_response, rescheduled, cancelled, replied - so
      // an unset outcome would not distinguish open from merely unrecorded.)
      const stillOpen = isNull(businessRecordActivities.completedDate);

      // Fetch overdue activities
      const overdueActivities = await db.query.businessRecordActivities.findMany({
        where: and(
          eq(businessRecordActivities.tenantId, tenantId),
          or(
            lte(businessRecordActivities.dueDate, todayStart),
            lte(businessRecordActivities.scheduledDate, yesterday),
          ),
          stillOpen,
        ),
        orderBy: [businessRecordActivities.dueDate],
        limit: 10,
      });

      // Fetch today's activities
      const todayActivities = await db.query.businessRecordActivities.findMany({
        where: and(
          eq(businessRecordActivities.tenantId, tenantId),
          gte(businessRecordActivities.scheduledDate, todayStart),
          lte(businessRecordActivities.scheduledDate, todayEnd),
          stillOpen,
        ),
        orderBy: [businessRecordActivities.scheduledDate],
        limit: 20,
      });

      // Fetch upcoming activities (next 3 days)
      const upcomingActivities = await db.query.businessRecordActivities.findMany({
        where: and(
          eq(businessRecordActivities.tenantId, tenantId),
          gte(businessRecordActivities.scheduledDate, addDays(todayEnd, 1)),
          lte(businessRecordActivities.scheduledDate, threeDaysFromNow),
          stillOpen,
        ),
        orderBy: [businessRecordActivities.scheduledDate],
        limit: 10,
      });

      // customerName on an activity is the company it belongs to, which lives on
      // business_records, not on the activity. One lookup across all three
      // panels rather than a query per row; an activity with no
      // business_record_id, or one pointing at a record that is gone, simply has
      // no name and the caller already guards for that.
      const activityRecordIds = [
        ...new Set(
          [...overdueActivities, ...todayActivities, ...upcomingActivities]
            .map((a) => a.businessRecordId)
            .filter((id): id is string => !!id),
        ),
      ];
      const activityRecords = activityRecordIds.length
        ? await db.query.businessRecords.findMany({
            where: and(
              eq(businessRecords.tenantId, tenantId),
              inArray(businessRecords.id, activityRecordIds),
            ),
            columns: { id: true, companyName: true },
          })
        : [];
      const companyNameByRecordId = new Map(activityRecords.map((r) => [r.id, r.companyName]));

      // Fetch hot leads (high-scoring leads from lead_score_calculations table)
      const hotLeads = await db
        .select()
        .from(leadScoreCalculations)
        .where(
          and(
            eq(leadScoreCalculations.tenantId, tenantId),
            gte(leadScoreCalculations.totalScore, 70), // High-scoring leads (70+)
            // The qualified-or-hot filter that stood here named
            // qualificationStatus, which does not exist. The nearest real column
            // is leadTier (hot / warm / cold), and mapping "qualified" onto a
            // tier would be a guess about what the two vocabularies meant to
            // each other. The score gate above is what makes these hot leads;
            // the filter is dropped rather than approximated.
          ),
        )
        .orderBy(desc(leadScoreCalculations.totalScore))
        .limit(10);

      // CR-027: was one businessRecords query PER hot lead (an N+1). Load every
      // referenced business record in ONE query, then enrich in memory. Output is
      // unchanged: a lead with no leadId, or a leadId with no matching record,
      // still falls back exactly as the per-lead findFirst did.
      const hotLeadIds = [
        ...new Set(hotLeads.map((l) => l.leadId).filter((id): id is string => !!id)),
      ];
      const hotLeadRecords = hotLeadIds.length
        ? ((await db.query.businessRecords?.findMany({
            where: inArray(businessRecords.id, hotLeadIds),
          })) ?? [])
        : [];
      const businessRecordById = new Map(hotLeadRecords.map((r) => [r.id, r]));

      const enrichedHotLeads = hotLeads.map((lead) => {
        const businessRecord = lead.leadId ? businessRecordById.get(lead.leadId) : null;

        return {
          id: lead.leadId || lead.id,
          companyName: businessRecord?.companyName || 'Unknown',
          contactName: businessRecord?.primaryContactName,
          estimatedValue: Number(businessRecord?.estimatedAmount ?? 0),
          score: lead.totalScore,
          status: businessRecord?.status || 'lead',
          lastContact: businessRecord?.lastContactDate,
          reason: `${lead.leadGrade || 'A'} grade lead - ${lead.leadTier || 'qualified'}`,
        };
      });

      // AUDIT-007: this loaded EVERY open deal for the tenant and then filtered the
      // stale ones (>7 days) in JS before keeping 5 — so the work grew with the whole
      // pipeline to render a 5-row panel. Both the staleness predicate and the limit
      // now run in SQL.
      //
      // COALESCE(updated_at, created_at) mirrors the JS exactly (it fell back to
      // createdAt when updatedAt was null). Ordering by that ASC puts the OLDEST —
      // i.e. most stale — first, which is what the JS `sort desc by daysSinceUpdate`
      // produced.
      //
      // The four-stage IN list it filtered on named deals.dealStage, which does
      // not exist: a deal's stage is a FK, deals.stageId -> pipelineStages. That
      // list was enumerating "not closed", and deals.status ('open' | 'won' |
      // 'lost' | 'on_hold', NOT NULL, default 'open') says exactly that without
      // needing the tenant's stage names to match four hardcoded strings - which
      // they would not, since stages are per-tenant and configurable.
      const STALE_AFTER_DAYS = 7;
      const staleDeals = await db.query.deals.findMany({
        where: and(
          eq(deals.tenantId, tenantId),
          eq(deals.status, 'open'),
          sql`COALESCE(${deals.updatedAt}, ${deals.createdAt}) < now() - make_interval(days => ${STALE_AFTER_DAYS})`,
        ),
        orderBy: sql`COALESCE(${deals.updatedAt}, ${deals.createdAt}) ASC`,
        limit: 5,
      });

      // The panel shows a stage NAME, which lives on pipelineStages, not on the
      // deal. One lookup for the handful of stage ids in play, not one per deal.
      const stageIds = [...new Set(staleDeals.map((d) => d.stageId).filter(Boolean))];
      const stageRows = stageIds.length
        ? await db.query.pipelineStages.findMany({
            where: and(eq(pipelineStages.tenantId, tenantId), inArray(pipelineStages.id, stageIds)),
          })
        : [];
      const stageNameById = new Map(
        stageRows.map((st) => [st.id, st.displayName || st.name] as const),
      );

      // Every row here is already stale and already limited/ordered by SQL; this only
      // computes the display fields.
      const pipelineAlerts = staleDeals.map((deal) => {
        const updatedAt = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt!);
        const daysSinceUpdate = Math.floor(
          (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        const stage = stageNameById.get(deal.stageId) ?? 'Unknown';

        return {
          id: deal.id,
          title: deal.title || 'Unnamed Deal',
          companyName: deal.companyName || 'Unknown',
          // amount is numeric(12,2); node-postgres hands numerics back as
          // STRINGS, so the old `sum + (d.dealValue || d.amount || 0)` would have
          // concatenated rather than added had it ever run.
          value: Number(deal.amount ?? 0),
          stage,
          daysSinceUpdate,
          probability: deal.probability || 0,
          staleReason: `Stalled in ${stage} stage for ${daysSinceUpdate} days`,
          isStale: true,
        };
      });

      // Fetch recent wins (closed-won deals this week). 'closed-won' was a
      // dealStage string; the real column is status, whose won value is 'won'.
      const recentWins = await db.query.deals.findMany({
        where: and(
          eq(deals.tenantId, tenantId),
          eq(deals.status, 'won'),
          gte(deals.actualCloseDate, weekStart),
          lte(deals.actualCloseDate, weekEnd),
        ),
        orderBy: [desc(deals.actualCloseDate)],
        limit: 5,
      });

      const enrichedWins = recentWins.map((deal) => ({
        id: deal.id,
        title: deal.title || 'Unnamed Deal',
        companyName: deal.companyName || 'Unknown',
        value: Number(deal.amount ?? 0),
        stage: 'won',
        daysSinceUpdate: 0,
        probability: 100,
      }));

      // Quick stats. These used to load EVERY deal and EVERY lead record for the
      // tenant to produce four scalars, then filter in JS on dealStage - a column
      // that does not exist, so both filters matched everything. Same numbers, as
      // SQL aggregates, and now against real columns. numeric(12,2) comes back as
      // a string from node-postgres, hence Number() on each sum.
      const monthlyQuota = 100000;
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      const [dealTotals] = await db
        .select({
          openValue: sql<string>`COALESCE(SUM(${deals.amount}) FILTER (WHERE ${deals.status} = 'open'), 0)`,
          monthWonValue: sql<string>`COALESCE(SUM(${deals.amount}) FILTER (WHERE ${deals.status} = 'won' AND ${deals.actualCloseDate} >= ${monthStart} AND ${deals.actualCloseDate} < ${monthEnd}), 0)`,
        })
        .from(deals)
        .where(eq(deals.tenantId, tenantId));

      const pipelineValue = Number(dealTotals?.openValue ?? 0);
      const thisMonthRevenue = Number(dealTotals?.monthWonValue ?? 0);
      const quotaAttainment = Math.round((thisMonthRevenue / monthlyQuota) * 100);

      // Conversion rate: of the records that started as leads, how many are now
      // customers. The old JS counted `status === 'active' || recordType ===
      // 'customer'` over a list already filtered to recordType 'lead', so the
      // second half of that OR could never be true - it was counting active
      // leads, not converted ones. Counting customers is what the label says.
      const [leadTotals] = await db
        .select({
          leads: sql<string>`COUNT(*) FILTER (WHERE ${businessRecords.recordType} = 'lead')`,
          customers: sql<string>`COUNT(*) FILTER (WHERE ${businessRecords.recordType} = 'customer')`,
        })
        .from(businessRecords)
        .where(eq(businessRecords.tenantId, tenantId));

      const leadCount = Number(leadTotals?.leads ?? 0);
      const customerCount = Number(leadTotals?.customers ?? 0);
      const denominator = leadCount + customerCount;
      const conversionRate = denominator > 0 ? Math.round((customerCount / denominator) * 100) : 0;

      const [taskTotals] = await db
        .select({ done: sql<string>`COUNT(*)` })
        .from(businessRecordActivities)
        .where(
          and(
            eq(businessRecordActivities.tenantId, tenantId),
            isNotNull(businessRecordActivities.completedDate),
            gte(businessRecordActivities.completedDate, todayStart),
          ),
        );

      const stats = {
        pipelineValue: Math.round(pipelineValue),
        quotaAttainment,
        conversionRate,
        tasksCompleted: Number(taskTotals?.done ?? 0),
      };

      // Return formatted response
      return res.json({
        overdue: overdueActivities.map((a) => formatActivity(a, companyNameByRecordId)),
        today: todayActivities.map((a) => formatActivity(a, companyNameByRecordId)),
        upcoming: upcomingActivities.map((a) => formatActivity(a, companyNameByRecordId)),
        hotLeads: enrichedHotLeads,
        pipelineAlerts: pipelineAlerts.map((alert) => ({
          id: alert.id,
          title: alert.title,
          companyName: alert.companyName,
          value: alert.value,
          stage: alert.stage,
          daysSinceUpdate: alert.daysSinceUpdate,
          probability: alert.probability,
          staleReason: alert.staleReason,
        })),
        recentWins: enrichedWins,
        stats,
      });
    } catch (error) {
      log.error('Error fetching today dashboard:', error);
      return res.status(500).json({
        error: 'Failed to fetch today dashboard',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

// Helper function to format activities.
//
// Typed against the real row rather than `any`. The version this replaces read
// activity.title, .type, .priority, .status, .customerName and .notes - six
// names business_record_activities does not have. Each was the left side of an
// `||`, so they all quietly resolved to undefined and the right side won; the
// two with no real fallback, priority and status, emitted the constants
// 'medium' and 'pending' for every activity regardless of what it was.
//
// priority is gone: no column backs it, and a hardcoded 'medium' on every row is
// a fabricated field, not a default. status stays, because the response contract
// has it and the caller renders it, but it is now DERIVED from completedDate
// instead of asserted.
type ActivityRow = typeof businessRecordActivities.$inferSelect;

export function formatActivity(activity: ActivityRow, companyNames: Map<string, string | null>) {
  return {
    id: activity.id,
    title: activity.subject || 'Untitled Activity',
    type: activity.activityType || 'task',
    scheduledDate: activity.scheduledDate,
    dueDate: activity.dueDate,
    status: activity.completedDate ? 'completed' : 'pending',
    customerName: activity.businessRecordId
      ? (companyNames.get(activity.businessRecordId) ?? undefined)
      : undefined,
    customerId: activity.businessRecordId,
    notes: activity.description,
  };
}
