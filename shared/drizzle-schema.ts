/**
 * Unified schema entry point for drizzle-kit.
 *
 * shared/schema.ts only partially re-exports from specialized schema files,
 * so drizzle-kit needs this single file to see ALL pgTable and pgEnum definitions.
 *
 * Rules:
 * - Every pgTable and pgEnum must appear exactly ONCE in drizzle-kit's view
 * - Use `export *` where safe, explicit named exports where conflicts exist
 * - When two files define the same pgEnum with different values, pick one
 */

// ─── Main schema (120+ tables, partial re-exports from ~37 specialized schemas) ───
export * from './schema';

// ─── Schemas NOT imported by schema.ts at all (no conflicts) ───
export * from './accessibility-schema';
export * from './api-key-schema';
export * from './auth-schema';
export * from './csv-import-schema';
export * from './customer-success-schema';
export * from './lead-scoring-schema';
export * from './outreach-schema';
export * from './soc2-compliance-schema';
export * from './sso-schema';
// team-alerts-schema: `alertSeverityEnum` and `alertStatusEnum` conflict with intelligent-alerts-schema
export {
  alertTypeEnum,
  // alertSeverityEnum — SKIPPED: conflicts with intelligent-alerts-schema re-exported via schema.ts
  // alertStatusEnum — SKIPPED: conflicts with intelligent-alerts-schema re-exported via schema.ts
  notificationChannelEnum,
  alertConfigurations,
  alertInstances,
  alertNotificationLog,
} from './team-alerts-schema';

// gdpr-core-schema: safe except `exportFormatEnum` conflicts with reporting-schema
export {
  consentRecords,
  consentAuditTrail,
  consentPreferencesTemplate,
  dataProcessingAgreements,
  dpaComplianceChecks,
  personalDataExports,
  dataExportTemplates,
  duplicateDetectionRules,
  duplicateMatches,
  contactMergeHistory,
  duplicateScanJobs,
  consentTypeEnum,
  consentStatusEnum,
  consentSourceEnum,
  legalBasisEnum,
  dpaStatusEnum,
  vendorRiskLevelEnum,
  // exportFormatEnum — SKIPPED: conflicts with reporting-schema (different enum values)
  exportStatusEnum,
} from './gdpr-core-schema';

// reporting-schema: `dashboardLayouts` conflicts with schema-dashboard (re-exported via schema.ts)
export {
  reportCategoryEnum,
  organizationalScopeEnum,
  reportVisualizationEnum,
  exportFormatEnum,
  reportStatusEnum,
  performanceLevelEnum,
  timePeriodEnum,
  deliveryMethodEnum,
  targetTypeEnum,
  displayFormatEnum,
  activityTypeEnum,
  reportDefinitions,
  userReportPreferences,
  reportSchedules,
  reportExecutions,
  kpiDefinitions,
  kpiValues,
  userReportActivity,
  // dashboardLayouts — SKIPPED: conflicts with schema-dashboard re-exported via schema.ts
} from './reporting-schema';

// task-schema: `tasks` and `projects` conflict with schema.ts direct definitions
export {
  taskPriorityEnum,
  taskStatusEnum,
  projectStatusEnum,
  // tasks — SKIPPED: defined in schema.ts
  // projects — SKIPPED: defined in schema.ts
  taskComments,
  timeEntries,
  projectTemplates,
} from './task-schema';

// quote-proposal-schema: many tables conflict with schema.ts direct definitions
export {} from // proposalTemplates — SKIPPED: defined in schema.ts
// equipmentPackages — SKIPPED: defined in schema.ts
// proposals — SKIPPED: defined in schema.ts
// proposalLineItems — SKIPPED: defined in schema.ts
// proposalComments — SKIPPED: defined in schema.ts
// proposalAnalytics — SKIPPED: defined in schema.ts
// proposalApprovals — SKIPPED: defined in schema.ts
'./quote-proposal-schema';

