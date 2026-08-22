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
  registerSessionManagementRoutes,
  enhancedRBACRoutes,
  registerCspReportRoutes,
  trialRoutes,
} from './domains/auth';

import {
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
  salesForecastingRoutes,
} from './domains/billing';

import {
  registerCrmCoreRoutes,
  registerCompaniesRoutes,
  registerCustomerRoutes,
  registerBusinessRecordRoutes,
  registerCrmGoalRoutes,
  registerCrmNotesRoutes,
  registerCrmBulkRoutes,
  registerBulkOperationsRoutes,
  registerRecordLayoutRoutes,
  registerCsvImportRoutes,
  signupCrmRoutes,
  universalSearchRoutes,
  businessRecordsRoutes,
} from './domains/crm';

import {
  registerDealsManagementRoutes,
  // registerDealDeskRoutes — migrated to supabase/functions/deal-desk/
  registerDealTagRoutes,
  // registerPipelineConfigurationRoutes — migrated to supabase/functions/pipeline-config/
  // setupSalesPipelineRoutes — migrated to supabase/functions/sales-pipeline/
  registerLeadAssignmentRoutes,
  registerLeadMapRoutes,
  registerAutoLeadRoutingRoutes,
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
  registerTechnicianManagementRoutes,
  serviceDispatchRouter,
  equipmentLifecycleStateMachineRoutes,
  equipmentDisposalRoutes,
  equipmentQRRoutes,
  enhancedServiceRoutes,
} from './domains/service';

import {
  registerMobileApiRoutes,
  registerWorkflowMobileRoutes,
  mobileLogsRoutes,
  registerMobileLogsAdminRoutes,
} from './domains/mobile';

import {
  registerDashboardsCoreRoutes,
  registerModularDashboardRoutes,
  // registerDashboardWidgetRoutes — migrated to supabase/functions/dashboard-widgets/
  registerTodayDashboardRoutes,
  registerDashboardLayoutsRoutes,
} from './domains/dashboard';

import {
  registerAdminStatsRoutes,
  registerOperationsExtendedRoutes,
  registerAuditLogRoutes,
  registerSampleDataRoutes,
  registerDisposableEmailRoutes,
} from './domains/admin';

import { registerGdprRoutes, incidentResponseRoutes } from './domains/security';

import { knowledgeBaseAdminRoutes, contentGapAnalysisRoutes } from './domains/knowledge';

import {
  registerIntegrationRoutes,
  registerSalesforceRoutes,
  registerSalesforceTestRoutes,
  integrationRoutes,
} from './domains/integrations';

