/**
 * Route Registry
 *
 * Contains all route module imports and registration calls.
 * Called from routes.ts after middleware setup.
 */

import type { Express } from 'express';

// ─── Extracted Route Module Imports (Phase 4) ─────────────────────────
import { registerAuthCoreRoutes } from './routes-auth-core';
import { registerCrmCoreRoutes } from './routes-crm-core';
import { registerDashboardsCoreRoutes } from './routes-dashboards-core';
import { registerBillingCoreRoutes } from './routes-billing-core';
import { registerSampleDataRoutes } from './routes-sample-data';
import { registerProductsCrudRoutes } from './routes-products-crud';
import { registerCatalogCsvRoutes } from './routes-catalog-csv';
import { registerSeoCoreRoutes } from './routes-seo-core';
import { registerFinancialForecastingRoutes } from './routes-financial-forecasting';
import { registerOperationsExtendedRoutes } from './routes-operations-extended';
import { registerAuditLogRoutes } from './routes-audit-logs';
import { registerWorkflowMobileRoutes } from './routes-workflow-mobile';

// ─── Static Route Module Imports ──────────────────────────────────────
import { registerOnboardingRoutes } from './routes-onboarding';
import { exportChecklistPDF, exportChecklistExcel, exportChecklistCSV } from './routes-export';
import signupCrmRoutes from './routes-signup-crm';
import universalSearchRoutes from './routes-universal-search';
import knowledgeBaseRoutes from './routes-knowledge-base';
import knowledgeBaseAdminRoutes from './routes/knowledge-base-admin-routes';
import contentGapAnalysisRoutes from './routes/content-gap-analysis-routes';
import articleBookmarksRoutes from './routes/article-bookmarks-routes';
import readingHistoryRoutes from './routes/reading-history-routes';
import articleRatingsRoutes from './routes/article-ratings-routes';
import { trialRoutes } from './routes-trial';
import emailParserRoutes from './routes-email-parser';
import mobileTechnicianRoutes from './routes-mobile-technician';
import equipmentQRRoutes from './routes-equipment-qr';
import { registerMobileApiRoutes } from './routes-mobile-api';
import businessRecordsRoutes from './routes-business-records';
import accessibilityRoutes from './routes-accessibility';