// gps-tracking-schema: `locationHistory` conflicts with mobile-service-schema (re-exported via schema.ts)
export {
  technicianLocations,
  // locationHistory — SKIPPED: conflicts with mobile-service-schema
  routeAssignments,
  routeDeviations,
  etaCalculations,
  geofences,
  geofenceEvents,
} from './gps-tracking-schema';

// schema-reports: check if imported by schema.ts
export * from './schema-reports';

// ─── Missing tables from partially-re-exported schemas ───

// advanced-billing-schema: schema.ts only re-exports billingRules, meterAnomalies,
// billingSchedules, invoiceGenerationLogs
export { billingDisputes, creditMemos } from './advanced-billing-schema';

// customer-portal-schema: schema.ts re-exports ~8 tables/enums but misses these
export {
  customerServiceRequestStatusHistory,
  customerMaintenanceAppointments,
  customerSatisfactionSurveyTemplates,
  customerSatisfactionSurveyQuestions,
  customerSatisfactionSurveys,
  customerSatisfactionSurveyResponses,
  customerSatisfactionAnalytics,
  technicianAvailabilitySlots,
  maintenanceTypeEnum,
  appointmentStatusEnum,
  satisfactionSurveyTypeEnum,
  satisfactionQuestionTypeEnum,
  satisfactionResponseStatusEnum,
  equipmentHealthStatusEnum,
  usageTypeEnum,
  periodTypeEnum,
} from './customer-portal-schema';

// knowledge-base-schema: schema.ts re-exports most but misses these
export {
  articleBookmarks,
  readingHistory,
  articleRatings,
  articleVotes,
} from './knowledge-base-schema';

// content-marketing-schema: schema.ts re-exports most but misses blogContentQueue
export { blogContentQueue, blogContentQueueStatusEnum } from './content-marketing-schema';

// deal-desk-schema: schema.ts imports but doesn't re-export ANY tables/enums
export {
  approvalRules,
  approvalRequests,
  approvalComments,
  discountAnalytics,
  approvalDelegations,
  approvalTypeEnum,
  approvalStatusEnum,
  approvalChainTypeEnum,
  thresholdTypeEnum,
} from './deal-desk-schema';

// email-parser-schema: schema.ts imports but doesn't re-export ANY tables
export {
  processedEmails,
  parsingCorrections,
  emailMonitorConfig,
  emailAutoResponses,
} from './email-parser-schema';

// enhanced-service-schema: schema.ts imports but doesn't re-export tables/enums
export {
  phoneInTickets,
  technicianTicketSessions,
  ticketPartsRequests,
  workflowSteps,
  enhancedTicketStatusEnum,
  ticketPriorityEnum,
  issueCategoryEnum,
  contactMethodEnum,
} from './enhanced-service-schema';

// manufacturer-integration-schema: schema.ts imports but doesn't re-export tables/enums
export {
  manufacturerIntegrations,
  deviceRegistrations,
  deviceMetrics,
  integrationAuditLogs,
  thirdPartyIntegrations,
  manufacturerEnum,
  integrationStatusEnum,
  collectionFrequencyEnum,
  deviceStatusEnum,
  authMethodEnum,
} from './manufacturer-integration-schema';

// manufacturer-order-schema: schema.ts imports but doesn't re-export tables
export {
  manufacturerOrders,
  manufacturerOrderLineItems,
  manufacturerOrderConfirmations,
  manufacturerOrderShipments,
  manufacturerOrderExceptions,
  manufacturerConnections,
} from './manufacturer-order-schema';

// mobile-service-schema: schema.ts imports but doesn't re-export tables/enums
export {
  mobileServiceSessions,
  timeTrackingEntries,
  servicePhotos,
  // locationHistory — already re-exported from schema.ts
  fieldServiceStatusEnum,
  checkInTypeEnum,
} from './mobile-service-schema';

// pipeline-configuration-schema: schema.ts imports but doesn't re-export tables/enums
export {
  pipelineTemplates,
  pipelineStages,
  stageTransitions,
  dealStageHistory,
  pipelineAutomationLogs,
  pipelineTypeEnum,
} from './pipeline-configuration-schema';

