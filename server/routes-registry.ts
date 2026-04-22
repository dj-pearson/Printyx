/**
 * Route Registry
 *
 * Contains all route module imports and registration calls.
 * Called from routes.ts after middleware setup.
 *
 * Routes are organized into ~20 logical domain modules in server/domains/.
 * Each domain barrel re-exports registration functions from its member route files.
 */

import type { Express } from 'express';

// ─── Domain Module Imports (20 domains) ────────────────────────────────
import {
  registerAuthCoreRoutes,
  registerFeatureFlagRoutes,
  registerSessionManagementRoutes,
  enhancedRBACRoutes,
  registerCspReportRoutes,
  trialRoutes,
} from './domains/auth';

import {
  registerBillingCoreRoutes,
  registerFinancialRoutes,
  registerFinancialForecastingRoutes,
  registerCommissionRoutes,
  registerQuickBooksRoutes,
  getCompanyPricingSettings,
  updateCompanyPricingSettings,
  getProductPricing,
  createProductPricing,
  updateProductPricing,
  deleteProductPricing,
  getQuotePricing,
  createQuotePricing,
  updateQuotePricing,
  getQuoteLineItems,
  createQuoteLineItem,
  updateQuoteLineItem,
  deleteQuoteLineItem,
  calculatePricingForProduct,
  printCostCalculatorRoutes,
  consolidatedBillingRoutes,
  salesForecastingRoutes,
} from './domains/billing';

import {
  registerCrmCoreRoutes,
  registerContactsRoutes,
  registerCompaniesRoutes,
  registerActivitiesRoutes,
  registerCustomerRoutes,
  registerBusinessRecordRoutes,
  registerCrmGoalRoutes,
  registerSavedViewsRoutes,
  registerCrmBulkRoutes,
  registerBulkOperationsRoutes,
  registerRecordLayoutRoutes,
  registerCsvImportRoutes,
  signupCrmRoutes,
  universalSearchRoutes,
  businessRecordsRoutes,
} from './domains/crm';

import {
  registerDealsRoutes,
  registerDealsManagementRoutes,
  registerDealDeskRoutes,
  registerDealTagRoutes,
  registerOpportunitiesRoutes,
  registerPipelineConfigurationRoutes,
  setupSalesPipelineRoutes,
  registerLeadAssignmentRoutes,
  registerLeadMapRoutes,
  registerAutoLeadRoutingRoutes,
  registerSalesRepAssignmentRoutes,
  registerSalesHandoffRoutes,
  registerRenewalManagementRoutes,
  contractRenewalRoutes,
} from './domains/sales';

import {
  registerProductsCrudRoutes,
  registerCatalogRoutes,
  registerCatalogCsvRoutes,
  registerProductModelsRoutes,
  registerProductPricingRoutes,
  registerSoftwareProductsRoutes,
  registerDataEnrichmentRoutes,
  registerManufacturerIntegrationRoutes,
} from './domains/products';

import {
  registerWarehouseRoutes,
  registerPurchaseOrderRoutes,
  autoSupplyReplenishmentRoutes,
  warehouseFpyRoutes,
} from './domains/warehouse';

import {
  registerServiceAnalysisRoutes,
  registerPredictiveServiceDispatchRoutes,
  registerTechnicianManagementRoutes,
  serviceDispatchRouter,
  proactiveMaintenanceRouter,
  predictiveMaintenanceHubRouter,
  equipmentLifecycleStateMachineRoutes,
  equipmentDisposalRoutes,
  equipmentQRRoutes,
  enhancedServiceRoutes,
} from './domains/service';

import {
  registerMobileApiRoutes,
  registerWorkflowMobileRoutes,
  mobileTechnicianRoutes,
  mobileLogsRoutes,
  registerMobileLogsAdminRoutes,
} from './domains/mobile';

import {
  registerDashboardsCoreRoutes,
  registerModularDashboardRoutes,
  registerDashboardWidgetRoutes,
  registerTodayDashboardRoutes,
  registerDashboardLayoutsRoutes,
} from './domains/dashboard';

import {
  registerCustomReportsRoutes,
  registerScheduledReportsRoutes,
  reportsRoutes,
  reportingArchitectureRoutes,
  salesReportsAPI,
  serviceReportsAPI,
  warehouseReportsAPI,
  salesSupervisorReportsAPI,
  serviceSupervisorReportsAPI,
  teamReportsAPI,
  salesManagerReportsAPI,
  serviceManagerReportsAPI,
  directorReportsAPI,
  executiveReportsAPI,
} from './domains/reporting';

