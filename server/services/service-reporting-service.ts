// =====================================================================
// SERVICE REPORTING SERVICE
// Business logic for technician and service reports (Reports 25-28)
// =====================================================================

import { db } from '../db';
import { sql } from 'drizzle-orm';
import type { EnhancedUserContext } from '../middleware/enhanced-rbac-middleware';
import { HierarchicalQueryBuilder } from '../middleware/hierarchical-query-builder';

// =====================================================================
// TYPE DEFINITIONS
// =====================================================================

interface DateRange {
  dateFrom?: Date;
  dateTo?: Date;
}

// Report 25: Personal Service Calls
export interface ServiceCall {
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  equipmentModel: string;
  serialNumber: string;
  priority: string;
  status: string;
  scheduledDate: Date | null;
  completedDate: Date | null;
  duration: number; // minutes
  category: string;
  resolutionType: string | null;
  firstTimeFixRate: boolean;
  customerSatisfaction: number | null;
}

export interface ServiceCallSummary {
  calls: ServiceCall[];
  summary: {
    totalCalls: number;
    completed: number;
    inProgress: number;
    scheduled: number;
    averageDuration: number; // minutes
    firstTimeFixRate: number; // percentage
    averageSatisfaction: number; // 1-5 scale
    callsByPriority: Record<string, number>;
    callsByCategory: Record<string, number>;
  };
}

// Report 26: Personal Parts Usage
export interface PartsUsage {
  date: Date;
  partNumber: string;
  partName: string;
  category: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  ticketNumber: string;
  customerName: string;
  billable: boolean;
}

export interface PartsUsageSummary {
  parts: PartsUsage[];
  summary: {
    totalParts: number;
    totalCost: number;
    billableCost: number;
    nonBillableCost: number;
    topParts: Array<{ partNumber: string; partName: string; quantity: number; cost: number }>;
    costByCategory: Record<string, number>;
  };
}

// Report 27: Personal Time Tracking
export interface TimeEntry {
  date: Date;
  ticketNumber: string;
  customerName: string;
  activityType: string; // travel, diagnostic, repair, documentation
  hours: number;
  billable: boolean;
  status: string; // approved, pending, rejected
  notes: string | null;
}

export interface TimeTrackingSummary {
  entries: TimeEntry[];
  summary: {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    travelHours: number;
    productiveHours: number; // diagnostic + repair
    utilizationRate: number; // percentage (billable / total)
    hoursByActivity: Record<string, number>;
    hoursByDay: Array<{ date: string; hours: number }>;
  };
}

// Report 28: Team Dispatch Queue
export interface DispatchQueueItem {
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  equipmentModel: string;
  location: string;
  priority: string;
  status: string;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  scheduledDate: Date | null;
  estimatedDuration: number; // minutes
  category: string;
  daysOpen: number;
  slaStatus: 'on_time' | 'at_risk' | 'overdue';
  slaDeadline: Date | null;
}

export interface DispatchQueueSummary {
  queue: DispatchQueueItem[];
  summary: {
    totalTickets: number;
    unassigned: number;
    scheduled: number;
    overdue: number;
    atRisk: number;
    byPriority: Record<string, number>;
    byTechnician: Record<string, number>;
    averageDaysOpen: number;
  };
}

// =====================================================================
// CACHE SERVICE
// =====================================================================

interface CachedData<T> {
  data: T;
  expiresAt: Date;
}

class ReportCache {
  private static cache = new Map<string, CachedData<any>>();
  private static DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  static set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const expiresAt = new Date(Date.now() + ttl);
    this.cache.set(key, { data, expiresAt });
  }

  static clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const keys = Array.from(this.cache.keys());
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }
}

// =====================================================================
// SERVICE REPORTING SERVICE
// =====================================================================