// printyx-client-schema: schema.ts imports but doesn't re-export tables
export {
  clientRegistrations,
  clientCollectedMetrics,
  monitoredDevices,
  // clientActivityLogs — conflicts with client-monitor-schema
  tonerAlerts,
  oidMappings,
  deviceMeterHistory,
} from './printyx-client-schema';

// product-pricing-schema: schema.ts imports but doesn't re-export tables/enums
export {
  companyPricingSettings,
  enhancedProductPricing,
  enhancedQuotePricing,
  enhancedQuotePricingLineItems,
  priceChangeApprovals,
  pricingApprovalStatusEnum,
  markupTypeEnum,
} from './product-pricing-schema';

// quickbooks-schema: schema.ts imports but doesn't re-export tables
export {
  qbVendors,
  glAccounts,
  paymentTerms,
  paymentMethods,
  quickbooksIntegrations,
  vendorBills,
} from './quickbooks-schema';

// service-analysis-schema: schema.ts imports but doesn't re-export tables/enums
export {
  serviceCallAnalysis,
  servicePartsUsed,
  partsOrders,
  partsOrderItems,
  serviceOutcomeEnum,
  partsOrderStatusEnum,
  analysisTypeEnum,
} from './service-analysis-schema';

// warehouse-fpy-schema: schema.ts imports but doesn't re-export tables/enums
export {
  warehouseKittingOperations,
  fpyMetrics,
  autoInvoiceGeneration,
  warehouseOperationStatusEnum,
  kitQualityStatusEnum,
} from './warehouse-fpy-schema';

// workflow-automation-schema: schema.ts imports but doesn't re-export tables/enums
export {
  workflows,
  workflowVersions,
  workflowTriggers,
  triggerSchedules,
  workflowConditions,
  workflowStepsAutomation,
  workflowStepTransitions,
  workflowExecutions,
  workflowExecutionSteps,
  workflowExecutionEvents,
  workflowTemplates,
  templateVariables,
  workflowEventRegistry,
  assignmentGroups,
  workflowApprovals,
  workflowStatusEnum,
  triggerTypeEnum,
  stepActionTypeEnum,
  executionStatusEnum,
  stepExecutionStatusEnum,
  conditionOperatorEnum,
  logicalOperatorEnum,
} from './workflow-automation-schema';

// equipment-schema: schema.ts re-exports via `export *` but also defines its own
// purchaseOrders/purchaseOrderItems. The remaining missing tables:
export {
  equipmentLifecycleTransitions,
  lifecycleTransitionRules,
  equipmentDisposal,
  equipmentTradeIns,
  equipmentTransfers,
  equipmentBulkOperations,
} from './equipment-schema';

// auto-supply-replenishment-schema: schema.ts imports but doesn't re-export tables
export {
  supplyReplenishmentRules,
  supplyMonitoring,
  supplyUsageHistory,
  autoSupplyOrders,
  supplyReplenishmentAnalytics,
} from './auto-supply-replenishment-schema';

// platform-crm-schema: schema.ts imports but doesn't re-export tables
export {
  platformBusinessRecords,
  platformContacts,
  platformDeals,
  platformActivities,
  platformLeadScoringRules,
  platformLeadScoreCalculations,
  platformBantQualification,
  platformSalesTerritories,
  platformLeadAssignmentRules,
  platformRepCapacity,
  platformLeadAssignmentHistory,
  platformHealthScores,
  platformChurnPredictions,
  platformSuccessInterventions,
  platformRenewalOpportunities,
  platformSalesGoals,
  platformActivityReports,
  platformCohortAnalysis,
} from './platform-crm-schema';

// ─── Server-side schemas (already re-exported via schema.ts) ───
// server/enhanced-rbac-schema.ts — re-exported via schema.ts
// server/demo-scheduling-schema.ts — re-exported via schema.ts
// server/sales-forecasting-schema.ts — re-exported via schema.ts
