import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useLocation } from 'wouter';
import { SEOProvider } from '@/lib/seo/SEOProvider';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SubscriptionBanner } from '@/components/SubscriptionBanner';
import { AuthProvider, useAuthContext } from '@/providers/AuthProvider';
import { PWAProvider } from '@/components/pwa/PWAProvider';
import { ErrorBoundary } from '@/components/error-boundary';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { SessionGuard } from '@/components/SessionGuard';
import { CookieConsent } from '@/components/CookieConsent';
import { AccessibilityProvider } from '@/hooks/useAccessibility';
import { LiveRegionProvider } from '@/components/accessibility/LiveRegion';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRouteGuard } from '@/components/auth/RouteGuard';
import { RoutePermissionGate } from '@/components/auth/RoutePermissionGate';
import { useRouteAnnouncer } from '@/hooks/useRouteAnnouncer';
import { AccessibilityWidget } from '@/components/accessibility/AccessibilityWidget';
import { SkipNavigation } from '@/components/accessibility/SkipNavigation';

// Critical auth pages - keep eager for fast initial load
import NotFound from '@/pages/not-found';
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Signup from '@/pages/Signup';
import VerifyEmail from '@/pages/VerifyEmail';
import AuthCallback from '@/pages/AuthCallback';
import EndUserLicenseAgreement from '@/pages/legal/EndUserLicenseAgreement';
import PrivacyPolicy from '@/pages/legal/PrivacyPolicy';
import TermsAndConditions from '@/pages/legal/TermsAndConditions';

// Accessibility Statement - lazy load
const AccessibilityStatement = React.lazy(() => import('@/pages/legal/AccessibilityStatement'));
const Unauthorized = React.lazy(() => import('@/pages/Unauthorized'));

// Marketing pages - lazy load
const Homepage = React.lazy(() => import('@/pages/marketing/Homepage'));
const CopierDealerCRM = React.lazy(() => import('@/pages/marketing/CopierDealerCRM'));
const PrintServiceDispatchMobile = React.lazy(
  () => import('@/pages/marketing/PrintServiceDispatchMobile'),
);
const CanonMasterProductCatalog = React.lazy(
  () => import('@/pages/marketing/CanonMasterProductCatalog'),
);

// Strategic landing pages
const PredictiveIntelligence = React.lazy(() => import('@/pages/marketing/PredictiveIntelligence'));
const ModernArchitecture = React.lazy(() => import('@/pages/marketing/ModernArchitecture'));
const IntegrationMarketplace = React.lazy(() => import('@/pages/marketing/IntegrationMarketplace'));
const DealerExpertise = React.lazy(() => import('@/pages/marketing/DealerExpertise'));

// Blog pages
const BlogIndex = React.lazy(() => import('@/pages/blog/index'));
const AIPredictiveMaintenanceBlog = React.lazy(
  () => import('@/pages/blog/ai-predictive-maintenance-vs-reactive-service'),
);
const EAutomateVsModernBlog = React.lazy(
  () => import('@/pages/blog/e-automate-vs-modern-cloud-platforms'),
);
const DynamicPricingAIBlog = React.lazy(
  () => import('@/pages/blog/dynamic-pricing-ai-copier-dealers'),
);

// Conversion pages
const ROICalculator = React.lazy(() => import('@/pages/marketing/ROICalculator'));
const CaseStudies = React.lazy(() => import('@/pages/marketing/CaseStudies'));
const CompetitiveBattleCard = React.lazy(() => import('@/pages/marketing/CompetitiveBattleCard'));

// Utility pages
const LogoExport = React.lazy(() => import('@/pages/LogoExport'));

// Competitive Differentiation Pages
const AutopilotDashboard = React.lazy(() => import('@/pages/AutopilotDashboard'));
const ConnectDashboard = React.lazy(() => import('@/pages/ConnectDashboard'));
const CompareEAutomate = React.lazy(() => import('@/pages/CompareEAutomate'));
const IntegrationMarketplaceDashboard = React.lazy(
  () => import('@/pages/IntegrationMarketplaceDashboard'),
);
const ScheduledReportsDashboard = React.lazy(() => import('@/pages/ScheduledReportsDashboard'));
const MeetingToProposalDashboard = React.lazy(() => import('@/pages/MeetingToProposalDashboard'));
const AutoLeadRoutingDashboard = React.lazy(() => import('@/pages/AutoLeadRoutingDashboard'));
const PredictiveServiceDispatchDashboard = React.lazy(
  () => import('@/pages/PredictiveServiceDispatchDashboard'),
);
const WhiteLabelDashboard = React.lazy(() => import('@/pages/WhiteLabelDashboard'));
const AutoSupplyReplenishmentDashboard = React.lazy(
  () => import('@/pages/AutoSupplyReplenishmentDashboard'),
);

// Feature implementations - AI/ML powered features
const PredictiveContractProfitability = React.lazy(
  () => import('@/pages/PredictiveContractProfitability'),
);
const AIServiceIntelligence = React.lazy(() => import('@/pages/AIServiceIntelligence'));
const SalesRepAssignments = React.lazy(() => import('@/pages/SalesRepAssignments'));
const LeadMapViewer = React.lazy(() => import('@/pages/LeadMapViewer'));