export class ServiceReportingService {
  /**
   * Report 25: Get personal service calls for a technician
   */
  static async getPersonalServiceCalls(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
    status?: string,
  ): Promise<ServiceCallSummary> {
    const cacheKey = `service-calls:${userContext.id}:${JSON.stringify(dateRange)}:${status}`;
    const cached = ReportCache.get<ServiceCallSummary>(cacheKey);
    if (cached) return cached;

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND st.createdAt BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const statusFilter = status ? sql`AND st.status = ${status}` : sql``;

    const result = await db.execute(sql`
      SELECT
        st.id as ticket_id,
        st.ticketNumber,
        br.name as customer_name,
        COALESCE(e.model_name, 'N/A') as equipment_model,
        COALESCE(e.serialNumber, 'N/A') as serial_number,
        st.priority,
        st.status,
        st.scheduled_date,
        st.completedAt as completed_date,
        EXTRACT(EPOCH FROM (st.completedAt - st.scheduled_date))/60 as duration,
        st.category,
        st.resolution_type,
        CASE
          WHEN st.first_time_fix = true THEN true
          ELSE false
        END as first_time_fix_rate,
        st.customer_satisfaction_rating as customer_satisfaction
      FROM service_tickets st
      LEFT JOIN business_records br ON st.customerId = br.id
      LEFT JOIN equipment e ON st.equipmentId = e.id
      WHERE st.assigned_technician_id = ${userContext.id}
        AND st.tenantId = ${userContext.tenantId}
        ${dateFilter}
        ${statusFilter}
      ORDER BY
        CASE st.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        st.scheduled_date ASC NULLS LAST
    `);

    const calls: ServiceCall[] = result.rows.map((row: any) => ({
      ticketId: row.ticketId,
      ticketNumber: row.ticketNumber,
      customerName: row.customer_name,
      equipmentModel: row.equipmentModel,
      serialNumber: row.serialNumber,
      priority: row.priority,
      status: row.status,
      scheduledDate: row.scheduled_date ? new Date(row.scheduled_date) : null,
      completedDate: row.completed_date ? new Date(row.completed_date) : null,
      duration: parseFloat(row.duration) || 0,
      category: row.category,
      resolutionType: row.resolution_type,
      firstTimeFixRate: row.first_time_fix_rate,
      customerSatisfaction: row.customer_satisfaction
        ? parseFloat(row.customer_satisfaction)
        : null,
    }));

    // Calculate summary statistics
    const completed = calls.filter((c) => c.status === 'completed').length;
    const inProgress = calls.filter((c) => c.status === 'in_progress').length;
    const scheduled = calls.filter((c) => c.status === 'scheduled').length;

    const completedCalls = calls.filter((c) => c.status === 'completed' && c.duration > 0);
    const averageDuration =
      completedCalls.length > 0
        ? completedCalls.reduce((sum, c) => sum + c.duration, 0) / completedCalls.length
        : 0;

    const firstTimeFixes = completedCalls.filter((c) => c.firstTimeFixRate).length;
    const firstTimeFixRate =
      completedCalls.length > 0 ? (firstTimeFixes / completedCalls.length) * 100 : 0;

    const satisfactionRatings = calls.filter((c) => c.customerSatisfaction !== null);
    const averageSatisfaction =
      satisfactionRatings.length > 0
        ? satisfactionRatings.reduce((sum, c) => sum + (c.customerSatisfaction || 0), 0) /
          satisfactionRatings.length
        : 0;

    // Group by priority
    const callsByPriority: Record<string, number> = {};
    calls.forEach((call) => {
      callsByPriority[call.priority] = (callsByPriority[call.priority] || 0) + 1;
    });

    // Group by category
    const callsByCategory: Record<string, number> = {};
    calls.forEach((call) => {
      callsByCategory[call.category] = (callsByCategory[call.category] || 0) + 1;
    });

    const summary: ServiceCallSummary = {
      calls,
      summary: {
        totalCalls: calls.length,
        completed,
        inProgress,
        scheduled,
        averageDuration,
        firstTimeFixRate,
        averageSatisfaction,
        callsByPriority,
        callsByCategory,
      },
    };

    ReportCache.set(cacheKey, summary);
    return summary;
  }