import {
  registerAdminStatsRoutes,
  registerOperationsExtendedRoutes,
  registerAuditLogRoutes,
  registerSampleDataRoutes,
  registerDisposableEmailRoutes,
} from './domains/admin';

import {
  registerGdprRoutes,
  breachDetectionRoutes,
  incidentResponseRoutes,
} from './domains/security';

import {
  knowledgeBaseRoutes,
  knowledgeBaseAdminRoutes,
  contentGapAnalysisRoutes,
  articleBookmarksRoutes,
  readingHistoryRoutes,
  articleRatingsRoutes,
} from './domains/knowledge';

import {
  registerIntegrationRoutes,
  registerSalesforceRoutes,
  registerSalesforceTestRoutes,
  integrationRoutes,
  integrationHubRoutes,
} from './domains/integrations';

import {
  registerTaskRoutes,
  registerEnhancedTaskRoutes,
  registerTemplateRoutes,
  registerAutomationRoutes,
} from './domains/tasks';

import {
  registerSeoCoreRoutes,
  seoRoutes,
  googleIndexingRoutes,
  contentMarketingRoutes,
} from './domains/content';

import {
  registerOnboardingRoutes,
  exportChecklistPDF,
  exportChecklistExcel,
  exportChecklistCSV,
  accessibilityRoutes,
} from './domains/onboarding';

import { registerNotificationRoutes, emailParserRoutes } from './domains/notifications';

import { registerAnalyticsRoutes, gpt5Routes } from './domains/ai';

import {
  registerClientMonitoringRoutes,
  registerWhiteLabelRoutes,
  customerPortalRoutes,
  clientMetricsRoutes,
  deviceMonitoringRoutes,
} from './domains/portal';

// ─── Non-domain imports ──────────────────────────────────���──────────────
import { registerHealthRoutes } from './routes/health-routes';
import apiKeyRoutes from './routes/api-key-routes';
import { storage } from './storage';
import { registerEdgeFunctionProxy } from './middleware/edge-function-proxy';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-registry');

// Track failed route module loads for health reporting
const failedRouteModules: { module: string; error: string; timestamp: string }[] = [];

/** Returns list of route modules that failed to load (for health endpoint) */
export function getFailedRouteModules() {
  return failedRouteModules;
}

/** Returns true if all route modules loaded successfully */
export function allRoutesHealthy() {
  return failedRouteModules.length === 0;
}