// Core app pages - lazy load everything for optimal bundle splitting
const Dashboard = React.lazy(() => import('@/pages/dashboard'));
const ExecutiveDashboard = React.lazy(() => import('@/pages/ExecutiveDashboard'));
const LeadDetail = React.lazy(() => import('@/pages/LeadDetail'));
const Contracts = React.lazy(() => import('@/pages/contracts'));
const ContractRenewalDashboard = React.lazy(() => import('@/pages/ContractRenewalDashboard'));
const ProactiveServiceDashboard = React.lazy(() => import('@/pages/ProactiveServiceDashboard'));
const ServiceDispatchOptimization = React.lazy(() => import('@/pages/ServiceDispatchOptimization'));
const ServiceForecastingAnalytics = React.lazy(() => import('@/pages/ServiceForecastingAnalytics'));
const Inventory = React.lazy(() => import('@/pages/inventory'));
const Billing = React.lazy(() => import('@/pages/Billing'));
const Reports = React.lazy(() => import('@/pages/EnhancedReportsHub'));
const CustomReportBuilder = React.lazy(() => import('@/pages/CustomReportBuilder'));
const CustomDashboard = React.lazy(() => import('@/pages/CustomDashboard'));
const CSVImportWizard = React.lazy(() => import('@/pages/CSVImportWizard'));
const UniversalProductImport = React.lazy(() => import('@/pages/UniversalProductImport'));
const MeterReadings = React.lazy(() => import('@/pages/MeterReadings'));
const ProductModels = React.lazy(() => import('@/pages/ProductModels'));
const EnhancedProductModels = React.lazy(() => import('@/pages/EnhancedProductModels'));
const EnhancedProductAccessories = React.lazy(() => import('@/pages/EnhancedProductAccessories'));
const ProfessionalServices = React.lazy(() => import('@/pages/ProfessionalServices'));
const ServiceProducts = React.lazy(() => import('@/pages/ServiceProducts'));
const SoftwareProducts = React.lazy(() => import('@/pages/SoftwareProducts'));
const Supplies = React.lazy(() => import('@/pages/Supplies'));
const ManagedServices = React.lazy(() => import('@/pages/ManagedServices'));
const Invoices = React.lazy(() => import('@/pages/Invoices'));
const CompanyContacts = React.lazy(() => import('@/pages/CompanyContacts'));
const Vendors = React.lazy(() => import('@/pages/Vendors'));
const AccountsPayable = React.lazy(() => import('@/pages/AccountsPayable'));
const AccountsReceivable = React.lazy(() => import('@/pages/AccountsReceivable'));
const ChartOfAccounts = React.lazy(() => import('@/pages/ChartOfAccounts'));
const JournalEntries = React.lazy(() => import('@/pages/JournalEntries'));
const MeterBilling = React.lazy(() => import('@/pages/MeterBilling'));
const AdvancedReporting = React.lazy(() => import('@/pages/AdvancedReporting'));
const MobileOptimization = React.lazy(() => import('@/pages/MobileOptimization'));
const PerformanceMonitoring = React.lazy(() => import('@/pages/PerformanceMonitoring'));
const SystemIntegrations = React.lazy(() => import('@/pages/SystemIntegrations'));
const DeploymentReadiness = React.lazy(() => import('@/pages/DeploymentReadiness'));
const TaskHub = React.lazy(() => import('@/pages/TaskHub'));
const CrmDealsPage = React.lazy(() => import('@/pages/CrmDealsPage'));
const CrmLeadsPage = React.lazy(() => import('@/pages/CrmLeadsPage'));
const CrmContactsPage = React.lazy(() => import('@/pages/CrmContactsPage'));
const CrmCompaniesPage = React.lazy(() => import('@/pages/CrmCompaniesPage'));
const ProductHubUnified = React.lazy(() => import('@/pages/ProductHubUnified'));
const EquipmentLifecycleHub = React.lazy(() => import('@/pages/EquipmentLifecycleHub'));
const PurchaseOrders = React.lazy(() => import('@/pages/PurchaseOrders'));
const WarehouseOperations = React.lazy(() => import('@/pages/WarehouseOperations'));
const CrmGoalsDashboard = React.lazy(() => import('@/pages/CrmGoalsDashboard'));
const TodayDashboard = React.lazy(() => import('@/pages/TodayDashboard'));
const MobileFieldService = React.lazy(() => import('@/pages/MobileFieldService'));
const PricingManagement = React.lazy(() => import('@/pages/PricingManagement'));
const PricingSettings = React.lazy(() => import('@/pages/PricingSettings'));
const MarginAnalysisReport = React.lazy(() => import('@/pages/MarginAnalysisReport'));
const PriceApprovals = React.lazy(() => import('@/pages/PriceApprovals'));
const Contacts = React.lazy(() => import('@/pages/Contacts'));
const CustomerDetail = React.lazy(() => import('@/pages/CustomerDetail'));
const TenantSetup = React.lazy(() => import('@/pages/TenantSetup'));
const Settings = React.lazy(() => import('@/pages/Settings'));
const MonitoringClients = React.lazy(() => import('@/pages/MonitoringClients'));
const DeviceMonitoring = React.lazy(() => import('@/pages/DeviceMonitoring'));
const SupplyRunway = React.lazy(() => import('@/pages/SupplyRunway'));
const SupplyOrders = React.lazy(() => import('@/pages/SupplyOrders'));
const OidManagement = React.lazy(() => import('@/pages/OidManagement'));
const Pricing = React.lazy(() => import('@/pages/Pricing'));
const SubscriptionSettings = React.lazy(() => import('@/pages/SubscriptionSettings'));
const DataEnrichment = React.lazy(() => import('@/pages/DataEnrichment'));
const QuickBooksIntegration = React.lazy(() => import('@/pages/QuickBooksIntegration'));
const ManufacturerIntegration = React.lazy(() => import('@/pages/ManufacturerIntegration'));
const ManufacturerIntegrationDevices = React.lazy(
  () => import('@/pages/ManufacturerIntegrationDevices'),
);
const ManufacturerIntegrationAudit = React.lazy(
  () => import('@/pages/ManufacturerIntegrationAudit'),
);
const LeadsPage = React.lazy(() => import('@/pages/LeadsPage'));
const ProspectsPage = React.lazy(() => import('@/pages/ProspectsPage'));
const CustomersPage = React.lazy(() => import('@/pages/CustomersPage'));
// Outreach Hub
const OutreachHub = React.lazy(() => import('@/pages/outreach/OutreachHub'));
const OutreachBusinessContext = React.lazy(() => import('@/pages/outreach/BusinessContext'));
const OutreachMySpecialty = React.lazy(() => import('@/pages/outreach/MySpecialty'));
const OutreachSequenceStudio = React.lazy(() => import('@/pages/outreach/SequenceStudio'));
const OutreachDraftGenerator = React.lazy(() => import('@/pages/outreach/DraftGenerator'));
const QuoteProposalGeneration = React.lazy(() => import('@/pages/QuoteProposalGeneration'));
const QuoteBuilderPage = React.lazy(() => import('@/pages/QuoteBuilderPage'));
const QuotesManagement = React.lazy(() => import('@/pages/QuotesManagement'));
const CompanyIdsTest = React.lazy(() => import('@/pages/CompanyIdsTest'));
const QuoteView = React.lazy(() => import('@/pages/QuoteView'));
const ProposalBuilder = React.lazy(() => import('@/pages/ProposalBuilder'));
const DealDeskDashboard = React.lazy(() => import('@/pages/DealDeskDashboard'));
const ApprovalRequestDetail = React.lazy(() => import('@/pages/ApprovalRequestDetail'));
const ApprovalRulesConfiguration = React.lazy(() => import('@/pages/ApprovalRulesConfiguration'));
const PipelineConfiguration = React.lazy(() => import('@/pages/PipelineConfiguration'));
const PreventiveMaintenanceScheduling = React.lazy(
  () => import('@/pages/PreventiveMaintenanceScheduling'),
);
const PredictiveMaintenanceHub = React.lazy(() => import('@/pages/PredictiveMaintenanceHub'));
const CustomerSelfServicePortal = React.lazy(() => import('@/pages/CustomerSelfServicePortal'));
const AdvancedBillingEngine = React.lazy(() => import('@/pages/AdvancedBillingEngine'));
const BillingRules = React.lazy(() => import('@/pages/BillingRules'));
const BillingAnalytics = React.lazy(() => import('@/pages/BillingAnalytics'));
const VendorManagement = React.lazy(() => import('@/pages/VendorManagement'));
const CustomerNumberSettings = React.lazy(() => import('@/pages/CustomerNumberSettings'));
const FinancialForecasting = React.lazy(() => import('@/pages/FinancialForecasting'));
const FinancialIntelligenceDashboard = React.lazy(
  () => import('@/pages/FinancialIntelligenceDashboard'),
);
const CommissionManagement = React.lazy(() => import('@/pages/CommissionManagement'));
const SalesPerformanceAnalytics = React.lazy(() => import('@/pages/SalesPerformanceAnalytics'));
const ServiceAnalytics = React.lazy(() => import('@/pages/ServiceAnalytics'));
const MobileFieldOperations = React.lazy(() => import('@/pages/MobileFieldOperations'));
const RemoteMonitoring = React.lazy(() => import('@/pages/RemoteMonitoring'));
const FleetMonitoringDashboard = React.lazy(() => import('@/pages/FleetMonitoringDashboard'));
const DemoScheduling = React.lazy(() => import('@/pages/DemoScheduling'));
const SocialMediaGenerator = React.lazy(() => import('@/pages/SocialMediaGenerator'));
const SystemMonitoring = React.lazy(() => import('@/pages/SystemMonitoring'));
const AdminHub = React.lazy(() => import('@/pages/AdminHub'));
const AdminCommandCenter = React.lazy(() => import('@/pages/AdminCommandCenter'));
const RootAdminDashboard = React.lazy(() => import('@/pages/RootAdminDashboard'));
const RootAdminSignupsCRM = React.lazy(() => import('@/pages/RootAdminSignupsCRM'));
const RootAdminSEO = React.lazy(() => import('@/pages/RootAdminSEO'));
const SEODashboard = React.lazy(() => import('@/pages/SEODashboard'));
const PlatformConfiguration = React.lazy(() => import('@/pages/PlatformConfiguration'));

