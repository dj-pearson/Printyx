// The four list widgets: activity, urgent, my-tasks, team-performance
// (DASH-METRICS-001).
//
// All four were invented. The activity feed named a customer, an invoice number
// and a dollar amount; urgent listed four incidents, one marked critical; the
// task list had four tasks with one already ticked; and team-performance was
// five named people with revenue and a leaderboard rank - a statement about
// colleagues, typed in, which is the least defensible thing a dashboard can do.
import { fetchInBatches } from '../../_shared/batch-fetch.ts';
import { deriveOperationalAlerts } from '../../_shared/operational-alerts.ts';
import { type Admin, sumNumericField, WIDGET_LIMIT } from './_context.ts';

export interface ListResult {
  items: Array<Record<string, unknown>>;
  unbacked?: string[];
  reason?: string;
}

/** The most recent real events on this tenant's accounts. */
export async function dashboardActivity(admin: Admin, tenantId: string): Promise<ListResult> {
  const { data, error } = await admin
    .from('business_record_activities')
    .select(
      'id, business_record_id, activity_type, subject, description, outcome, completed_date, created_at, created_by',
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(WIDGET_LIMIT);
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return { items: [] };

  // The feed names an account, so the ids are resolved in one read rather than
  // one per row. business_records carries company_name, not `name`.
  const names = new Map<string, string>();
  const recordIds = rows.map((r) => String(r.business_record_id ?? '')).filter(Boolean);
  if (recordIds.length > 0) {
    const accounts = await fetchInBatches<Record<string, unknown>>(recordIds, 'id', () =>
      admin.from('business_records').select('id, company_name').eq('tenant_id', tenantId),
    );
    for (const account of accounts) {
      names.set(String(account.id), String(account.company_name ?? ''));
    }
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.activity_type,
      subject: row.subject,
      description: row.description,
      outcome: row.outcome,
      accountId: row.business_record_id,
      accountName: names.get(String(row.business_record_id ?? '')) || null,
      occurredAt: row.completed_date ?? row.created_at,
      createdBy: row.created_by,
    })),
  };
}

/**
 * Urgent items are the same four alert families the notification bell shows
 * (_shared/operational-alerts.ts), not a second opinion about what is wrong.
 */
export async function dashboardUrgent(admin: Admin, tenantId: string): Promise<ListResult> {
  const alerts = await deriveOperationalAlerts(admin, tenantId);
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return {
    items: alerts
      .sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))
      .slice(0, WIDGET_LIMIT),
  };
}

/** The signed-in user's open tasks, soonest due first. */
export async function dashboardMyTasks(
  admin: Admin,
  tenantId: string,
  userId: string,
): Promise<ListResult> {
  const { data, error } = await admin
    .from('tasks')
    .select('id, title, description, status, priority, due_date, completion_percentage')
    .eq('tenant_id', tenantId)
    .eq('assigned_to', userId)
    .not('status', 'in', '(completed,cancelled)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(WIDGET_LIMIT);
  if (error) throw error;

  return {
    items: ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueDate: row.due_date,
      percentComplete: row.completion_percentage,
    })),
  };
}

/** Quarters the team-performance window covers. */
export const TEAM_WINDOW_DAYS = 90;

/**
 * Closed-won revenue per owner over the last 90 days.
 *
 * ATTAINMENT IS NOT HERE AND THAT IS THE POINT. A leaderboard normally shows a
 * percentage against quota, and there is no quota table in this schema -
 * `sales_quotas` is named by several reporting services and exists in no
 * migration (CR-017). Ranking people against a number nobody set is the
 * fabrication this widget started as, so the response ranks them on revenue
 * that actually closed and names quota attainment as unbacked.
 */
export async function dashboardTeamPerformance(
  admin: Admin,
  tenantId: string,
): Promise<ListResult> {
  const since = new Date(Date.now() - TEAM_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from('opportunities')
    .select('owner_id, owner_name, amount, close_date, is_won')
    .eq('tenant_id', tenantId)
    .eq('is_won', true)
    .gte('close_date', since);
  if (error) throw error;

  const byOwner = new Map<string, { name: string; rows: Array<Record<string, unknown>> }>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const id = String(row.owner_id ?? '');
    if (!id) continue;
    const bucket = byOwner.get(id);
    if (bucket) bucket.rows.push(row);
    else byOwner.set(id, { name: String(row.owner_name ?? ''), rows: [row] });
  }

  const items = [...byOwner.entries()]
    .map(([ownerId, bucket]) => ({
      ownerId,
      name: bucket.name || null,
      wonCount: bucket.rows.length,
      wonRevenue: sumNumericField(bucket.rows, 'amount'),
      quotaAttainment: null,
    }))
    .sort((a, b) => b.wonRevenue - a.wonRevenue)
    .slice(0, WIDGET_LIMIT);

  return {
    items,
    unbacked: ['quotaAttainment'],
    reason:
      'No quota table exists in this schema, so attainment against target cannot be computed.',
  };
}