import { registerIntegrationRoutes } from './routes-integrations';
import { registerTaskRoutes } from './routes-tasks';
import { registerEnhancedTaskRoutes } from './routes-enhanced-tasks';
import { registerTemplateRoutes } from './routes-templates';
import { registerDealsManagementRoutes } from './routes-deals-management';
import { registerOpportunitiesRoutes } from './routes-opportunities';
import { registerDealDeskRoutes } from './routes-deal-desk';
import { registerPipelineConfigurationRoutes } from './routes-pipeline-configuration';
import { registerTechnicianManagementRoutes } from './routes-technician-management';
import { registerProductModelsRoutes } from './routes-product-models';
import { registerProductPricingRoutes } from './routes-product-pricing';
import { registerSoftwareProductsRoutes } from './routes-software-products';
import { registerPurchaseOrderRoutes } from './routes-purchase-orders';
import { registerWarehouseRoutes } from './routes-warehouse';
import { registerServiceAnalysisRoutes } from './routes-service-analysis';
import { registerContactsRoutes } from './routes-contacts';
import { registerCompaniesRoutes } from './routes-companies';
import { registerActivitiesRoutes } from './routes-activities';
import { registerNotificationRoutes } from './routes-notifications';
import { registerAutomationRoutes } from './routes-automation';
import equipmentLifecycleStateMachineRoutes from './routes-equipment-lifecycle-state-machine';
import equipmentDisposalRoutes from './routes-equipment-disposal';
import breachDetectionRoutes from './routes-breach-detection';
import { registerGdprRoutes } from './routes-gdpr';
import { registerCrmGoalRoutes } from './routes-crm-goals';
import { registerSavedViewsRoutes } from './routes-saved-views';
import { registerDealTagRoutes } from './routes-deal-tags';
import { registerCrmBulkRoutes } from './routes-crm-bulk';
import { registerBulkOperationsRoutes } from './routes-bulk-operations';
import { registerRecordLayoutRoutes } from './routes-record-layout';
import { registerBusinessRecordRoutes } from './routes-business-records';
import { registerCustomerRoutes } from './routes-customers';
import { registerDealsRoutes } from './routes-deals';
import { registerCommissionRoutes } from './routes-commission';
import { registerCatalogRoutes } from './routes-catalog';
import { registerAnalyticsRoutes } from './routes-analytics';
import { registerFinancialRoutes } from './routes-financial';
import { registerCsvImportRoutes } from './routes-csv-import';
import { registerCustomReportsRoutes } from './routes-custom-reports';
import { registerScheduledReportsRoutes } from './routes-scheduled-reports';
import { registerDashboardLayoutsRoutes } from './routes-dashboard-layouts';
import { registerSalesforceRoutes } from './routes-salesforce-integration';
import { registerSalesforceTestRoutes } from './test-salesforce-integration';
import { registerDataEnrichmentRoutes } from './routes-data-enrichment';
import { registerQuickBooksRoutes } from './routes-quickbooks-integration';
import { setupSalesPipelineRoutes } from './routes-sales-pipeline';
import { registerModularDashboardRoutes } from './routes-modular-dashboard';
import { registerDashboardWidgetRoutes } from './routes-dashboard-widgets';
import { registerTodayDashboardRoutes } from './routes-today-dashboard';
import { registerManufacturerIntegrationRoutes } from './routes-manufacturer-integration';
import { registerLeadAssignmentRoutes } from './routes-lead-assignment';
import { registerSalesRepAssignmentRoutes } from './routes-sales-rep-assignments';
import { registerLeadMapRoutes } from './routes-lead-map';
import { registerAutoLeadRoutingRoutes } from './routes-auto-lead-routing';
import { registerPredictiveServiceDispatchRoutes } from './routes-predictive-service-dispatch';
import { registerWhiteLabelRoutes } from './routes-white-label';
import autoSupplyReplenishmentRoutes from './routes-auto-supply-replenishment';
import contractRenewalRoutes from './routes-contract-renewal';
import { registerSalesHandoffRoutes } from './routes-sales-handoff';
import { registerRenewalManagementRoutes } from './routes-renewal-management';
import { registerClientMonitoringRoutes } from './routes-client-monitoring';
import customerPortalRoutes from './routes-customer-portal';
import clientMetricsRoutes from './routes-client-metrics';
import deviceMonitoringRoutes from './routes-device-monitoring';
import { serviceDispatchRouter } from './routes-service-dispatch';
import { proactiveMaintenanceRouter } from './routes-proactive-maintenance';
import { predictiveMaintenanceHubRouter } from './routes-predictive-maintenance-hub';
import commissionRoutes from './routes-commission';
import enhancedServiceRoutes from './routes-enhanced-service';
import { enhancedRBACRoutes } from './routes-enhanced-rbac';
import gpt5Routes from './routes-ai-gpt5';
import salesForecastingRoutes from './routes-sales-forecasting';
import reportsRoutes from './routes-reports';
import reportingArchitectureRoutes from './routes-reporting-architecture';
import salesReportsAPI from './routes/sales-reports-api';
import serviceReportsAPI from './routes/service-reports-api';
import warehouseReportsAPI from './routes/warehouse-reports-api';
import salesSupervisorReportsAPI from './routes/sales-supervisor-reports-api';
import serviceSupervisorReportsAPI from './routes/service-supervisor-reports-api';
import teamReportsAPI from './routes/team-reports-api';
import salesManagerReportsAPI from './routes/sales-manager-reports-api';
import serviceManagerReportsAPI from './routes/service-manager-reports-api';
import directorReportsAPI from './routes/director-reports-api';
import executiveReportsAPI from './routes/executive-reports-api';
import warehouseFpyRoutes from './routes-warehouse-fpy';
import consolidatedBillingRoutes from './routes/billing';
import printCostCalculatorRoutes from './routes-print-cost-calculator';
import contentMarketingRoutes from './routes-content-marketing';
import seoRoutes from './routes-seo';
import { registerHealthRoutes } from './routes/health-routes';
import apiKeyRoutes from './routes/api-key-routes';
import integrationRoutes from './integrations/routes';
import integrationHubRoutes from './routes-integration-hub';
import { registerFeatureFlagRoutes } from './routes-feature-flags';
import { registerSessionManagementRoutes } from './routes-session-management';
import { registerAdminStatsRoutes } from './routes-admin-stats';
import incidentResponseRoutes from './routes-incident-response';
import { registerCspReportRoutes } from './routes-csp-report';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-registry');