// Platform CRM - Full tenant lifecycle management for root admins
const PlatformCRMDashboard = React.lazy(() => import('@/pages/PlatformCRMDashboard'));
const PlatformBusinessRecords = React.lazy(() => import('@/pages/PlatformBusinessRecords'));
const PlatformBusinessRecordDetail = React.lazy(
  () => import('@/pages/PlatformBusinessRecordDetail'),
);
const PlatformDealsPipeline = React.lazy(() => import('@/pages/PlatformDealsPipeline'));
const PlatformDealDetail = React.lazy(() => import('@/pages/PlatformDealDetail'));
const PlatformTerritories = React.lazy(() => import('@/pages/PlatformTerritories'));
const PlatformLeadScoring = React.lazy(() => import('@/pages/PlatformLeadScoring'));
const PlatformAssignmentRules = React.lazy(() => import('@/pages/PlatformAssignmentRules'));
const PlatformCustomerSuccess = React.lazy(() => import('@/pages/PlatformCustomerSuccess'));
const PlatformAnalytics = React.lazy(() => import('@/pages/PlatformAnalytics'));
const PlatformCohortAnalysis = React.lazy(() => import('@/pages/PlatformCohortAnalysis'));
const DatabaseManagement = React.lazy(() => import('@/pages/DatabaseManagement'));
const SalesPipelineForecasting = React.lazy(() => import('@/pages/SalesPipelineForecasting'));
const SalesPipelineWorkflow = React.lazy(() => import('@/pages/SalesPipelineWorkflow'));
const SalesCommandCenter = React.lazy(() => import('@/pages/SalesCommandCenter'));
const AdvancedAnalytics = React.lazy(() => import('@/pages/AdvancedAnalytics'));
const ESignatureIntegration = React.lazy(() => import('@/pages/ESignatureIntegration'));
const PreventiveMaintenanceAutomation = React.lazy(
  () => import('@/pages/PreventiveMaintenanceAutomation'),
);
const CustomerSuccessManagement = React.lazy(() => import('@/pages/CustomerSuccessManagement'));
const DocumentManagement = React.lazy(() => import('@/pages/DocumentManagement'));
const MobileServiceApp = React.lazy(() => import('@/pages/MobileServiceApp'));
const AdvancedAnalyticsDashboard = React.lazy(() => import('@/pages/AdvancedAnalyticsDashboard'));
const BusinessProcessOptimization = React.lazy(() => import('@/pages/BusinessProcessOptimization'));
const SecurityComplianceManagement = React.lazy(
  () => import('@/pages/SecurityComplianceManagement'),
);
const IncidentResponseSystem = React.lazy(() => import('@/pages/IncidentResponseSystem'));
const AIAnalyticsDashboard = React.lazy(() => import('@/pages/AIAnalyticsDashboard'));
const IntegrationHub = React.lazy(() => import('@/pages/IntegrationHub'));
const WorkflowAutomation = React.lazy(() => import('@/pages/WorkflowAutomation'));
const PredictiveAnalytics = React.lazy(() => import('@/pages/PredictiveAnalytics'));
const ERPIntegration = React.lazy(() => import('@/pages/ERPIntegration'));
const CustomerAccessManagement = React.lazy(() => import('@/pages/CustomerAccessManagement'));
const ServiceHub = React.lazy(() => import('@/pages/ServiceHub'));
const ApolloLeadEnrichment = React.lazy(() => import('@/pages/ApolloLeadEnrichment'));
const OnboardingDashboard = React.lazy(() => import('@/pages/OnboardingDashboard'));
const SetupWizard = React.lazy(() => import('@/pages/SetupWizard'));
const OnboardingDetails = React.lazy(() => import('@/pages/OnboardingDetails'));
const EnhancedOnboardingForm = React.lazy(() => import('@/pages/EnhancedOnboardingForm'));
const ComprehensiveOnboardingForm = React.lazy(() => import('@/pages/ComprehensiveOnboardingForm'));
const RoleManagement = React.lazy(() => import('@/pages/RoleManagement'));
const AuditLogViewer = React.lazy(() => import('@/pages/AuditLogViewer'));
const ApiKeyManagement = React.lazy(() => import('@/pages/ApiKeyManagement'));
const GPT5Dashboard = React.lazy(() => import('@/pages/GPT5Dashboard'));
const DocumentBuilder = React.lazy(() => import('@/pages/DocumentBuilder'));
const TechnicianManagement = React.lazy(() => import('@/pages/TechnicianManagement'));
const VehicleManagement = React.lazy(() => import('@/pages/VehicleManagement'));
const AssetManagement = React.lazy(() => import('@/pages/AssetManagement'));

