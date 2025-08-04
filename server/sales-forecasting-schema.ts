/**
 * Sales Forecasting Database Schema
 * Replaces mock data with proper database tables for comprehensive sales forecasting
 */

import { pgTable, varchar, timestamp, integer, decimal, boolean, text, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Sales Forecast Enums
export const forecastTypeEnum = ['monthly', 'quarterly', 'yearly', 'custom'] as const;
export const forecastStatusEnum = ['draft', 'active', 'completed', 'archived'] as const;
export const confidenceLevelEnum = ['low', 'medium', 'high'] as const;

// Sales Forecasts Table
export const salesForecasts = pgTable("sales_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Forecast Details
  forecastName: varchar("forecast_name").notNull(),
  forecastType: varchar("forecast_type").notNull(), // monthly, quarterly, yearly, custom
  description: text("description"),
  
  // Time Period
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Targets
  revenueTarget: decimal("revenue_target", { precision: 12, scale: 2 }).notNull(),
  unitTarget: integer("unit_target"),
  dealCountTarget: integer("deal_count_target"),
  
  // Actuals (updated throughout the period)
  actualRevenue: decimal("actual_revenue", { precision: 12, scale: 2 }).default('0'),
  actualUnits: integer("actual_units").default(0),
  actualDeals: integer("actual_deals").default(0),
  
  // Pipeline Analysis
  pipelineValue: decimal("pipeline_value", { precision: 12, scale: 2 }).default('0'),
  weightedPipelineValue: decimal("weighted_pipeline_value", { precision: 12, scale: 2 }).default('0'),
  probabilityAdjustedRevenue: decimal("probability_adjusted_revenue", { precision: 12, scale: 2 }).default('0'),
  
  // Confidence and Metrics
  confidenceLevel: varchar("confidence_level").notNull(), // low, medium, high
  confidencePercentage: integer("confidence_percentage").default(50), // 0-100
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default('0'),
  averageDealSize: decimal("average_deal_size", { precision: 10, scale: 2 }).default('0'),
  salesCycleLength: integer("sales_cycle_length").default(30), // Days
  
  // Status and Achievement
  status: varchar("status").notNull().default('draft'), // draft, active, completed, archived
  achievementPercentage: decimal("achievement_percentage", { precision: 5, scale: 2 }).default('0'),
  projectedRevenue: decimal("projected_revenue", { precision: 12, scale: 2 }).default('0'),
  gapToTarget: decimal("gap_to_target", { precision: 12, scale: 2 }).default('0'),
  
  // Territory and Team
  salesTerritory: varchar("sales_territory"),
  salesTeam: jsonb("sales_team").$type<string[]>().default([]),
  salesManager: varchar("sales_manager"),
  
  // Notes and Commentary
  forecastNotes: text("forecast_notes"),
  assumptions: text("assumptions"),
  riskFactors: text("risk_factors"),
  opportunities: text("opportunities"),
  
  // System Tracking
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastCalculated: timestamp("last_calculated"),
});