export async function registerAllRouteModules(app: Express, requireAuth: any): Promise<void> {
  // ─── Health Check (pre-auth, called before middleware) ──────────────
  registerHealthRoutes(app);

  // ─── CSP Violation Reporting (no auth required, browsers send automatically) ──
  registerCspReportRoutes(app);

  // ─── Mobile Remote Logging (no auth required, must be early) ──────
  app.use('/api/mobile-logs', mobileLogsRoutes);

  // ─── Client Error Logging (accepts errors from PageErrorBoundary / SectionErrorBoundary) ──
  app.post('/api/client-errors', (req, res) => {
    const { message, stack, componentStack, page, section, url, timestamp } = req.body || {};
    console.error('[Client Error]', {
      message,
      page: page || section,
      url,
      timestamp,
      stack: stack?.substring(0, 500),
      componentStack: componentStack?.substring(0, 300),
    });
    res.status(204).end();
  });

  // ─── Auth & Trial ────────────────────────────────────────────���─────
  registerAuthCoreRoutes(app);
  app.use('/api/trial', trialRoutes);

  // ─── Edge Function Proxy (must be before CRM routes) ───────────────
  registerEdgeFunctionProxy(app);

  // ─── Knowledge Base ────────────────────────────────────────────────
  app.use('/api/knowledge-base', knowledgeBaseRoutes);
  app.use('/api/admin/knowledge-base', knowledgeBaseAdminRoutes);
  app.use('/api/content-gap-analysis', contentGapAnalysisRoutes);
  app.use('/api/knowledge-base/bookmarks', articleBookmarksRoutes);
  app.use('/api/knowledge-base/reading-history', readingHistoryRoutes);
  app.use('/api/knowledge-base/ratings', articleRatingsRoutes);

  // ─── Search & Accessibility ────────────────────────────────────────
  app.use(universalSearchRoutes);
  app.use('/api/accessibility', accessibilityRoutes);

  // ─── Core Domain Routes ───────────────────────────────────────────
  registerSampleDataRoutes(app);
  registerCrmCoreRoutes(app);
  registerDashboardsCoreRoutes(app);
  registerBillingCoreRoutes(app);
  registerProductsCrudRoutes(app);
  registerCatalogCsvRoutes(app);
  registerSeoCoreRoutes(app);
  registerFinancialForecastingRoutes(app);
  registerOperationsExtendedRoutes(app);
  registerWorkflowMobileRoutes(app);
  registerAuditLogRoutes(app);
  registerMobileLogsAdminRoutes(app);

  // ─── Pricing ───────────────────────────────────────────────────────
  app.get('/api/pricing/company-settings', getCompanyPricingSettings);
  app.post('/api/pricing/company-settings', updateCompanyPricingSettings);
  app.get('/api/pricing/products', getProductPricing);
  app.post('/api/pricing/products', createProductPricing);
  app.put('/api/pricing/products/:id', updateProductPricing);
  app.delete('/api/pricing/products/:id', deleteProductPricing);
  app.get('/api/pricing/quotes/:quoteId', getQuotePricing);
  app.post('/api/pricing/quotes', createQuotePricing);
  app.put('/api/pricing/quotes/:id', updateQuotePricing);
  app.get('/api/pricing/quotes/:quotePricingId/line-items', getQuoteLineItems);
  app.post('/api/pricing/line-items', createQuoteLineItem);
  app.put('/api/pricing/line-items/:id', updateQuoteLineItem);
  app.delete('/api/pricing/line-items/:id', deleteQuoteLineItem);
  app.post('/api/pricing/calculate', calculatePricingForProduct);

  // ─── User Profile & Settings ───────────────────────────────────────
  const { registerUserProfileRoutes } = await import('./routes-user-profile');
  registerUserProfileRoutes(app);
  const {
    getUserSettings,
    updateUserProfile,
    updateUserPassword,
    updateUserPreferences,
    updateAccessibilitySettings,
    uploadAvatar,
    exportUserData,
    deleteUserAccount,
    upload: avatarUpload,
  } = await import('./routes-settings');
  app.get('/api/user/settings', getUserSettings);
  app.put('/api/user/profile', updateUserProfile);
  app.put('/api/user/password', updateUserPassword);
  app.put('/api/user/preferences', updateUserPreferences);
  app.put('/api/user/accessibility', updateAccessibilitySettings);
  app.post('/api/user/avatar', avatarUpload.single('avatar'), uploadAvatar);
  app.get('/api/user/export', exportUserData);
  app.delete('/api/user/delete', deleteUserAccount);

  // ─── API Key Management ──────────────────────────────────────────
  app.use('/api/api-keys', requireAuth, apiKeyRoutes);

  // ─── Integrations ─────────────────────────────────────────────────
  registerIntegrationRoutes(app);
  app.use(integrationRoutes);
  app.use(integrationHubRoutes);

  // ─── Task Management ──────────────────────────────────────────────
  registerTaskRoutes(app);
  registerEnhancedTaskRoutes(app);
  registerTemplateRoutes(app);

  // ─── Warehouse & Purchase Orders ──────────────────────────────────
  registerPurchaseOrderRoutes(app);
  registerWarehouseRoutes(app);

  // ─── Service & CRM ────────────────────────────────────────────────
  registerServiceAnalysisRoutes(app);
  registerCrmGoalRoutes(app);
  registerSavedViewsRoutes(app);
  registerDealTagRoutes(app);
  registerCrmBulkRoutes(app);
  registerBulkOperationsRoutes(app);
  registerRecordLayoutRoutes(app);
  registerBusinessRecordRoutes(app);
  registerCsvImportRoutes(app);
  registerCustomReportsRoutes(app);
  registerScheduledReportsRoutes(app);
  registerDashboardLayoutsRoutes(app);

  // ─── Salesforce & Data Enrichment ─────────────────────────────────
  registerSalesforceRoutes(app);
  registerDataEnrichmentRoutes(app);
  registerQuickBooksRoutes(app);

  // ─── Sales Pipeline ───────────────────────────────────────────────
  setupSalesPipelineRoutes(app, storage, requireAuth);

  // ─── Equipment ────────────────────────────────────────────────────
  app.use(equipmentLifecycleStateMachineRoutes);
  app.use(equipmentDisposalRoutes);

  // ─── Consolidated Billing ─────────────────────────────────────────
  app.use('/api/billing', consolidatedBillingRoutes);

  // ─── Salesforce Test Routes (dev only) ────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    registerSalesforceTestRoutes(app);
  }

  // ─── Async Route Imports ──────────────────────────────────────────
  const asyncMounts: [string, string][] = [
    ['/api/proposals', './routes-proposals'],
    ['/api/documents', './routes-documents'],
    ['/api/root-admin', './routes-root-admin'],
    ['/api/admin', './routes-admin-workflows'],
    ['/api/dashboard', './routes-dashboard-customization'],
  ];
  for (const [mountPath, modulePath] of asyncMounts) {
    const mod = await import(modulePath);
    app.use(mountPath, mod.default);
  }

  const socialMediaRoutes = await import('./routes-social-media');
  app.use('/', socialMediaRoutes.default);

  const subscriptionRoutes = await import('./routes-subscriptions');
  const adminSubscriptionRoutes = await import('./routes-admin-subscriptions');
  app.use('/api/subscriptions', subscriptionRoutes.default);
  app.use('/api/admin/subscriptions', adminSubscriptionRoutes.default);

  const adminSeedRoutes = await import('./routes/admin-seed-routes');
  app.use('/api/admin/seed', adminSeedRoutes.default);
  app.use('/api/root-admin/crm', signupCrmRoutes);

  // ─── Admin Stats ──────────────────────────────────────────────��───
  registerAdminStatsRoutes(app);

  // ─── Disposable Email Blocklist ─────────────────────────────────
  registerDisposableEmailRoutes(app);

  // ─── Incident Response ──────────────────────────────────────────
  app.use(incidentResponseRoutes);

  const customerNumberRoutes = await import('./routes-customer-numbers');
  app.use('/api/customer-numbers', customerNumberRoutes.customerNumberRoutes);

  const companyIdRoutes = await import('./routes-company-ids');
  app.use('/api/company-ids', companyIdRoutes.default);

  // ─── Feature Flags ────────────────────────────────────────��─────────
  registerFeatureFlagRoutes(app);

  // ─── Session Management ────────────────────────────────────────────
  registerSessionManagementRoutes(app);

  // ─── RBAC & AI ────────────────────────────────────────────────────
  app.use('/api/rbac', enhancedRBACRoutes);
  app.use('/api/ai/gpt5', gpt5Routes);

  const asyncApiMounts: [string, string][] = [
    ['/api/ai', './routes/ai-routes-simple'],
    ['/api/calendar', './routes/calendar-routes'],
    ['/api/performance', './routes/performance-routes'],
    ['/api/advanced-scheduling', './routes/advanced-scheduling-routes'],
    ['/api/mfa', './routes/mfa-routes'],
    ['/api/lead-scoring', './routes/lead-scoring-routes'],
    ['/api/lead-intelligence', './routes/lead-intelligence-routes'],
    ['/api/manufacturer-orders', './routes/manufacturer-order-routes'],
    ['/api/gps', './routes/gps-tracking-routes'],
    ['/api/billing', './routes/advanced-billing-routes'],
    ['/api/customer-success', './routes/customer-success-routes'],
    ['/api/apollo', './routes/apollo-routes'],
    ['/api/outreach', './routes/outreach-routes'],
    ['/api/extension', './routes/chrome-extension-routes'],
    ['/api/route-optimization', './routes/route-optimization-routes'],
    ['/api/mileage', './routes/mileage-routes'],
    ['/api/geofence-alerts', './routes/geofence-alerts-routes'],
    ['/api/automated-billing', './routes/automated-billing-routes'],
  ];
  for (const [mountPath, modulePath] of asyncApiMounts) {
    const mod = await import(modulePath);
    app.use(mountPath, mod.default);
  }

  // Async routes mounted at /api root
  const asyncRootApiMounts: string[] = [
    './routes/team-collaboration-routes',
    './routes/meeting-scheduling-routes',
    './routes/meeting-transcription-routes',
    './routes/ai-documentation-routes',
    './routes/ai-search-knowledge-routes',
    './routes/ai-employee-routes',
    './routes/lease-routes',
    './routes/signature-routes',
    './routes/field-service-routes',
    './routes/email-marketing-routes',
    './routes/workflow-automation-routes',
  ];
  for (const modulePath of asyncRootApiMounts) {
    const mod = await import(modulePath);
    app.use('/api', mod.default);
  }

  const documentAutomationRoutes = await import('./routes-document-automation');
  app.use(documentAutomationRoutes.default);

  // ─── Dashboard & Onboarding ───────────────────────────────────────
  registerModularDashboardRoutes(app);
  registerDashboardWidgetRoutes(app);
  registerTodayDashboardRoutes(app);
  registerOnboardingRoutes(app);

  app.get('/api/onboarding/export/:id/pdf', exportChecklistPDF);
  app.get('/api/onboarding/export/:id/excel', exportChecklistExcel);
  app.get('/api/onboarding/export/:id/csv', exportChecklistCSV);

  // ─── Notifications ──────────────────────────────────────────────────
  registerNotificationRoutes(app);

  // ─── Monitoring & Service ─────────────────────────────────────────
  registerManufacturerIntegrationRoutes(app);
  registerClientMonitoringRoutes(app);
  app.use('/api/customer-portal', customerPortalRoutes);
  app.use('/api/client-metrics', clientMetricsRoutes);
  app.use('/api/device-monitoring', deviceMonitoringRoutes);

  const contractAlertsRoutes = (await import('./routes-contract-alerts')).default;
  app.use(contractAlertsRoutes);
  app.use(serviceDispatchRouter);
  app.use(proactiveMaintenanceRouter);
  app.use(predictiveMaintenanceHubRouter);
  app.use('/api', enhancedServiceRoutes);

  // ─── Reporting ────────────────────────────────────────────────────
  app.use('/api/reporting', reportingArchitectureRoutes);
  app.use('/api/sales-reports', salesReportsAPI);
  app.use('/api/service-reports', serviceReportsAPI);
  app.use('/api/warehouse-reports', warehouseReportsAPI);
  app.use('/api/sales-supervisor-reports', salesSupervisorReportsAPI);
  app.use('/api/service-supervisor-reports', serviceSupervisorReportsAPI);
  app.use('/api/team-reports', teamReportsAPI);
  app.use('/api/sales-manager-reports', salesManagerReportsAPI);
  app.use('/api/service-manager-reports', serviceManagerReportsAPI);
  app.use('/api/director-reports', directorReportsAPI);
  app.use('/api/executive-reports', executiveReportsAPI);
  app.use('/api', reportsRoutes);
  app.use('/api', warehouseFpyRoutes);

  // ─── Content & SEO ────────────────────────────────────────────────
  app.use(contentMarketingRoutes);
  app.use(printCostCalculatorRoutes);
  app.use(seoRoutes);
  app.use(googleIndexingRoutes);

  // ─── DoD & Validation ─────────────────────────────────────────────
  const dodEnforcementRoutes = (await import('./routes-dod-enforcement')).default;
  app.use('/api', dodEnforcementRoutes);

  // ─── Database Updater API ─────────────────────────────────────────
  const { default: updaterRoutes } = await import('./database-updater/api/updater-routes');
  app.use('/api/database-updater', updaterRoutes);

  // ─── Email & Mobile ───────────────────────────────────────────────
  app.use('/api/email-parser', emailParserRoutes);
  app.use('/api/mobile', mobileTechnicianRoutes);
  app.use('/api/equipment', equipmentQRRoutes);

  // ─── Mobile App API (service-tickets, equipment list, time tracking) ──
  registerMobileApiRoutes(app);

  // ─── Platform CRM ─────────────────────────────────────────────────
  const platformBusinessRecordsRoutes = (await import('./routes-platform-business-records'))
    .default;
  const platformDealsRoutes = (await import('./routes-platform-deals')).default;
  const platformActivitiesRoutes = (await import('./routes-platform-activities')).default;
  const platformCustomerSuccessRoutes = (await import('./routes-platform-customer-success'))
    .default;
  const platformAnalyticsRoutes = (await import('./routes-platform-analytics')).default;
  app.use('/api/platform-crm', platformBusinessRecordsRoutes);
  app.use('/api/platform-deals', platformDealsRoutes);
  app.use('/api/platform-activities', platformActivitiesRoutes);
  app.use('/api/platform-cs', platformCustomerSuccessRoutes);
  app.use('/api/platform-analytics', platformAnalyticsRoutes);

  // ─── Phase 3 Modular Routes ───────────────────────────────────────
  registerContactsRoutes(app);
  registerCompaniesRoutes(app);
  registerActivitiesRoutes(app);
  registerAutomationRoutes(app);
  registerCustomerRoutes(app);
  app.use(businessRecordsRoutes);
  registerDealsManagementRoutes(app);
  registerOpportunitiesRoutes(app);
  registerDealDeskRoutes(app);
  registerPipelineConfigurationRoutes(app);
  registerTechnicianManagementRoutes(app);
  registerProductModelsRoutes(app);
  registerProductPricingRoutes(app);
  registerSoftwareProductsRoutes(app);
  registerLeadAssignmentRoutes(app);
  registerSalesRepAssignmentRoutes(app);
  registerLeadMapRoutes(app);
  registerAutoLeadRoutingRoutes(app);
  registerPredictiveServiceDispatchRoutes(app);
  registerWhiteLabelRoutes(app);
  app.use('/api/auto-supply-replenishment', autoSupplyReplenishmentRoutes);
  app.use('/api/contract-renewal', contractRenewalRoutes);
  registerSalesHandoffRoutes(app);
  registerDealsRoutes(app);
  registerCommissionRoutes(app);
  registerCatalogRoutes(app);
  registerAnalyticsRoutes(app);
  registerFinancialRoutes(app);
  registerRenewalManagementRoutes(app);

  // ─── Sales Forecasting ────────────────────────────────────────────
  app.use(salesForecastingRoutes);

  // ─── GDPR & Breach Detection ────────────────────────────────────
  registerGdprRoutes(app);
  app.use('/api', breachDetectionRoutes);

  // ─── Security Dashboard ────────────────────────────────────────
  const { registerSecurityDashboardRoutes } = await import('./routes-security-dashboard');
  registerSecurityDashboardRoutes(app);
  const validateRoutes = await import('./routes-validate');
  app.use('/api', validateRoutes.default);

  // ─── Previously Lazy-Loaded Modules (now properly awaited) ─────────
  try {
    const { analyticsRouter } = await import('./analytics-routes');
    app.use(analyticsRouter);
    log.info('✅ Analytics routes registered');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('Failed to load analytics routes:', err);
    failedRouteModules.push({
      module: 'analytics-routes',
      error: msg,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const { catalogRouter } = await import('./routes-catalog');
    app.use(catalogRouter);
    log.info('✅ Catalog routes registered');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('Failed to load catalog routes:', err);
    failedRouteModules.push({
      module: 'routes-catalog',
      error: msg,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const { default: reportingRouter } = await import('./routes-reporting');
    app.use('/api', reportingRouter);
    log.info('✅ Reporting routes registered');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('Failed to load reporting routes:', err);
    failedRouteModules.push({
      module: 'routes-reporting',
      error: msg,
      timestamp: new Date().toISOString(),
    });
  }

  const lazyModules: [string, string, string][] = [
    ['/api/gdpr', './routes-gdpr-core', 'GDPR Core Features'],
    ['/api/territories', './routes-territory-management', 'Territory Management'],
    ['/api/cross-module', './routes-cross-module', 'Cross-Module Integration'],
    ['/api/oid-mappings', './routes-oid-mappings', 'OID Mappings'],
  ];
  for (const [mountPath, modulePath, label] of lazyModules) {
    try {
      const { default: router } = await import(modulePath);
      app.use(mountPath, router);
      log.info(`✅ ${label} routes registered`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Failed to load ${label} routes:`, err);
      failedRouteModules.push({
        module: modulePath,
        error: msg,
        timestamp: new Date().toISOString(),
      });
    }
  }

  try {
    const { registerMiscStubRoutes } = await import('./routes-misc-stubs');
    registerMiscStubRoutes(app);
    log.info('✅ Miscellaneous stub routes registered');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('Failed to load misc stub routes:', err);
    failedRouteModules.push({
      module: 'routes-misc-stubs',
      error: msg,
      timestamp: new Date().toISOString(),
    });
  }
}