// AI Hub Pages
const AIHub = React.lazy(() => import('@/pages/AIHub'));
const AIEmployeeDashboard = React.lazy(() => import('@/pages/AIEmployeeDashboard'));
const CalendarPage = React.lazy(() => import('@/pages/CalendarPage'));
const MeetingTranscription = React.lazy(() => import('@/pages/MeetingTranscription'));
const AISearchKnowledgeDashboard = React.lazy(() => import('@/pages/AISearchKnowledgeDashboard'));
const ConversationalAIDashboard = React.lazy(() => import('@/pages/ConversationalAIDashboard'));

// Lease Management Pages
const Leases = React.lazy(() => import('@/pages/Leases'));
const LeaseDetail = React.lazy(() => import('@/pages/LeaseDetail'));
const LeaseForm = React.lazy(() => import('@/pages/LeaseForm'));

// Knowledge Base Pages
const KnowledgeBase = React.lazy(() => import('@/pages/KnowledgeBase'));
const KnowledgeArticle = React.lazy(() => import('@/pages/KnowledgeArticle'));
const KnowledgeBaseAdmin = React.lazy(() => import('@/pages/admin/KnowledgeBaseAdmin'));
const ArticleEditor = React.lazy(() => import('@/pages/admin/ArticleEditor'));

// Platform Admin Pages
const SecurityDashboard = React.lazy(() => import('@/pages/SecurityDashboard'));
const RootAdminSecurity = React.lazy(() => import('@/pages/admin/RootAdminSecurity'));
const SystemSecurity = React.lazy(() => import('@/pages/admin/SystemSecurity'));
const DatabaseUpdaterPage = React.lazy(() => import('@/pages/admin/DatabaseUpdaterPage'));
const TenantManagement = React.lazy(() => import('@/pages/admin/TenantManagement'));
const UserManagement = React.lazy(() => import('@/pages/admin/UserManagement'));
const MobileLogsViewer = React.lazy(() => import('@/pages/admin/MobileLogsViewer'));
const DisposableEmailDomainsAdmin = React.lazy(
  () => import('@/pages/admin/DisposableEmailDomains'),
);

// Blog Module — Platform Admin (US-BLOG-001 foundation, US-BLOG-086 settings,
// US-BLOG-007 admin shell + sub-section placeholder pages).
// Distinct from the public marketing /blog route imported above.
const BlogPlatformAdmin = React.lazy(() => import('@/pages/platform-admin/blog/BlogIndex'));
const BlogSettings = React.lazy(() => import('@/pages/platform-admin/blog/BlogSettings'));
const BlogIdeas = React.lazy(() => import('@/pages/platform-admin/blog/BlogIdeas'));
const BlogBriefs = React.lazy(() => import('@/pages/platform-admin/blog/BlogBriefs'));
const BlogPosts = React.lazy(() => import('@/pages/platform-admin/blog/BlogPosts'));
const BlogDistribution = React.lazy(() => import('@/pages/platform-admin/blog/BlogDistribution'));
const BlogAnalytics = React.lazy(() => import('@/pages/platform-admin/blog/BlogAnalytics'));
const BlogRefresh = React.lazy(() => import('@/pages/platform-admin/blog/BlogRefresh'));

const LAST_ROUTE_KEY = 'printyx_last_route';