// Pipeline Items Table
export const forecastPipelineItems = pgTable("forecast_pipeline_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  forecastId: varchar("forecast_id").notNull(), // References sales_forecasts.id
  tenantId: varchar("tenant_id").notNull(),
  
  // Deal Information
  businessRecordId: varchar("business_record_id").notNull(), // References business_records.id
  dealName: varchar("deal_name").notNull(),
  customerName: varchar("customer_name").notNull(),
  
  // Financial Details
  dealValue: decimal("deal_value", { precision: 10, scale: 2 }).notNull(),
  weightedValue: decimal("weighted_value", { precision: 10, scale: 2 }),
  probability: integer("probability").default(50), // 0-100%
  
  // Timeline
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  daysInPipeline: integer("days_in_pipeline"),
  
  // Sales Process
  salesStage: varchar("sales_stage").notNull(),
  stageProgress: integer("stage_progress").default(0), // 0-100% through current stage
  nextMilestone: varchar("next_milestone"),
  nextMilestoneDate: timestamp("next_milestone_date"),
  
  // Assignment
  assignedSalesRep: varchar("assigned_sales_rep").notNull(),
  salesTeam: varchar("sales_team"),
  
  // Product/Service Details
  productCategory: varchar("product_category"),
  equipmentType: varchar("equipment_type"),
  serviceType: varchar("service_type"),
  quantity: integer("quantity").default(1),
  
  // Competitive Information
  competitorInvolved: boolean("competitor_involved").default(false),
  primaryCompetitor: varchar("primary_competitor"),
  competitiveAdvantage: text("competitive_advantage"),
  
  // Risk Assessment
  riskLevel: varchar("risk_level").default('medium'), // low, medium, high
  riskFactors: jsonb("risk_factors").$type<string[]>().default([]),
  mitigationStrategies: text("mitigation_strategies"),
  
  // Activity Tracking
  lastActivityDate: timestamp("last_activity_date"),
  nextActivityDate: timestamp("next_activity_date"),
  activityCount: integer("activity_count").default(0),
  
  // Outcome
  outcome: varchar("outcome"), // won, lost, no_decision
  lostReason: varchar("lost_reason"),
  actualRevenue: decimal("actual_revenue", { precision: 10, scale: 2 }),
  
  // System Tracking
  includedInForecast: boolean("included_in_forecast").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forecast Metrics History
export const forecastMetrics = pgTable("forecast_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  forecastId: varchar("forecast_id").notNull(), // References sales_forecasts.id
  tenantId: varchar("tenant_id").notNull(),
  
  // Snapshot Date
  snapshotDate: timestamp("snapshot_date").notNull(),
  
  // Revenue Metrics
  totalPipelineValue: decimal("total_pipeline_value", { precision: 12, scale: 2 }),
  weightedPipelineValue: decimal("weighted_pipeline_value", { precision: 12, scale: 2 }),
  commitRevenue: decimal("commit_revenue", { precision: 12, scale: 2 }),
  bestCaseRevenue: decimal("best_case_revenue", { precision: 12, scale: 2 }),
  worstCaseRevenue: decimal("worst_case_revenue", { precision: 12, scale: 2 }),
  
  // Deal Metrics
  totalDeals: integer("total_deals"),
  newDeals: integer("new_deals"),
  advancedDeals: integer("advanced_deals"),
  closedWonDeals: integer("closed_won_deals"),
  closedLostDeals: integer("closed_lost_deals"),
  
  // Performance Indicators
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }),
  averageDealSize: decimal("average_deal_size", { precision: 10, scale: 2 }),
  averageSalesCycle: integer("average_sales_cycle"),
  velocityScore: decimal("velocity_score", { precision: 8, scale: 2 }),
  
  // Stage Distribution
  stageDistribution: jsonb("stage_distribution").$type<Record<string, number>>(),
  
  // Trend Indicators
  pipelineTrend: varchar("pipeline_trend"), // increasing, stable, decreasing
  velocityTrend: varchar("velocity_trend"), // improving, stable, declining
  qualityTrend: varchar("quality_trend"), // improving, stable, declining
  
  // Territory Performance
  territoryMetrics: jsonb("territory_metrics").$type<Record<string, any>>(),
  
  // System Tracking
  calculatedBy: varchar("calculated_by"),
  calculatedAt: timestamp("calculated_at").defaultNow(),
});

// Forecast Rules and Automation
export const forecastRules = pgTable("forecast_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Rule Details
  ruleName: varchar("rule_name").notNull(),
  ruleType: varchar("rule_type").notNull(), // probability_adjustment, stage_progression, alert
  description: text("description"),
  
  // Conditions
  conditions: jsonb("conditions").$type<Array<{
    field: string;
    operator: string;
    value: any;
    logic?: 'AND' | 'OR';
  }>>(),
  
  // Actions
  actions: jsonb("actions").$type<Array<{
    type: string;
    target: string;
    value: any;
    parameters?: Record<string, any>;
  }>>(),
  
  // Configuration
  priority: integer("priority").default(0),
  isActive: boolean("is_active").default(true),
  frequency: varchar("frequency").default('daily'), // real_time, daily, weekly
  
  // Execution History
  lastExecuted: timestamp("last_executed"),
  executionCount: integer("execution_count").default(0),
  successCount: integer("success_count").default(0),
  errorCount: integer("error_count").default(0),
  
  // System Tracking
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod Schemas for Validation
export const insertSalesForecastSchema = createInsertSchema(salesForecasts);
export const insertForecastPipelineItemSchema = createInsertSchema(forecastPipelineItems);
export const insertForecastMetricSchema = createInsertSchema(forecastMetrics);
export const insertForecastRuleSchema = createInsertSchema(forecastRules);

// Types
export type SalesForecast = typeof salesForecasts.$inferSelect;
export type InsertSalesForecast = typeof salesForecasts.$inferInsert;
export type ForecastPipelineItem = typeof forecastPipelineItems.$inferSelect;
export type InsertForecastPipelineItem = typeof forecastPipelineItems.$inferInsert;
export type ForecastMetric = typeof forecastMetrics.$inferSelect;
export type InsertForecastMetric = typeof forecastMetrics.$inferInsert;
export type ForecastRule = typeof forecastRules.$inferSelect;
export type InsertForecastRule = typeof forecastRules.$inferInsert;