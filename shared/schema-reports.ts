import { sql, relations } from 'drizzle-orm';
import { pgTable, varchar, text, jsonb, timestamp, boolean, index, uuid, decimal, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Reports schema for storing generated reports and report configurations
export const reportConfigurations = pgTable(
  'report_configurations',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    reportKey: varchar('report_key').notNull(), // e.g., 'sla-compliance', 'sales-pipeline'
    reportName: varchar('report_name').notNull(),
    reportCategory: varchar('report_category').notNull(), // service, sales, billing, inventory, etc
    description: text('description'),
    requiredPermission: varchar('required_permission'),
    applicableRoles: text('applicable_roles').array(),
    dateRange: varchar('date_range').default('last_30_days'), // last_7_days, last_30_days, last_90_days, custom
    customStartDate: timestamp('custom_start_date'),
    customEndDate: timestamp('custom_end_date'),
    filters: jsonb('filters').default({}), // Additional filters like location, technician, etc
    isScheduled: boolean('is_scheduled').default(false),
    scheduleFrequency: varchar('schedule_frequency'), // daily, weekly, monthly
    emailRecipients: text('email_recipients').array(),
    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    tenantIdx: index('report_config_tenant_idx').on(table.tenantId),
    keyIdx: index('report_config_key_idx').on(table.reportKey),
  }),
);

export const reportSnapshots = pgTable(
  'report_snapshots',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    configurationId: varchar('configuration_id').notNull(),
    reportKey: varchar('report_key').notNull(),
    generatedAt: timestamp('generated_at').defaultNow(),
    dateRangeStart: timestamp('date_range_start').notNull(),
    dateRangeEnd: timestamp('date_range_end').notNull(),
    reportData: jsonb('report_data').notNull(), // The actual report data
    summary: jsonb('summary'), // Key metrics summary
    downloadUrl: varchar('download_url'), // URL for PDF/CSV download
    createdBy: varchar('created_by'),
  },
  (table) => ({
    tenantIdx: index('snapshot_tenant_idx').on(table.tenantId),
    configIdx: index('snapshot_config_idx').on(table.configurationId),
  }),
);

// Report data types
export type ReportConfiguration = typeof reportConfigurations.$inferSelect;
export type ReportSnapshot = typeof reportSnapshots.$inferSelect;

// Insert schemas
export const insertReportConfigurationSchema = createInsertSchema(reportConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReportSnapshotSchema = createInsertSchema(reportSnapshots).omit({
  id: true,
  generatedAt: true,
});

export type InsertReportConfiguration = z.infer<typeof insertReportConfigurationSchema>;
export type InsertReportSnapshot = z.infer<typeof insertReportSnapshotSchema>;

// Report data structures for the actual reports
export interface ServiceSLAComplianceData {
  period: string;
  totalTickets: number;
  onTimeTickets: number;
  lateTickets: number;
  slaCompliancePercent: number;
  averageResolutionTime: number;
  trend: Array<{ date: string; percent: number }>;
  byTechnician: Array<{ technicianName: string; compliance: number; ticketCount: number }>;
  byPriority: Array<{ priority: string; compliance: number; ticketCount: number }>;
}

export interface SalesPipelineAnalysisData {
  totalPipelineValue: number;
  dealCount: number;
  averageDealValue: number;
  conversionRate: number;
  byStage: Array<{ stage: string; value: number; count: number; avgValue: number }>;
  velocityDays: number; // Average days from stage entry to close
  trend: Array<{ date: string; value: number; dealCount: number }>;
  topReps: Array<{ repName: string; pipelineValue: number; dealCount: number }>;
}

export interface RevenueRecognitionData {
  period: string;
  totalRevenue: number;
  recognizedRevenue: number;
  deferredRevenue: number;
  byContractType: Array<{ type: string; revenue: number; percent: number }>;
  byLocation: Array<{ location: string; revenue: number; percent: number }>;
  monthlyTrend: Array<{ month: string; revenue: number }>;
  annualRecognition: number;
}

export interface CustomerHealthScoreData {
  averageHealthScore: number;
  healthDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    critical: number;
  };
  atRiskCustomers: Array<{
    customerId: string;
    customerName: string;
    healthScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    lastEngagement: string;
  }>;
  trend: Array<{ date: string; averageScore: number }>;
  factors: Array<{ factor: string; impact: number; weight: number }>;
}

export interface TechnicianUtilizationData {
  period: string;
  totalTechnicians: number;
  averageUtilizationPercent: number;
  byTechnician: Array<{
    technicianId: string;
    name: string;
    hoursWorked: number;
    hoursAssigned: number;
    utilizationPercent: number;
    ticketsCompleted: number;
    averageTicketTime: number;
  }>;
  utilizationBuckets: {
    excellent: number; // 90-100%
    good: number; // 75-89%
    fair: number; // 50-74%
    underutilized: number; // <50%
  };
  trend: Array<{ date: string; avgUtilization: number }>;
}