// Pricing handler imports
import {
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
} from './routes-pricing';

import { storage } from './storage';
import { registerEdgeFunctionProxy } from './middleware/edge-function-proxy';
import mobileLogsRoutes, { registerMobileLogsAdminRoutes } from './routes-mobile-logs';

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

  // ─── Auth & Trial ──────────────────────────────────────────────────
  registerAuthCoreRoutes(app);
  app.use('/api/trial', trialRoutes);

  // ─── Edge Function Proxy (must be before CRM routes) ───────────────
  // Forwards CRM API calls to Supabase Edge Functions for correct data
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

  // ─── Extracted Core Routes (Phase 4) ───────────────────────────────
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

  // ─── Commission & Equipment ───────────────────────────────────────
  app.use(commissionRoutes);
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
    ['/api/proposals', './routes-proposals.js'],
    ['/api/documents', './routes-documents.js'],
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

  // ─── Admin Stats ──────────────────────────────────────────────────
  registerAdminStatsRoutes(app);

  // ─── Incident Response ──────────────────────────────────────────
  app.use(incidentResponseRoutes);

  const customerNumberRoutes = await import('./routes-customer-numbers');
  app.use('/api/customer-numbers', customerNumberRoutes.customerNumberRoutes);

  const companyIdRoutes = await import('./routes-company-ids');
  app.use('/api/company-ids', companyIdRoutes.default);

  // ─── Feature Flags ──────────────────────────────────────────────────
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

  // ─── Lazy-Loaded Modules ──────────────────────────────────────────
  import('./analytics-routes')
    .then(({ analyticsRouter }) => app.use(analyticsRouter))
    .catch((err) => log.error('Failed to load analytics routes:', err));

  import('./routes-catalog')
    .then(({ catalogRouter }) => app.use(catalogRouter))
    .catch((err) => log.error('Failed to load catalog routes:', err));

  import('./routes-reporting')
    .then(({ default: reportingRouter }) => {
      app.use('/api', reportingRouter);
      log.info('✅ Reporting routes registered');
    })
    .catch((err) => log.error('Failed to load reporting routes:', err));

  const lazyModules: [string, string, string][] = [
    ['/api/gdpr', './routes-gdpr-core', 'GDPR Core Features'],
    ['/api/territories', './routes-territory-management', 'Territory Management'],
    ['/api/cross-module', './routes-cross-module', 'Cross-Module Integration'],
    ['/api/oid-mappings', './routes-oid-mappings', 'OID Mappings'],
  ];
  for (const [mountPath, modulePath, label] of lazyModules) {
    import(modulePath)
      .then(({ default: router }) => {
        app.use(mountPath, router);
        log.info(`✅ ${label} routes registered`);
      })
      .catch((err) => log.error(`Failed to load ${label} routes:`, err));
  }

  import('./routes-misc-stubs')
    .then(({ registerMiscStubRoutes }) => {
      registerMiscStubRoutes(app);
      log.info('✅ Miscellaneous stub routes registered');
    })
    .catch((err) => log.error('Failed to load misc stub routes:', err));
}