  /**
   * Report 26: Get personal parts usage for a technician
   */
  static async getPersonalPartsUsage(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<PartsUsageSummary> {
    const cacheKey = `parts-usage:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<PartsUsageSummary>(cacheKey);
    if (cached) return cached;

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND pu.used_at BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const result = await db.execute(sql`
      SELECT
        pu.used_at::date as date,
        pu.partNumber,
        pu.part_name,
        pu.category,
        pu.quantity as quantity_used,
        pu.unit_cost,
        (pu.quantity * pu.unit_cost) as total_cost,
        st.ticketNumber,
        br.name as customer_name,
        pu.billable
      FROM parts_usage pu
      LEFT JOIN service_tickets st ON pu.ticketId = st.id
      LEFT JOIN business_records br ON st.customerId = br.id
      WHERE pu.technician_id = ${userContext.id}
        AND pu.tenantId = ${userContext.tenantId}
        ${dateFilter}
      ORDER BY pu.used_at DESC
    `);

    const parts: PartsUsage[] = result.rows.map((row: any) => ({
      date: new Date(row.date),
      partNumber: row.partNumber,
      partName: row.part_name,
      category: row.category,
      quantityUsed: parseInt(row.quantity_used),
      unitCost: parseFloat(row.unit_cost),
      totalCost: parseFloat(row.total_cost),
      ticketNumber: row.ticketNumber,
      customerName: row.customer_name,
      billable: row.billable,
    }));

    // Calculate summary statistics
    const totalCost = parts.reduce((sum, p) => sum + p.totalCost, 0);
    const billableCost = parts.filter((p) => p.billable).reduce((sum, p) => sum + p.totalCost, 0);
    const nonBillableCost = totalCost - billableCost;

    // Top parts by cost
    const partsTotals = new Map<
      string,
      { partNumber: string; partName: string; quantity: number; cost: number }
    >();
    parts.forEach((part) => {
      const key = part.partNumber;
      const existing = partsTotals.get(key);
      if (existing) {
        existing.quantity += part.quantityUsed;
        existing.cost += part.totalCost;
      } else {
        partsTotals.set(key, {
          partNumber: part.partNumber,
          partName: part.partName,
          quantity: part.quantityUsed,
          cost: part.totalCost,
        });
      }
    });

    const topParts = Array.from(partsTotals.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    // Cost by category
    const costByCategory: Record<string, number> = {};
    parts.forEach((part) => {
      costByCategory[part.category] = (costByCategory[part.category] || 0) + part.totalCost;
    });

    const summary: PartsUsageSummary = {
      parts,
      summary: {
        totalParts: parts.reduce((sum, p) => sum + p.quantityUsed, 0),
        totalCost,
        billableCost,
        nonBillableCost,
        topParts,
        costByCategory,
      },
    };

    ReportCache.set(cacheKey, summary);
    return summary;
  }

  /**
   * Report 27: Get personal time tracking for a technician
   */
  static async getPersonalTimeTracking(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<TimeTrackingSummary> {
    const cacheKey = `time-tracking:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<TimeTrackingSummary>(cacheKey);
    if (cached) return cached;

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND te.entry_date BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const result = await db.execute(sql`
      SELECT
        te.entry_date::date as date,
        st.ticketNumber,
        br.name as customer_name,
        te.activity_type,
        te.hours,
        te.billable,
        te.status,
        te.notes
      FROM time_entries te
      LEFT JOIN service_tickets st ON te.ticketId = st.id
      LEFT JOIN business_records br ON st.customerId = br.id
      WHERE te.technician_id = ${userContext.id}
        AND te.tenantId = ${userContext.tenantId}
        ${dateFilter}
      ORDER BY te.entry_date DESC
    `);

    const entries: TimeEntry[] = result.rows.map((row: any) => ({
      date: new Date(row.date),
      ticketNumber: row.ticketNumber,
      customerName: row.customer_name,
      activityType: row.activity_type,
      hours: parseFloat(row.hours),
      billable: row.billable,
      status: row.status,
      notes: row.notes,
    }));

    // Calculate summary statistics
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    const billableHours = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.hours, 0);
    const nonBillableHours = totalHours - billableHours;
    const travelHours = entries
      .filter((e) => e.activityType === 'travel')
      .reduce((sum, e) => sum + e.hours, 0);
    const productiveHours = entries
      .filter((e) => e.activityType === 'diagnostic' || e.activityType === 'repair')
      .reduce((sum, e) => sum + e.hours, 0);

    const utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

    // Hours by activity
    const hoursByActivity: Record<string, number> = {};
    entries.forEach((entry) => {
      hoursByActivity[entry.activityType] =
        (hoursByActivity[entry.activityType] || 0) + entry.hours;
    });

    // Hours by day
    const hoursByDayMap = new Map<string, number>();
    entries.forEach((entry) => {
      const dateKey = entry.date.toISOString().split('T')[0];
      hoursByDayMap.set(dateKey, (hoursByDayMap.get(dateKey) || 0) + entry.hours);
    });

    const hoursByDay = Array.from(hoursByDayMap.entries())
      .map(([date, hours]) => ({ date, hours }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const summary: TimeTrackingSummary = {
      entries,
      summary: {
        totalHours,
        billableHours,
        nonBillableHours,
        travelHours,
        productiveHours,
        utilizationRate,
        hoursByActivity,
        hoursByDay,
      },
    };

    ReportCache.set(cacheKey, summary);
    return summary;
  }

  /**
   * Report 28: Get team dispatch queue (for Team Leads)
   */
  static async getTeamDispatchQueue(
    userContext: EnhancedUserContext,
    filterBy?: {
      priority?: string;
      status?: string;
      assignedTo?: string;
    },
  ): Promise<DispatchQueueSummary> {
    const cacheKey = `dispatch-queue:${userContext.id}:${JSON.stringify(filterBy)}`;
    const cached = ReportCache.get<DispatchQueueSummary>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleUserIds = await queryBuilder.getAccessibleUserIds();

    if (accessibleUserIds.length === 0) {
      return {
        queue: [],
        summary: {
          totalTickets: 0,
          unassigned: 0,
          scheduled: 0,
          overdue: 0,
          atRisk: 0,
          byPriority: {},
          byTechnician: {},
          averageDaysOpen: 0,
        },
      };
    }

    const priorityFilter = filterBy?.priority ? sql`AND st.priority = ${filterBy.priority}` : sql``;
    const statusFilter = filterBy?.status ? sql`AND st.status = ${filterBy.status}` : sql``;
    const assignedFilter = filterBy?.assignedTo
      ? sql`AND st.assigned_technician_id = ${filterBy.assignedTo}`
      : sql``;

    const result = await db.execute(sql`
      SELECT
        st.id as ticket_id,
        st.ticketNumber,
        br.name as customer_name,
        COALESCE(e.model_name, 'N/A') as equipment_model,
        l.name as location,
        st.priority,
        st.status,
        st.assigned_technician_id,
        u.fullName as assigned_technician_name,
        st.scheduled_date,
        st.estimated_duration,
        st.category,
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - st.createdAt)) as days_open,
        st.sla_deadline,
        CASE
          WHEN st.sla_deadline IS NULL THEN 'on_time'
          WHEN st.sla_deadline < CURRENT_TIMESTAMP THEN 'overdue'
          WHEN st.sla_deadline < CURRENT_TIMESTAMP + INTERVAL '4 hours' THEN 'at_risk'
          ELSE 'on_time'
        END as sla_status
      FROM service_tickets st
      LEFT JOIN business_records br ON st.customerId = br.id
      LEFT JOIN equipment e ON st.equipmentId = e.id
      LEFT JOIN locations l ON br.locationId = l.id
      LEFT JOIN users u ON st.assigned_technician_id = u.id
      WHERE st.tenantId = ${userContext.tenantId}
        AND st.status IN ('open', 'scheduled', 'in_progress')
        AND (
          st.assigned_technician_id = ANY(${sql.raw(`ARRAY[${accessibleUserIds.map((id) => `'${id}'`).join(',')}]`)})
          OR st.assigned_technician_id IS NULL
        )
        ${priorityFilter}
        ${statusFilter}
        ${assignedFilter}
      ORDER BY
        CASE st.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        st.sla_deadline ASC NULLS LAST,
        st.scheduled_date ASC NULLS LAST
    `);

    const queue: DispatchQueueItem[] = result.rows.map((row: any) => ({
      ticketId: row.ticketId,
      ticketNumber: row.ticketNumber,
      customerName: row.customer_name,
      equipmentModel: row.equipmentModel,
      location: row.location,
      priority: row.priority,
      status: row.status,
      assignedTechnicianId: row.assigned_technician_id,
      assignedTechnicianName: row.assigned_technician_name,
      scheduledDate: row.scheduled_date ? new Date(row.scheduled_date) : null,
      estimatedDuration: parseInt(row.estimated_duration) || 0,
      category: row.category,
      daysOpen: parseInt(row.days_open),
      slaStatus: row.sla_status as 'on_time' | 'at_risk' | 'overdue',
      slaDeadline: row.sla_deadline ? new Date(row.sla_deadline) : null,
    }));

    // Calculate summary statistics
    const unassigned = queue.filter((item) => !item.assignedTechnicianId).length;
    const scheduled = queue.filter((item) => item.scheduledDate !== null).length;
    const overdue = queue.filter((item) => item.slaStatus === 'overdue').length;
    const atRisk = queue.filter((item) => item.slaStatus === 'at_risk').length;

    // Group by priority
    const byPriority: Record<string, number> = {};
    queue.forEach((item) => {
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
    });

    // Group by technician
    const byTechnician: Record<string, number> = {};
    queue.forEach((item) => {
      if (item.assignedTechnicianName) {
        byTechnician[item.assignedTechnicianName] =
          (byTechnician[item.assignedTechnicianName] || 0) + 1;
      }
    });

    const averageDaysOpen =
      queue.length > 0 ? queue.reduce((sum, item) => sum + item.daysOpen, 0) / queue.length : 0;

    const summary: DispatchQueueSummary = {
      queue,
      summary: {
        totalTickets: queue.length,
        unassigned,
        scheduled,
        overdue,
        atRisk,
        byPriority,
        byTechnician,
        averageDaysOpen,
      },
    };

    ReportCache.set(cacheKey, summary);
    return summary;
  }

  /**
   * Clear cache for a specific user or pattern
   */
  static clearCache(pattern?: string): void {
    ReportCache.clear(pattern);
  }
}