function Router() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const [pathname, setLocation] = useLocation();
  // Announce route changes to screen readers (WCAG 2.4.2, 4.1.3)
  useRouteAnnouncer();

  // Save current route to localStorage when authenticated
  React.useEffect(() => {
    // Don't save auth pages or API routes
    const excludedPaths = [
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/auth/callback',
    ];
    const shouldSave =
      isAuthenticated &&
      pathname !== '/' &&
      !excludedPaths.some((p) => pathname.startsWith(p)) &&
      !pathname.startsWith('/api/');

    if (shouldSave) {
      try {
        localStorage.setItem(LAST_ROUTE_KEY, pathname);
      } catch (error) {
        console.error('Error saving route:', error);
      }
    }
  }, [pathname, isAuthenticated]);

  // Restore last route on authentication
  React.useEffect(() => {
    if (isAuthenticated && pathname === '/') {
      try {
        const lastRoute = localStorage.getItem(LAST_ROUTE_KEY);
        // Only restore if it's a valid authenticated route
        const excludedPaths = [
          '/login',
          '/signup',
          '/forgot-password',
          '/reset-password',
          '/auth/callback',
        ];
        const isValidRoute =
          lastRoute &&
          lastRoute !== '/' &&
          !excludedPaths.some((p) => lastRoute.startsWith(p)) &&
          !lastRoute.startsWith('/api/') &&
          !lastRoute.includes('data-enrichment');

        if (isValidRoute) {
          setLocation(lastRoute);
        } else {
          // Clear invalid routes from localStorage
          localStorage.removeItem(LAST_ROUTE_KEY);
        }
      } catch (error) {
        console.error('Error restoring route:', error);
      }
    }
  }, [isAuthenticated, pathname, setLocation]);

  // Clear route history on logout
  React.useEffect(() => {
    if (!isAuthenticated) {
      try {
        localStorage.removeItem(LAST_ROUTE_KEY);
      } catch (error) {
        console.error('Error clearing route:', error);
      }
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
        role="status"
        aria-busy="true"
        aria-label="Initializing application"
      >
        <div className="text-center animate-fade-in">
          <div
            className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"
            aria-hidden="true"
          />
          <p className="mt-4 text-gray-600 font-medium">Loading Printyx...</p>
          {/* SEO: Provide meaningful fallback content for crawlers */}
          <noscript>
            <div className="mt-4 text-sm text-gray-500">
              <p>Printyx - Modern Cloud Platform for Copier Dealers</p>
              <p>Please enable JavaScript to continue.</p>
            </div>
          </noscript>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Switch>
          <Route path="/export-logos" component={LogoExport} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/verify-email" component={VerifyEmail} />
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/eula" component={EndUserLicenseAgreement} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsAndConditions} />
          <Route path="/accessibility" component={AccessibilityStatement} />
          <Route path="/" component={Homepage} />

          {/* Strategic landing pages */}
          <Route path="/predictive-intelligence" component={PredictiveIntelligence} />
          <Route path="/modern-architecture" component={ModernArchitecture} />
          <Route path="/integration-marketplace" component={IntegrationMarketplace} />
          <Route path="/dealer-expertise" component={DealerExpertise} />

          {/* Blog routes */}
          <Route path="/blog" component={BlogIndex} />
          <Route
            path="/blog/ai-predictive-maintenance-vs-reactive-service"
            component={AIPredictiveMaintenanceBlog}
          />
          <Route
            path="/blog/e-automate-vs-modern-cloud-platforms"
            component={EAutomateVsModernBlog}
          />
          <Route path="/blog/dynamic-pricing-ai-copier-dealers" component={DynamicPricingAIBlog} />

          {/* Conversion pages */}
          <Route path="/roi-calculator" component={ROICalculator} />
          <Route path="/case-studies" component={CaseStudies} />
          <Route path="/battle-card" component={CompetitiveBattleCard} />

          {/* Marketing pages */}
          <Route path="/p/copier-dealer-crm" component={CopierDealerCRM} />
          <Route path="/p/print-service-dispatch-mobile" component={PrintServiceDispatchMobile} />
          <Route
            path="/p/master-product-catalog-canon-imagerunner"
            component={CanonMasterProductCatalog}
          />
          <Route component={Homepage} />
        </Switch>

        {/* Accessibility Widget - Available on public pages for WCAG 2.1 AA */}
        <AccessibilityWidget />
      </>
    );
  }

  // Redirect component for auth pages when already authenticated
  const RedirectToDashboard = () => {
    React.useEffect(() => {
      window.location.replace('/');
    }, []);
    return null;
  };

  // Authenticated routes
  return (
    <>
      <SubscriptionBanner />
      <React.Suspense
        fallback={
          <div
            className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
            role="status"
            aria-busy="true"
            aria-label="Loading page content"
          >
            <div className="text-center animate-fade-in">
              <div
                className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"
                aria-hidden="true"
              />
              <p className="mt-4 text-gray-600 font-medium">Loading...</p>
              {/* SEO: Provide meaningful content for crawlers */}
              <noscript>
                <p>Please enable JavaScript to use Printyx.</p>
              </noscript>
            </div>
          </div>
        }
      >
        <main id="main-content" tabIndex={-1} className="outline-none">
          <PageErrorBoundary name="Router">
            <RoutePermissionGate>
              <Switch>
                {/* Redirect auth pages to dashboard for authenticated users */}
                <Route path="/login" component={RedirectToDashboard} />
                <Route path="/signup" component={RedirectToDashboard} />
                <Route path="/forgot-password" component={RedirectToDashboard} />
                <Route path="/auth/callback" component={AuthCallback} />
                <Route path="/unauthorized" component={Unauthorized} />
                <Route path="/" component={Dashboard} />
                <Route path="/executive-dashboard">
                  {() => (
                    <ProtectedRoute
                      component={ExecutiveDashboard}
                      permissions={['reporting.executive.view']}
                      minLevel={6}
                    />
                  )}
                </Route>
                <Route path="/today" component={TodayDashboard} />
                <Route path="/dashboard/today" component={TodayDashboard} />
                {/* CRM */}
                <Route path="/crm/deals" component={CrmDealsPage} />
                <Route path="/crm/leads" component={CrmLeadsPage} />
                <Route path="/crm/contacts" component={CrmContactsPage} />
                <Route path="/crm/companies" component={CrmCompaniesPage} />
                <Route path="/leads" component={LeadsPage} />
                <Route path="/prospects" component={ProspectsPage} />
                <Route path="/customers" component={CustomersPage} />
                <Route path="/customers/:slug" component={CustomerDetail} />
                <Route path="/crm" component={CustomersPage} />
                <Route path="/business-records" component={CustomersPage} />
                <Route path="/leads-management" component={LeadsPage} />
                <Route path="/contacts" component={Contacts} />
                <Route path="/deals" component={CrmDealsPage} />
                <Route path="/opportunities" component={CrmDealsPage} />
                <Route path="/deals-management" component={CrmDealsPage} />
                {/* Outreach Hub */}
                <Route path="/outreach" component={OutreachHub} />
                <Route path="/outreach/business-context" component={OutreachBusinessContext} />
                <Route path="/outreach/my-specialty" component={OutreachMySpecialty} />
                <Route path="/outreach/sequence-studio" component={OutreachSequenceStudio} />
                <Route path="/outreach/draft-generator" component={OutreachDraftGenerator} />
                {/* Product Hub */}
                <Route path="/product-hub" component={ProductHubUnified} />
                {/* Equipment Lifecycle */}
                <Route path="/equipment-lifecycle" component={EquipmentLifecycleHub} />
                <Route path="/purchase-orders" component={PurchaseOrders} />
                <Route path="/warehouse-operations" component={WarehouseOperations} />
                <Route path="/crm-goals" component={CrmGoalsDashboard} />
                <Route path="/crm-goals-dashboard" component={CrmGoalsDashboard} />
                <Route path="/data-enrichment" component={DataEnrichment} />
                <Route path="/quickbooks-integration" component={QuickBooksIntegration} />
                <Route path="/quote-proposal-generation" component={QuoteProposalGeneration} />
                <Route path="/quotes" component={QuotesManagement} />
                <Route path="/quotes/new" component={QuoteBuilderPage} />
                <Route path="/quotes/:quoteId" component={QuoteBuilderPage} />
                <Route path="/quotes/:quoteId/view" component={QuoteView} />
                <Route path="/proposal-builder" component={ProposalBuilder} />
                {/* Deal Desk & Approval Workflows */}
                <Route path="/deal-desk">
                  {() => (
                    <ProtectedRoute
                      component={DealDeskDashboard}
                      permissions={[
                        'sales.quote.approve_standard',
                        'sales.quote.approve_high_value',
                        'sales.quote.approve_enterprise',
                      ]}
                      minLevel={3}
                    />
                  )}
                </Route>
                <Route path="/deal-desk/requests/:id" component={ApprovalRequestDetail} />
                <Route path="/deal-desk/rules" component={ApprovalRulesConfiguration} />
                {/* Pipeline Configuration */}
                <Route path="/pipeline-config">
                  {() => (
                    <ProtectedRoute
                      component={PipelineConfiguration}
                      permissions={['sales.territory.manage_assignments']}
                      minLevel={4}
                    />
                  )}
                </Route>
                {/* Use /preventive-maintenance as primary route */}
                <Route path="/preventive-maintenance" component={PreventiveMaintenanceScheduling} />
                {/* Unified Predictive Maintenance Hub - consolidates proactive + AI predictions */}
                <Route path="/predictive-maintenance-hub" component={PredictiveMaintenanceHub} />
                <Route path="/incident-response-system" component={IncidentResponseSystem} />
                <Route path="/customer-portal" component={CustomerSelfServicePortal} />
                <Route path="/advanced-billing" component={AdvancedBillingEngine} />
                <Route path="/financial-forecasting">
                  {() => (
                    <ProtectedRoute
                      component={FinancialForecasting}
                      permissions={['finance.reports.view', 'finance.reports.view_sensitive']}
                      minLevel={5}
                    />
                  )}
                </Route>
                <Route path="/financial-intelligence-dashboard">
                  {() => (
                    <ProtectedRoute
                      component={FinancialIntelligenceDashboard}
                      permissions={['reporting.finance.view', 'finance.reports.view_sensitive']}
                      minLevel={5}
                    />
                  )}
                </Route>
                <Route path="/equipment-lifecycle-management" component={EquipmentLifecycleHub} />
                <Route path="/commission-management" component={CommissionManagement} />
                <Route path="/sales-command-center" component={SalesCommandCenter} />
                <Route path="/sales-performance-analytics" component={SalesPerformanceAnalytics} />
                <Route path="/remote-monitoring" component={RemoteMonitoring} />
                <Route path="/fleet-monitoring" component={FleetMonitoringDashboard} />
                <Route path="/service-analytics" component={ServiceAnalytics} />
                <Route path="/workflow-automation" component={WorkflowAutomation} />

                {/* Competitive Differentiation Routes */}
                <Route path="/autopilot" component={AutopilotDashboard} />
                <Route path="/auto-lead-routing" component={AutoLeadRoutingDashboard} />
                <Route path="/sales-rep-assignments" component={SalesRepAssignments} />
                <Route path="/lead-map" component={LeadMapViewer} />
                <Route
                  path="/predictive-service-dispatch"
                  component={PredictiveServiceDispatchDashboard}
                />
                <Route path="/connect" component={ConnectDashboard} />
                <Route path="/white-label" component={WhiteLabelDashboard} />
                <Route
                  path="/auto-supply-replenishment"
                  component={AutoSupplyReplenishmentDashboard}
                />
                <Route path="/contract-renewal-autopilot" component={ContractRenewalDashboard} />
                <Route path="/compare-eautomate" component={CompareEAutomate} />
                <Route
                  path="/integration-marketplace"
                  component={IntegrationMarketplaceDashboard}
                />
                <Route path="/scheduled-reports" component={ScheduledReportsDashboard} />
                <Route path="/meeting-to-proposal" component={MeetingToProposalDashboard} />

                <Route path="/mobile-field-operations" component={MobileFieldOperations} />
                <Route path="/leads/:slug" component={LeadDetail} />
                <Route path="/companies/:companyId/contacts" component={CompanyContacts} />
                <Route path="/company-contacts" component={CompanyContacts} />
                <Route path="/sales-reports" component={Reports} />
                <Route path="/service-reports" component={Reports} />
                <Route path="/revenue-reports" component={Reports} />
                <Route path="/contracts" component={Contracts} />
                <Route path="/contract-renewals" component={ContractRenewalDashboard} />
                <Route path="/leases" component={Leases} />
                <Route path="/leases/new" component={LeaseForm} />
                <Route path="/leases/:id/edit" component={LeaseForm} />
                <Route path="/leases/:id" component={LeaseDetail} />
                <Route path="/document-builder" component={DocumentBuilder} />
                <Route path="/meter-readings" component={MeterReadings} />
                <Route path="/invoices" component={Invoices} />
                <Route path="/service-dispatch" component={ServiceDispatchOptimization} />
                <Route path="/proactive-service" component={ProactiveServiceDashboard} />
                <Route
                  path="/service-forecasting-analytics"
                  component={ServiceForecastingAnalytics}
                />
                <Route path="/technician-management" component={TechnicianManagement} />
                <Route path="/vehicle-management" component={VehicleManagement} />
                <Route path="/asset-management" component={AssetManagement} />
                <Route path="/mobile-field-service" component={MobileFieldService} />
                <Route path="/product-catalog" component={ProductHubUnified} />
                <Route path="/product-management-hub" component={ProductHubUnified} />
                <Route path="/inventory" component={Inventory} />
                <Route path="/product-models" component={ProductModels} />
                <Route path="/product-models-v2" component={EnhancedProductModels} />
                <Route path="/pricing/settings" component={PricingSettings} />
                <Route path="/pricing/margin-report" component={MarginAnalysisReport} />
                <Route path="/pricing/approvals" component={PriceApprovals} />
                <Route path="/product-accessories" component={EnhancedProductAccessories} />
                <Route path="/professional-services" component={ProfessionalServices} />
                <Route path="/service-products" component={ServiceProducts} />
                <Route path="/software-products" component={SoftwareProducts} />
                <Route path="/supplies" component={Supplies} />
                <Route path="/managed-services" component={ManagedServices} />
                <Route path="/billing" component={MeterBilling} />
                <Route path="/meter-billing" component={MeterBilling} />
                <Route path="/advanced-billing-engine" component={AdvancedBillingEngine} />
                <Route path="/billing-rules" component={BillingRules} />
                <Route path="/billing-analytics" component={BillingAnalytics} />
                <Route path="/vendor-management" component={VendorManagement} />
                <Route path="/vendors" component={Vendors} />
                <Route path="/accounts-payable" component={AccountsPayable} />
                <Route path="/accounts-receivable" component={AccountsReceivable} />
                <Route path="/chart-of-accounts">
                  {() => (
                    <ProtectedRoute
                      component={ChartOfAccounts}
                      permissions={['finance.gl.view']}
                      minLevel={4}
                    />
                  )}
                </Route>
                <Route path="/journal-entries">
                  {() => (
                    <ProtectedRoute
                      component={JournalEntries}
                      permissions={['finance.gl.view', 'finance.gl.post']}
                      minLevel={4}
                    />
                  )}
                </Route>
                <Route path="/reports" component={Reports} />
                <Route path="/reports/custom/new" component={CustomReportBuilder} />
                <Route path="/custom-dashboard" component={CustomDashboard} />
                <Route path="/import" component={CSVImportWizard} />
                <Route path="/import/products" component={UniversalProductImport} />
                <Route path="/advanced-reporting" component={AdvancedReporting} />
                <Route path="/advanced-analytics" component={AdvancedAnalytics} />
                <Route path="/mobile-optimization" component={MobileOptimization} />
                <Route path="/performance-monitoring" component={PerformanceMonitoring} />
                <Route path="/system-integrations" component={SystemIntegrations} />
                <Route path="/deployment-readiness">
                  {() => (
                    <ProtectedRoute
                      component={DeploymentReadiness}
                      permissions={['admin.settings.update']}
                      minLevel={6}
                    />
                  )}
                </Route>
                {/* Task Hub */}
                <Route path="/task-hub" component={TaskHub} />
                <Route path="/tasks" component={TaskHub} />
                <Route path="/task-management" component={TaskHub} />
                <Route path="/basic-tasks" component={TaskHub} />
                <Route path="/my-tasks" component={TaskHub} />
                <Route path="/customer-success-management" component={CustomerSuccessManagement} />
                <Route path="/pricing-management" component={PricingManagement} />
                <Route path="/tenant-setup" component={TenantSetup} />
                <Route path="/settings" component={Settings} />
                <Route path="/settings/api-keys" component={ApiKeyManagement} />
                <Route path="/monitoring-clients" component={MonitoringClients} />
                <Route path="/device-monitoring" component={DeviceMonitoring} />
                <Route path="/supply-runway" component={SupplyRunway} />
                <Route path="/supply-orders" component={SupplyOrders} />
                <Route path="/oid-management" component={OidManagement} />
                <Route path="/pricing" component={Pricing} />
                <Route path="/settings/subscription" component={SubscriptionSettings} />
                <Route path="/settings/billing" component={Billing} />
                <Route path="/company-ids-test" component={CompanyIdsTest} />
                <Route path="/customer-number-settings" component={CustomerNumberSettings} />
                <Route path="/demo-scheduling" component={DemoScheduling} />
                <Route path="/sales-pipeline-forecasting" component={SalesPipelineForecasting} />

                <Route path="/sales-pipeline-workflow" component={SalesPipelineWorkflow} />
                <Route path="/sales-pipeline" component={SalesPipelineWorkflow} />
                <Route path="/esignature-integration" component={ESignatureIntegration} />
                <Route path="/service-hub" component={ServiceHub} />
                <Route path="/apollo-leads" component={ApolloLeadEnrichment} />
                <Route
                  path="/preventive-maintenance-automation"
                  component={PreventiveMaintenanceAutomation}
                />
                <Route path="/customer-success" component={CustomerSuccessManagement} />
                <Route path="/document-management" component={DocumentManagement} />
                <Route path="/mobile-service-app" component={MobileServiceApp} />
                <Route
                  path="/advanced-analytics-dashboard"
                  component={AdvancedAnalyticsDashboard}
                />
                <Route
                  path="/business-process-optimization"
                  component={BusinessProcessOptimization}
                />
                <Route path="/security-compliance" component={SecurityComplianceManagement} />
                <Route path="/security-compliance-management">
                  {() => (
                    <ProtectedRoute
                      component={SecurityComplianceManagement}
                      permissions={['audit.logs.view_location', 'compliance.reports.view']}
                      minLevel={5}
                    />
                  )}
                </Route>
                <Route path="/customer-self-service-portal" component={CustomerSelfServicePortal} />
                <Route path="/incident-response" component={IncidentResponseSystem} />
                <Route path="/ai-analytics-dashboard" component={AIAnalyticsDashboard} />
                <Route path="/predictive-analytics">
                  {() => (
                    <ProtectedRoute
                      component={PredictiveAnalytics}
                      permissions={['reporting.executive.view']}
                      minLevel={5}
                    />
                  )}
                </Route>
                <Route
                  path="/predictive-contract-profitability"
                  component={PredictiveContractProfitability}
                />
                <Route path="/ai-service-intelligence" component={AIServiceIntelligence} />
                <Route path="/integration-hub" component={IntegrationHub} />
                <Route path="/integrations" component={IntegrationHub} />
                <Route path="/social-media-generator" component={SocialMediaGenerator} />
                <Route path="/security-management" component={SecurityComplianceManagement} />
                <Route path="/system-monitoring" component={SystemMonitoring} />
                <Route path="/access-control" component={RoleManagement} />
                <Route path="/role-management">
                  {() => (
                    <ProtectedRoute
                      component={RoleManagement}
                      permissions={['admin.role.view', 'admin.role.create']}
                      minLevel={4}
                    />
                  )}
                </Route>
                <Route path="/gpt5-dashboard" component={GPT5Dashboard} />
                <Route path="/admin-hub">
                  {() => <ProtectedRoute component={AdminHub} platformOnly />}
                </Route>
                <Route path="/admin-command-center">
                  {() => <AdminRouteGuard component={AdminCommandCenter} />}
                </Route>
                <Route path="/root-admin-dashboard">
                  {() => <ProtectedRoute component={RootAdminDashboard} platformOnly />}
                </Route>
                <Route path="/root-admin-signups-crm">
                  {() => <AdminRouteGuard component={RootAdminSignupsCRM} />}
                </Route>
                <Route path="/root-admin/seo">
                  {() => <AdminRouteGuard component={RootAdminSEO} />}
                </Route>
                <Route path="/seo" component={SEODashboard} />

                {/* Platform CRM Routes - Full tenant lifecycle management (admin-guarded) */}
                <Route path="/platform-crm">
                  {() => <AdminRouteGuard component={PlatformCRMDashboard} />}
                </Route>
                <Route path="/platform-crm/dashboard">
                  {() => <AdminRouteGuard component={PlatformCRMDashboard} />}
                </Route>
                <Route path="/platform-crm/business-records/:id">
                  {() => <AdminRouteGuard component={PlatformBusinessRecordDetail} />}
                </Route>
                <Route path="/platform-crm/business-records">
                  {() => <AdminRouteGuard component={PlatformBusinessRecords} />}
                </Route>
                <Route path="/platform-crm/deals/:id">
                  {() => <AdminRouteGuard component={PlatformDealDetail} />}
                </Route>
                <Route path="/platform-crm/pipeline">
                  {() => <AdminRouteGuard component={PlatformDealsPipeline} />}
                </Route>
                <Route path="/platform-crm/territories">
                  {() => <AdminRouteGuard component={PlatformTerritories} />}
                </Route>
                <Route path="/platform-crm/lead-scoring">
                  {() => <AdminRouteGuard component={PlatformLeadScoring} />}
                </Route>
                <Route path="/platform-crm/assignment-rules">
                  {() => <AdminRouteGuard component={PlatformAssignmentRules} />}
                </Route>
                <Route path="/platform-crm/customer-success">
                  {() => <AdminRouteGuard component={PlatformCustomerSuccess} />}
                </Route>
                <Route path="/platform-crm/analytics">
                  {() => <AdminRouteGuard component={PlatformAnalytics} />}
                </Route>
                <Route path="/platform-crm/cohort-analysis">
                  {() => <AdminRouteGuard component={PlatformCohortAnalysis} />}
                </Route>

                {/* Platform Admin Routes - RBAC-protected, no /admin prefix needed */}
                <Route path="/admin/root-admin-security">
                  {() => <ProtectedRoute component={RootAdminSecurity} platformOnly />}
                </Route>
                <Route path="/admin/system-security">
                  {() => <AdminRouteGuard component={SystemSecurity} />}
                </Route>
                <Route path="/security-dashboard">
                  {() => <ProtectedRoute component={SecurityDashboard} platformOnly />}
                </Route>
                <Route path="/admin/database-updater">
                  {() => <AdminRouteGuard component={DatabaseUpdaterPage} />}
                </Route>
                <Route path="/admin/tenant-management">
                  {() => <ProtectedRoute component={TenantManagement} platformOnly />}
                </Route>
                {/* Blog Module — Platform Admin (US-BLOG-001 foundation, US-BLOG-086
                    settings, US-BLOG-007 admin shell + sub-section pages). Order matters:
                    more-specific paths first; /platform-admin/blog catches the index. */}
                <Route path="/platform-admin/blog/settings">
                  {() => <ProtectedRoute component={BlogSettings} platformOnly />}
                </Route>
                <Route path="/platform-admin/blog/ideas">
                  {() => <ProtectedRoute component={BlogIdeas} platformOnly />}
                </Route>
                <Route path="/platform-admin/blog/briefs">
                  {() => <ProtectedRoute component={BlogBriefs} platformOnly />}
                </Route>
                <Route path="/platform-admin/blog/posts">
                  {() => <ProtectedRoute component={BlogPosts} platformOnly />}
                </Route>
                <Route path="/platform-admin/blog/distribution">
                  {() => <ProtectedRoute component={BlogDistribution} platformOnly />}
                </Route>
                <Route path="/platform-admin/blog/analytics">
                  {() => <ProtectedRoute component={BlogAnalytics} platformOnly />}
                </Route>
                <Route path="/platform-admin/blog/refresh">
                  {() => <ProtectedRoute component={BlogRefresh} platformOnly />}
                </Route>
                <Route path="/platform-admin/blog">
                  {() => <ProtectedRoute component={BlogPlatformAdmin} platformOnly />}
                </Route>
                <Route path="/admin/disposable-emails">
                  {() => <ProtectedRoute component={DisposableEmailDomainsAdmin} platformOnly />}
                </Route>
                <Route path="/admin/user-management">
                  {() => (
                    <ProtectedRoute
                      component={UserManagement}
                      permissions={['admin.user.view']}
                      minLevel={4}
                    />
                  )}
                </Route>
                <Route path="/admin/system-settings">
                  {() => <AdminRouteGuard component={Settings} />}
                </Route>
                <Route path="/admin/platform-analytics">
                  {() => <AdminRouteGuard component={AdvancedAnalyticsDashboard} />}
                </Route>
                <Route path="/admin/knowledge-base">
                  {() => <AdminRouteGuard component={KnowledgeBaseAdmin} />}
                </Route>
                <Route path="/admin/knowledge-base/new">
                  {() => <AdminRouteGuard component={ArticleEditor} />}
                </Route>
                <Route path="/admin/knowledge-base/edit/:id">
                  {() => <AdminRouteGuard component={ArticleEditor} />}
                </Route>
                <Route path="/platform-configuration">
                  {() => <ProtectedRoute component={PlatformConfiguration} platformOnly />}
                </Route>
                <Route path="/database-management">
                  {() => <ProtectedRoute component={DatabaseManagement} platformOnly />}
                </Route>
                <Route path="/admin/mobile-logs">
                  {() => <ProtectedRoute component={MobileLogsViewer} platformOnly />}
                </Route>
                <Route path="/admin/audit-logs">
                  {() => <ProtectedRoute component={AuditLogViewer} platformOnly />}
                </Route>
                <Route path="/erp-integration" component={ERPIntegration} />
                <Route path="/customer-access-management" component={CustomerAccessManagement} />
                <Route path="/manufacturer-integration" component={ManufacturerIntegration} />
                <Route
                  path="/manufacturer-integration/devices"
                  component={ManufacturerIntegrationDevices}
                />
                <Route
                  path="/manufacturer-integration/audit"
                  component={ManufacturerIntegrationAudit}
                />

                {/* AI Hub Routes */}
                <Route path="/ai-hub" component={AIHub} />
                <Route path="/ai-employees" component={AIEmployeeDashboard} />
                <Route path="/calendar" component={CalendarPage} />
                <Route path="/meeting-transcription" component={MeetingTranscription} />
                <Route path="/ai-task-scheduling" component={TaskHub} />
                <Route path="/ai-search" component={AISearchKnowledgeDashboard} />
                <Route path="/conversational-ai-dashboard" component={ConversationalAIDashboard} />

                {/* Knowledge Base Routes */}
                <Route path="/knowledge-base" component={KnowledgeBase} />
                <Route path="/knowledge-base/article/:slug" component={KnowledgeArticle} />
                <Route path="/knowledge-base/category/:slug" component={KnowledgeBase} />

                <Route path="/eula" component={EndUserLicenseAgreement} />
                <Route path="/privacy" component={PrivacyPolicy} />
                <Route path="/terms" component={TermsAndConditions} />
                <Route path="/accessibility" component={AccessibilityStatement} />
                <Route path="/setup-wizard" component={SetupWizard} />
                <Route path="/onboarding" component={OnboardingDashboard} />
                <Route path="/onboarding/new" component={EnhancedOnboardingForm} />
                <Route path="/onboarding/enhanced" component={EnhancedOnboardingForm} />
                <Route path="/onboarding/original" component={ComprehensiveOnboardingForm} />
                <Route path="/onboarding/:id" component={OnboardingDetails} />
                <Route path="/sales/command-center" component={SalesCommandCenter} />
                <Route component={NotFound} />
              </Switch>
            </RoutePermissionGate>
          </PageErrorBoundary>
        </main>
      </React.Suspense>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionGuard>
          <AccessibilityProvider>
            <LiveRegionProvider>
              <TooltipProvider>
                <PWAProvider>
                  <SEOProvider>
                    <SkipNavigation />
                    <Toaster />
                    <CookieConsent />
                    <ErrorBoundary
                      level="critical"
                      onError={(error, errorInfo) => {
                        // Log to console in development, send to monitoring in production
                        console.error('[App Error Boundary]', error, errorInfo);
                      }}
                    >
                      <React.Suspense
                        fallback={
                          <div
                            className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
                            role="status"
                            aria-busy="true"
                            aria-label="Loading application"
                          >
                            <div className="text-center">
                              <div
                                className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"
                                aria-hidden="true"
                              />
                              <p className="mt-4 text-gray-600">Loading...</p>
                            </div>
                          </div>
                        }
                      >
                        <Router />
                      </React.Suspense>
                    </ErrorBoundary>
                  </SEOProvider>
                </PWAProvider>
              </TooltipProvider>
            </LiveRegionProvider>
          </AccessibilityProvider>
        </SessionGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