import {
  registerTaskRoutes,
  registerEnhancedTaskRoutes,
  registerTemplateRoutes,
  registerTaskWorkflowRoutes,
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

import { emailParserRoutes } from './domains/notifications';

import { registerAnalyticsRoutes } from './domains/ai';

import {
  registerClientMonitoringRoutes,
  clientMetricsRoutes,
  deviceMonitoringRoutes,
} from './domains/portal';

// ─── Non-domain imports ──────────────────────────────────���──────────────
import { registerHealthRoutes } from './routes/health-routes';
import { registerDealDeskCopilotRoutes } from './routes-deal-desk-copilot';
import { registerChatbotRoutes } from './routes-chatbot';
import { storage } from './storage';
import { registerEdgeFunctionProxy } from './middleware/edge-function-proxy';
import { logRouteDivergence } from './middleware/route-divergence-detector';
import { warnOnDuplicateRoutes } from './lib/route-duplicate-check';
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

  // ─── Public Installer Artifacts (no auth — none of these contain secrets) ──
  // Three public files power the one-line web install. None carries a
  // credential; the API key only ever materialises after an enrollment token
  // (generated separately in the UI) is redeemed over HTTPS.
  //
  //   GET /install/printyx-client.ps1   → bootstrap; the entry point for
  //                                        `irm <base>/install/printyx-client.ps1`.
  //   GET /install/install-windows.ps1  → the real installer (bundle mode).
  //   GET /install/printyx-client.cjs   → the prebuilt, self-contained agent.
  //
  // The bootstrap downloads the latter two next to each other in a temp dir,
  // so install-windows.ps1 installs without any source checkout or build.
  {
    const fs = await import('fs');
    const path = await import('path');
    const scriptsDir = () =>
      process.env.PRINTYX_CLIENT_SCRIPTS_DIR ||
      path.resolve(process.cwd(), 'printyx-client', 'scripts');
    const bundlePath = () =>
      process.env.PRINTYX_CLIENT_BUNDLE_PATH ||
      path.resolve(process.cwd(), 'printyx-client', 'dist', 'printyx-client.cjs');
    const exePath = () =>
      process.env.PRINTYX_CLIENT_EXE_PATH ||
      path.resolve(process.cwd(), 'printyx-client', 'dist', 'printyx-client.exe');

    const sendFile = (
      res: import('express').Response,
      file: string,
      contentType: string,
      missingMsg: string,
    ) => {
      if (!fs.existsSync(file)) {
        return res.status(503).type('text/plain').send(missingMsg);
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      fs.createReadStream(file).pipe(res);
    };

    app.get('/install/printyx-client.ps1', (_req, res) => {
      sendFile(
        res,
        path.join(scriptsDir(), 'Install-Bootstrap.ps1'),
        'text/plain; charset=utf-8',
        '# Printyx bootstrap not available. Re-deploy the platform with printyx-client/scripts.',
      );
    });

    app.get('/install/install-windows.ps1', (_req, res) => {
      sendFile(
        res,
        path.join(scriptsDir(), 'install-windows.ps1'),
        'text/plain; charset=utf-8',
        '# Printyx installer script not available. Re-deploy the platform with printyx-client/scripts.',
      );
    });

    app.get('/install/printyx-client.cjs', (_req, res) => {
      sendFile(
        res,
        bundlePath(),
        'application/javascript; charset=utf-8',
        '# Printyx client bundle not available. Run `npm run bundle` in printyx-client and re-deploy.',
      );
    });

    // Optional zero-dependency Windows binary (Node SEA). Only present when a
    // deploy ran `npm run build:exe`. Used by `install-windows.ps1 -UseExe`.
    app.get('/install/printyx-client.exe', (_req, res) => {
      sendFile(
        res,
        exePath(),
        'application/octet-stream',
        '# Printyx client .exe not built. Run `npm run build:exe` in printyx-client and re-deploy.',
      );
    });
  }

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
  // The knowledge-base Express routers were mounted here and are DELETED
  // (PROD-008b): routes-knowledge-base.ts plus the three engagement routers
  // (article-ratings, article-bookmarks, reading-history), 35 handlers in all.
  //
  // /api/knowledge-base is in crmProxies, so the proxy served the whole prefix
  // in dev and production hit supabase/functions/knowledge-base/ directly -
  // none of them ran on either host. They were invisible to
  // check:shadowed-express until it learned to follow the domains/* barrels.
  //
  // ALL 35 WERE CHECKED AGAINST THE EDGE FUNCTION BEFORE DELETING, and the
  // check earned its keep: POST /articles/:id/feedback had NO edge counterpart
  // and a live caller (KnowledgeArticle.tsx), so it was ported first rather
  // than deleted with the rest.
  //
  //   categories CRUD           -> knowledge-base/index.ts:106, 137, 201, 254
  //   articles list / by-id-or-slug / create / update / delete
  //                             -> index.ts:585, 751, 855, 972
  //   search, popular, analytics -> index.ts:400, 363, 316
  //   POST /articles/:id/feedback -> index.ts:591 (ported this round)
  //   ratings, votes            -> handlers/ratings.ts (both id and user/:id forms)
  //   bookmarks                 -> handlers/bookmarks.ts (list, create, update,
  //                                delete, collections, check/:articleId)
  //   reading-history           -> handlers/reading-history.ts (list, create,
  //                                recent, stats, by-article, delete)
  //
  // DELETED WITH NO COUNTERPART, because nothing calls them either:
  //   GET /articles/:id/feedback - the admin feedback list. The admin dashboard
  //     reads /api/admin/knowledge-base/feedback/pending, a different prefix
  //     that is NOT proxied and is still served by knowledgeBaseAdminRoutes.
  //   PATCH /articles/:id/publish and /archive - KnowledgeBaseAdmin.tsx already
  //     does both as a status change through the article PUT, and says so in a
  //     comment at its call site.
  app.use('/api/admin/knowledge-base', knowledgeBaseAdminRoutes);
  app.use('/api/content-gap-analysis', contentGapAnalysisRoutes);

  // ─── Search & Accessibility ────────────────────────────────────────
  app.use(universalSearchRoutes);
  app.use('/api/accessibility', accessibilityRoutes);

  // ─── Core Domain Routes ───────────────────────────────────────────
  registerSampleDataRoutes(app);
  registerCrmCoreRoutes(app);
  registerDashboardsCoreRoutes(app);
  registerProductsCrudRoutes(app);
  registerCatalogCsvRoutes(app);
  registerSeoCoreRoutes(app);
  // registerFinancialForecastingRoutes was called here and is DELETED (CR-017).
  // See the /api/financial entry in middleware/edge-function-proxy.ts: its six
  // handlers queried four non-existent tables through raw SQL.
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
  // routes/api-key-routes.ts retired (PROD-008b). All nine handlers were shadowed
  // by the /api/api-keys proxy and supabase/functions/api-keys/ covers every one,
  // literals ordered before /:id. services/api-key-service.ts stays — it is what
  // middleware/api-key-auth.ts validates inbound keys with.

  // ─── Integrations ─────────────────────────────────────────────────
  registerIntegrationRoutes(app);
  app.use(integrationRoutes);

  // ─── Task Management ──────────────────────────────────────────────
  registerTaskRoutes(app);
  registerEnhancedTaskRoutes(app);
  registerTemplateRoutes(app);
  registerTaskWorkflowRoutes(app);

  // ─── Warehouse & Purchase Orders ──────────────────────────────────
  registerPurchaseOrderRoutes(app);
  registerWarehouseRoutes(app);

  // ─── Service & CRM ────────────────────────────────────────────────
  registerServiceAnalysisRoutes(app);
  registerCrmGoalRoutes(app);
  registerCrmNotesRoutes(app);
  registerDealTagRoutes(app);
  registerCrmBulkRoutes(app);
  registerBulkOperationsRoutes(app);
  registerRecordLayoutRoutes(app);
  registerBusinessRecordRoutes(app);
  registerCsvImportRoutes(app);
  registerDashboardLayoutsRoutes(app);

  // ─── Salesforce & Data Enrichment ─────────────────────────────────
  registerSalesforceRoutes(app);
  registerDataEnrichmentRoutes(app);
  registerQuickBooksRoutes(app);

  // ─── Sales Pipeline ───────────────────────────────────────────────
  // setupSalesPipelineRoutes(app, storage, requireAuth) — migrated to supabase/functions/sales-pipeline/

  // ─── Equipment ────────────────────────────────────────────────────
  app.use(equipmentLifecycleStateMachineRoutes);
  app.use(equipmentDisposalRoutes);

  // ─── Consolidated Billing ─────────────────────────────────────────
  // routes/billing.ts was mounted here and is DELETED (PROD-008b).
  //
  // /api/billing is in crmProxies, so the proxy served the whole prefix in dev
  // and production hit supabase/functions/billing/ directly - this router had
  // not run on either host. It was invisible to check:shadowed-express until the
  // scanner learned to follow the domains/* barrels; its 33 handlers were 33 of
  // the 106 that surfaced.
  //
  // EVERY SURFACE WITH A LIVE CALLER WAS CHECKED AGAINST THE EDGE FUNCTION
  // BEFORE DELETING, not assumed:
  //   /rules + /rules/:id + PATCH /rules/:id/{activate,deactivate}
  //       BillingRules.tsx, billing-rule-dialog.tsx  -> billing/index.ts:116-121, 313-490
  //   /info, /address                Billing.tsx     -> billing/index.ts:100-103
  //   /analytics, /analytics/:kind   BillingAnalytics.tsx, AdvancedBillingEngine.tsx
  //                                                  -> billing/index.ts:90, 140
  //   /invoices, /invoices/:id, /:id/{pdf,email,send,pay,paid}
  //       Billing.tsx, Invoices.tsx, invoice-email-dialog.tsx, lib/invoice-pdf.ts
  //                                                  -> handlers/invoices.ts:76-305
  //   /invoices/generate-from-contract  Invoices.tsx -> handlers/invoices.ts:81
  //       (this one never had an Express route at all)
  //
  // The surfaces with NO caller anywhere in client/src are gone with the file:
  // /stripe/config, /stripe/setup-intent, /stripe/webhooks, /dashboard,
  // /metrics, /health-score, /auto-invoice-status, /auto-generate. The Stripe
  // webhook one was already dead by a second route: Stripe delivers to
  // /api/webhooks/stripe, not under /api/billing (CLAUDE.md).
  //
  // It could not have worked anyway: it imported billingDisputes and creditMemos
  // from @shared/schema, which does not re-export them (they live in
  // shared/advanced-billing-schema.ts), and it read invoices.balance / .paid /
  // .total / .tax / .description - the phantom columns CLAUDE.md names as the
  // legacy consolidated router's. The real ones are total_amount / amount_paid /
  // balance_due / invoice_status / paid_date.

  // ─── Salesforce Test Routes (dev only) ────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    registerSalesforceTestRoutes(app);
  }

  // ─── Async Route Imports ──────────────────────────────────────────
  const asyncMounts: [string, string][] = [
    // ['/api/proposals', './routes-proposals'] — migrated to supabase/functions/proposals/
    // ['/api/documents', './routes-documents'] — retired (PROD-008b). All four
    // handlers (GET /, POST /, GET /:id, POST /:id/pdf) are shadowed by the
    // /api/documents proxy and matched branch-for-branch by
    // supabase/functions/documents/. Its generateDocumentHTML moved to
    // server/lib/document-html.ts, which the parity test now imports.
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

  // ─── Session Management ────────────────────────────────────────────
  registerSessionManagementRoutes(app);

  // ─── RBAC & AI ────────────────────────────────────────────────────
  app.use('/api/rbac', enhancedRBACRoutes);
  // routes-ai-gpt5.ts was mounted here and is DELETED (PROD-008b). /api/ai/gpt5
  // is in crmProxies (and has a server.ts alias), so the proxy served it in dev
  // and production hit supabase/functions/ai-gpt5/ directly - it ran on neither
  // host. Note the prefix is the SUB-PATH only: the rest of /api/ai stays on
  // Express, which is why this mount was narrow.
  //
  // All nine handlers map one-for-one onto the edge function's dispatch:
  // analyze-lead, generate-proposal, analyze-service, support-response,
  // business-analytics, classify-inquiry, generate-code and custom-prompt are
  // the switch cases at ai-gpt5/index.ts:199-325, and GET /configs is the branch
  // at :174.
  //
  // server/services/gpt5-service.ts is NOT deleted with it. It was this file's
  // only route consumer, but server/tests/unit/gpt5-prompts-parity.test.ts
  // imports it to lock the Node prompt text against
  // supabase/functions/_shared/gpt5-prompts.ts. Deleting the service would take
  // the parity test's Node side with it and leave the edge prompts unguarded -
  // the "is this test guarding a class or a corpse" question, and here it is a
  // class: the prompts still exist on both sides.

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
    // ['/api/customer-success', './routes/customer-success-routes'] — retired
    // (PROD-008b). All 44 handlers were shadowed by the /api/customer-success
    // proxy AND self-broken: the module's `storage` was only ever assigned by an
    // exported setter nothing called, so every handler dereferenced undefined.
    // supabase/functions/customer-success/ covers all 44, literals ordered before
    // /:id — which this router got backwards.
    ['/api/apollo', './routes/apollo-routes'],
    // ['/api/outreach', './routes/outreach-routes'] — migrated to supabase/functions/outreach/
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
    // './routes/ai-employee-routes' — retired (PROD-008b). All ten handlers were
    // shadowed by the /api/ai-employees proxy and supabase/functions/ai-employee/
    // covers every one. Three of them (/workflows, /templates, and the analytics
    // overview's siblings) were also registered AFTER /ai-employees/:employeeId in
    // the same router, so Express matched them as an id lookup — dead before the
    // proxy existed. The edge function orders literals first.
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
  // registerDashboardWidgetRoutes(app) — migrated to supabase/functions/dashboard-widgets/
  registerTodayDashboardRoutes(app);
  registerOnboardingRoutes(app);

  app.get('/api/onboarding/export/:id/pdf', exportChecklistPDF);
  app.get('/api/onboarding/export/:id/excel', exportChecklistExcel);
  app.get('/api/onboarding/export/:id/csv', exportChecklistCSV);

  // ─── Notifications ──────────────────────────────────────────────────
  // routes-notifications.ts retired (PROD-008b). supabase/functions/notifications/
  // serves the prefix — repointed in the same change from a phantom `notifications`
  // table onto the real user_notifications.

  // ─── Monitoring & Service ─────────────────────────────────────────
  registerManufacturerIntegrationRoutes(app);
  registerClientMonitoringRoutes(app);
  // routes-customer-portal.ts was mounted here and is DELETED (PROD-008b).
  // 1,701 lines, 25 handlers. /api/customer-portal is in crmProxies, so the
  // proxy served the prefix in dev and production hit
  // supabase/functions/customer-portal/ directly - it ran on neither host.
  //
  // ALL 25 CHECKED AGAINST THE EDGE FUNCTION. Every path the frontend calls has
  // a counterpart, sub-paths included:
  //   maintenance-availability, maintenance-appointments (+ /:id,
  //     /:id/reschedule, DELETE /:id)      -> index.ts:79-83, handlers/maintenance.ts
  //   satisfaction/surveys (+ /:id, /:id/start, /:id/submit), /analytics
  //                                        -> index.ts:85, handlers/satisfaction.ts
  //   service-requests (+ /:id, /:id/history, POST)  -> index.ts:210-370
  //   equipment, equipment-health, usage-analytics, supply-orders,
  //     knowledge-base, dashboard          -> index.ts:88-98, 457, 528, 612, 693
  //
  // DELETED WITH NO COUNTERPART, none of which any page calls: /test, /users,
  // /dashboard/stats, /equipment-analytics/:id, /equipment-usage/:id,
  // /meter-submissions/recent, /service-requests/recent, and
  // POST /equipment-maintenance.
  //
  // Worth knowing about that last group: /service-requests/recent would not have
  // worked on the edge side anyway. There is no 'recent' branch there, and the
  // GET /:id branch matches first, so it would resolve as a lookup for a request
  // whose id is the word "recent" - the shadowing class check:route-shadowing
  // gates on the Express side.
  app.use('/api/client-metrics', clientMetricsRoutes);
  app.use('/api/device-monitoring', deviceMonitoringRoutes);

  const contractAlertsRoutes = (await import('./routes-contract-alerts')).default;
  app.use(contractAlertsRoutes);
  app.use(serviceDispatchRouter);
  // routes-proactive-maintenance.ts retired (PROD-008b). Both handlers were
  // shadowed by the /api/service proxy; supabase/functions/service/maintenance.ts
  // serves them, and its own header records that GET /proactive-maintenance is a
  // REPAIR rather than a transcription — the Express version selected columns
  // that do not exist and had always 500'd.
  // routes-predictive-maintenance-hub.ts retired (PROD-008b). All six handlers
  // were shadowed by the /api/predictive-maintenance proxy and
  // supabase/functions/predictive-maintenance/ matches PredictiveMaintenanceHub.tsx
  // key for key on both the dashboard overview and the parts forecast, with its
  // AI-prediction degradation disclosed in the payload.
  app.use('/api', enhancedServiceRoutes);

  // ─── Reporting ────────────────────────────────────────────────────
  // All persona-scoped + second-tier reports live at /api/reports/* via the
  // edge-function-proxy → supabase/functions/reports/. The legacy persona
  // prefixes (/api/director-reports, etc.) and bare /api/reports stub mount
  // were removed in EDGE-001.
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
  // routes-mobile-technician was mounted here and is DELETED (QUALITY-002).
  //
  // It queried phone_in_tickets as if it were the technician's ticket queue.
  // That table is a CALL-INTAKE LOG - callerName, callerPhone, issueDescription,
  // convertedToTicketId - with no assignedTo, no status and no
  // enhancedTicketStatus, so every handler in the file referenced columns that
  // do not exist and could only fail at runtime. It also called storage.upload,
  // which is not a method on DatabaseStorage. The technician's queue is
  // service_tickets (assignedTechnicianId / status / scheduledDate).
  //
  // Nothing called it: no reference to /api/mobile/sync, /tickets, /equipment,
  // /location or /stats exists in client/src, mobile/, printyx-client/ or ios/.
  //
  // NOTE FOR WHOEVER FIXES THE DEV GAP BELOW: /api/mobile/sessions and
  // /api/mobile/photos - which MobileFieldService.tsx really does call - were
  // never served here either. supabase/functions/mobile/ serves them, so the
  // page works in production and 404s in dev. A crmProxies entry for
  // /api/mobile would NOT be a safe fix: the proxy forwards the WHOLE prefix,
  // and /api/mobile/push-token (the React Native app), /api/mobile/dashboard,
  // /api/mobile/jobs/:jobId (routes-mobile.ts) and /api/mobile/time-tracking/*
  // (routes-mobile-api.ts) are all still Express-only. Proxying would take those
  // from working-in-dev to 404-in-dev.
  app.use('/api/equipment', equipmentQRRoutes);

  // ─── Mobile App API (service-tickets, equipment list, time tracking) ──
  registerMobileApiRoutes(app);

  // ─── Platform CRM ─────────────────────────────────────────────────
  // EDGE-004: platform-crm / platform-activities / platform-analytics /
  // platform-cs are now served by Supabase edge functions (the frontend hits
  // functions.printyx.net directly in prod; dev proxies via crmProxies in
  // server/middleware/edge-function-proxy.ts). The legacy Express routers were
  // removed. platform-deals remains on Express (out of EDGE-004 scope) and also
  // has an edge function for prod.
  const platformDealsRoutes = (await import('./routes-platform-deals')).default;
  app.use('/api/platform-deals', platformDealsRoutes);

  // ─── Phase 3 Modular Routes ───────────────────────────────────────
  registerCompaniesRoutes(app);
  // routes-activities.ts retired (PROD-008b). Its two handlers
  // (GET /activities/recent, GET /activities/user/:userId) were shadowed by the
  // /api/activities proxy, have no edge branch and no caller — both fell through
  // to the single-activity lookup and answered 404.
  // registerAutomationRoutes was called here and is DELETED (CR-017).
  //
  // routes-automation.ts served /api/automation/{rules,tasks} against
  // automation_rules and automated_tasks, through raw SQL string queries. NEITHER
  // TABLE EXISTS - not in shared/*.ts, not in any migration - so all four
  // handlers 500'd on a missing relation, and because the queries were raw SQL
  // rather than drizzle, tsc reported zero errors for the file.
  //
  // Nothing called it: a repo-wide search finds no /api/automation reference in
  // client/src at all. The pages that look like they would use it
  // (WorkflowAutomation.tsx, AutopilotDashboard.tsx) call
  // /api/workflow-automation/dashboard, a different prefix that IS proxied and
  // IS served - supabase/functions/workflow-automation/index.ts:62.
  //
  // supabase/functions/automation/ is NOT deleted with it, but it is not a
  // working alternative either: it reads the same two non-existent tables and is
  // already recorded in docs/phantom-tables-baseline.json. The prefix is dead on
  // both hosts. Reviving it means creating the tables first.
  registerCustomerRoutes(app);
  app.use(businessRecordsRoutes);
  // routes-web-forms.ts retired (PROD-008b); supabase/functions/web-forms/ has
  // all six handlers and already returns camelCase rows.
  // routes-email-sequences.ts retired (PROD-008b). All four handlers were
  // shadowed by the /api/email-sequences proxy; supabase/functions/email-sequences/
  // covers them and already returns camelCase rows.
  registerDealsManagementRoutes(app);
  // registerDealDeskRoutes(app) — migrated to supabase/functions/deal-desk/
  // registerPipelineConfigurationRoutes(app) — migrated to supabase/functions/pipeline-config/
  registerTechnicianManagementRoutes(app);
  registerProductModelsRoutes(app);
  registerProductPricingRoutes(app);
  registerSoftwareProductsRoutes(app);
  registerLeadAssignmentRoutes(app);
  registerLeadMapRoutes(app);
  registerAutoLeadRoutingRoutes(app);
  // registerPredictiveServiceDispatchRoutes was called here and is DELETED
  // (QUALITY-002). See the /api/predictive-dispatch entry in
  // middleware/edge-function-proxy.ts: the router's handlers referenced three
  // tables that exist nowhere, as undefined identifiers rather than as imports,
  // so each was a guaranteed ReferenceError. The edge function already served
  // production correctly and now serves dev too.
  registerDealDeskCopilotRoutes(app);
  // routes-daily-briefing.ts retired (PROD-008b). All six handlers were shadowed
  // by the /api/daily-briefing proxy; supabase/functions/daily-briefing/ covers
  // them and agrees on every table. The generation engine and
  // runDueDailyBriefings moved to services/daily-briefing-scheduler.ts, which
  // cron-service imports.
  // routes-portal-service.ts retired (PROD-008b). All four handlers were
  // shadowed by the /api/portal-service proxy; supabase/functions/portal-service/
  // covers them, and its timeline steps match the TimelineStep shape
  // CustomerPortalService.tsx renders.
  // routes-service-knowledge.ts retired (PROD-008b). All six handlers were
  // shadowed by the /api/service proxy and supabase/functions/service/knowledge.ts
  // is a byte-compatible port of its pure logic. routes-proactive-maintenance.ts,
  // the other router on this prefix, is retired too.
  // routes-voice-ticket-close.ts retired (PROD-008b). All six handlers were
  // shadowed by the /api/voice-ticket-close proxy. Its two load-bearing exports
  // moved with it: the SKU matcher already lived in
  // _shared/voice-ticket-close-logic.ts, and isAllowedAudioHost was ported there
  // too — the edge function had been gating audioUrl with a startsWith() prefix
  // match that 'https://api.printyx.net.evil.com' satisfies.
  registerChatbotRoutes(app);
  app.use('/api/auto-supply-replenishment', autoSupplyReplenishmentRoutes);
  app.use('/api/contract-renewal', contractRenewalRoutes);
  registerSalesHandoffRoutes(app);
  registerCommissionRoutes(app);
  registerCatalogRoutes(app);
  registerAnalyticsRoutes(app);
  registerRenewalManagementRoutes(app);

  // ─── Sales Forecasting ────────────────────────────────────────────
  app.use(salesForecastingRoutes);

  // ─── GDPR ────────────────────────────────────────────────────────
  // Breach detection migrated to supabase/functions/reports/handlers/second-tier.ts
  // (frontend hits /api/reports/breaches via the edge-function-proxy).
  registerGdprRoutes(app);

  // ─── Data Retention (admin) ──────────────────────────────────────
  const { registerDataRetentionRoutes } = await import('./routes-data-retention');
  registerDataRetentionRoutes(app);

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

  // routes-reporting.ts (KPIs, reporting catalog, exports, dashboard summary)
  // migrated to supabase/functions/reports/handlers/{kpis,reporting}.ts in
  // EDGE-003. Frontend hits /api/kpis/* and /api/reporting/* via the
  // edge-function-proxy.

  const lazyModules: [string, string, string][] = [
    ['/api/gdpr', './routes-gdpr-core', 'GDPR Core Features'],
    ['/api/territories', './routes-territory-management', 'Territory Management'],
    ['/api/cross-module', './routes-cross-module', 'Cross-Module Integration'],
    ['/api/oid-mappings', './routes-oid-mappings', 'OID Mappings'],
    ['/api/address-books', './routes-address-books', 'Address Books (import/export + CRUD)'],
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

  // ─── Duplicate route registration check (CR-018) ───────────────────
  // Warns when the same method+path was registered by two modules (Express
  // serves only the first, silently shadowing the second).
  warnOnDuplicateRoutes(app, log);

  // ─── Dev route-divergence check (no-op in prod) ────────────────────
  // Warns when dev serves an Express handler for a route prod serves via an
  // edge function (EDGE-013). Runs last so the proxy map is fully populated.
  logRouteDivergence();
}
