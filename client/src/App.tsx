import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useLocation } from "wouter";
import { useSeo } from "@/lib/useSeo";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { useAuth } from "@/hooks/useAuth";
// Critical auth pages - keep eager for fast initial load
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Signup from "@/pages/Signup";
import VerifyEmail from "@/pages/VerifyEmail";
import EndUserLicenseAgreement from "@/pages/legal/EndUserLicenseAgreement";
import PrivacyPolicy from "@/pages/legal/PrivacyPolicy";
import TermsAndConditions from "@/pages/legal/TermsAndConditions";

// Marketing pages - lazy load
const Homepage = React.lazy(() => import("@/pages/marketing/Homepage"));
const CopierDealerCRM = React.lazy(() => import("@/pages/marketing/CopierDealerCRM"));
const PrintServiceDispatchMobile = React.lazy(() => import("@/pages/marketing/PrintServiceDispatchMobile"));
const CanonMasterProductCatalog = React.lazy(() => import("@/pages/marketing/CanonMasterProductCatalog"));

// Strategic landing pages
const PredictiveIntelligence = React.lazy(() => import("@/pages/marketing/PredictiveIntelligence"));
const ModernArchitecture = React.lazy(() => import("@/pages/marketing/ModernArchitecture"));
const IntegrationMarketplace = React.lazy(() => import("@/pages/marketing/IntegrationMarketplace"));
const DealerExpertise = React.lazy(() => import("@/pages/marketing/DealerExpertise"));

// Blog pages
const BlogIndex = React.lazy(() => import("@/pages/blog/index"));
const AIPredictiveMaintenanceBlog = React.lazy(() => import("@/pages/blog/ai-predictive-maintenance-vs-reactive-service"));
const EAutomateVsModernBlog = React.lazy(() => import("@/pages/blog/e-automate-vs-modern-cloud-platforms"));
const DynamicPricingAIBlog = React.lazy(() => import("@/pages/blog/dynamic-pricing-ai-copier-dealers"));

// Conversion pages
const ROICalculator = React.lazy(() => import("@/pages/marketing/ROICalculator"));
const CaseStudies = React.lazy(() => import("@/pages/marketing/CaseStudies"));

// Core app pages - lazy load everything for optimal bundle splitting
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const Customers = React.lazy(() => import("@/pages/customers"));
const CRMEnhanced = React.lazy(() => import("@/pages/CRMEnhanced"));
const LeadDetail = React.lazy(() => import("@/pages/LeadDetail"));
const SalesReports = React.lazy(() => import("@/pages/placeholder/SalesReports"));
const ServiceReports = React.lazy(() => import("@/pages/placeholder/ServiceReports"));
const RevenueReports = React.lazy(() => import("@/pages/placeholder/RevenueReports"));
const Contracts = React.lazy(() => import("@/pages/contracts"));
const ContractRenewalDashboard = React.lazy(() => import("@/pages/ContractRenewalDashboard"));
const ProactiveServiceDashboard = React.lazy(() => import("@/pages/ProactiveServiceDashboard"));
const ServiceDispatchOptimization = React.lazy(() => import("@/pages/ServiceDispatchOptimization"));
const Inventory = React.lazy(() => import("@/pages/inventory"));
const Billing = React.lazy(() => import("@/pages/billing"));
const Reports = React.lazy(() => import("@/pages/Reports"));
const MeterReadings = React.lazy(() => import("@/pages/MeterReadings"));
const ProductModels = React.lazy(() => import("@/pages/ProductModels"));
const ProductAccessories = React.lazy(() => import("@/pages/ProductAccessories"));
const EnhancedProductAccessories = React.lazy(() => import("@/pages/EnhancedProductAccessories"));
const ProfessionalServices = React.lazy(() => import("@/pages/ProfessionalServices"));
const ServiceProducts = React.lazy(() => import("@/pages/ServiceProducts"));
const SoftwareProducts = React.lazy(() => import("@/pages/SoftwareProducts"));
const Supplies = React.lazy(() => import("@/pages/Supplies"));
const ManagedServices = React.lazy(() => import("@/pages/ManagedServices"));
const Invoices = React.lazy(() => import("@/pages/Invoices"));
const CompanyContacts = React.lazy(() => import("@/pages/CompanyContacts"));
const Vendors = React.lazy(() => import("@/pages/Vendors"));
const AccountsPayable = React.lazy(() => import("@/pages/AccountsPayable"));
const AccountsReceivable = React.lazy(() => import("@/pages/AccountsReceivable"));
const ChartOfAccounts = React.lazy(() => import("@/pages/ChartOfAccounts"));
const JournalEntries = React.lazy(() => import("@/pages/JournalEntries"));
const MeterBilling = React.lazy(() => import("@/pages/MeterBilling"));
const AdvancedReporting = React.lazy(() => import("@/pages/AdvancedReporting"));
const MobileOptimization = React.lazy(() => import("@/pages/MobileOptimization"));
const PerformanceMonitoring = React.lazy(() => import("@/pages/PerformanceMonitoring"));
const SystemIntegrations = React.lazy(() => import("@/pages/SystemIntegrations"));
const DeploymentReadiness = React.lazy(() => import("@/pages/DeploymentReadiness"));
const TaskManagement = React.lazy(() => import("@/pages/TaskManagement"));
const BasicTaskManagement = React.lazy(() => import("@/pages/BasicTaskManagement"));
const DealsManagement = React.lazy(() => import("@/pages/DealsManagement"));
const ProductHub = React.lazy(() => import("@/pages/ProductHub"));
const EquipmentLifecycle = React.lazy(() => import("@/pages/EquipmentLifecycle"));
const PurchaseOrders = React.lazy(() => import("@/pages/PurchaseOrders"));
const WarehouseOperations = React.lazy(() => import("@/pages/WarehouseOperations"));
const CrmGoalsDashboard = React.lazy(() => import("@/pages/CrmGoalsDashboard"));
const MobileFieldService = React.lazy(() => import("@/pages/MobileFieldService"));
const ProductManagementHub = React.lazy(() => import("@/pages/ProductManagementHub"));
const PricingManagement = React.lazy(() => import("@/pages/PricingManagement"));
const Contacts = React.lazy(() => import("@/pages/Contacts"));
const CustomerDetail = React.lazy(() => import("@/pages/CustomerDetail"));
const BusinessRecords = React.lazy(() => import("@/pages/BusinessRecords"));
const TenantSetup = React.lazy(() => import("@/pages/TenantSetup"));
const Settings = React.lazy(() => import("@/pages/Settings"));
const Pricing = React.lazy(() => import("@/pages/Pricing"));
const SubscriptionSettings = React.lazy(() => import("@/pages/SubscriptionSettings"));
const BillingPage = React.lazy(() => import("@/pages/Billing"));
const DataEnrichment = React.lazy(() => import("@/pages/DataEnrichment"));
const QuickBooksIntegration = React.lazy(() => import("@/pages/QuickBooksIntegration"));
const ManufacturerIntegration = React.lazy(() => import("@/pages/ManufacturerIntegration"));
const ManufacturerIntegrationDevices = React.lazy(() => import("@/pages/ManufacturerIntegrationDevices"));
const ManufacturerIntegrationAudit = React.lazy(() => import("@/pages/ManufacturerIntegrationAudit"));
const LeadsManagement = React.lazy(() => import("@/pages/LeadsManagement"));
const QuoteProposalGeneration = React.lazy(() => import("@/pages/QuoteProposalGeneration"));
const QuoteBuilderPage = React.lazy(() => import("@/pages/QuoteBuilderPage"));
const QuotesManagement = React.lazy(() => import("@/pages/QuotesManagement"));
const CompanyIdsTest = React.lazy(() => import("@/pages/CompanyIdsTest"));
const QuoteView = React.lazy(() => import("@/pages/QuoteView"));
const ProposalBuilder = React.lazy(() => import("@/pages/ProposalBuilder"));
const PreventiveMaintenanceScheduling = React.lazy(() => import("@/pages/PreventiveMaintenanceScheduling"));
const CustomerSelfServicePortal = React.lazy(() => import("@/pages/CustomerSelfServicePortal"));
const AdvancedBillingEngine = React.lazy(() => import("@/pages/AdvancedBillingEngine"));
const ProductCatalog = React.lazy(() => import("@/pages/ProductCatalog"));
const VendorManagement = React.lazy(() => import("@/pages/VendorManagement"));
const CustomerNumberSettings = React.lazy(() => import("@/pages/CustomerNumberSettings"));
const FinancialForecasting = React.lazy(() => import("@/pages/FinancialForecasting"));
const EquipmentLifecycleManagement = React.lazy(() => import("@/pages/EquipmentLifecycleManagement"));
const CommissionManagement = React.lazy(() => import("@/pages/CommissionManagement"));
const ServiceAnalytics = React.lazy(() => import("@/pages/ServiceAnalytics"));
const MobileFieldOperations = React.lazy(() => import("@/pages/MobileFieldOperations"));
const RemoteMonitoring = React.lazy(() => import("@/pages/RemoteMonitoring"));
const FleetMonitoringDashboard = React.lazy(() => import("@/pages/FleetMonitoringDashboard"));
const DemoScheduling = React.lazy(() => import("@/pages/DemoScheduling"));
const SocialMediaGenerator = React.lazy(() => import("@/pages/SocialMediaGenerator"));
const SecurityManagement = React.lazy(() => import("@/pages/SecurityManagement"));
const SystemMonitoring = React.lazy(() => import("@/pages/SystemMonitoring"));
const AccessControl = React.lazy(() => import("@/pages/AccessControl"));
const RootAdminDashboard = React.lazy(() => import("@/pages/RootAdminDashboard"));
const RootAdminSEO = React.lazy(() => import("@/pages/RootAdminSEO"));
const SEODashboard = React.lazy(() => import("@/pages/SEODashboard"));
const PlatformConfiguration = React.lazy(() => import("@/pages/PlatformConfiguration"));
const DatabaseManagement = React.lazy(() => import("@/pages/DatabaseManagement"));
const SalesPipelineForecasting = React.lazy(() => import("@/pages/SalesPipelineForecasting"));
const SalesPipelineWorkflow = React.lazy(() => import("@/pages/SalesPipelineWorkflow"));
const SalesCommandCenter = React.lazy(() => import("@/pages/SalesCommandCenter"));
const AdvancedAnalytics = React.lazy(() => import("@/pages/AdvancedAnalytics"));
const ESignatureIntegration = React.lazy(() => import("@/pages/ESignatureIntegration"));
const PreventiveMaintenanceAutomation = React.lazy(() => import("@/pages/PreventiveMaintenanceAutomation"));
const CustomerSuccessManagement = React.lazy(() => import("@/pages/CustomerSuccessManagement"));
const DocumentManagement = React.lazy(() => import("@/pages/DocumentManagement"));
const MobileServiceApp = React.lazy(() => import("@/pages/MobileServiceApp"));
const AdvancedAnalyticsDashboard = React.lazy(() => import("@/pages/AdvancedAnalyticsDashboard"));
const BusinessProcessOptimization = React.lazy(() => import("@/pages/BusinessProcessOptimization"));
const SecurityCompliance = React.lazy(() => import("@/pages/SecurityCompliance"));
const SecurityComplianceManagement = React.lazy(() => import("@/pages/SecurityComplianceManagement"));
const IncidentResponseSystem = React.lazy(() => import("@/pages/IncidentResponseSystem"));
const AIAnalyticsDashboard = React.lazy(() => import("@/pages/AIAnalyticsDashboard"));
const IntegrationHub = React.lazy(() => import("@/pages/IntegrationHub"));
const WorkflowAutomation = React.lazy(() => import("@/pages/WorkflowAutomation"));
const PredictiveAnalytics = React.lazy(() => import("@/pages/PredictiveAnalytics"));
const ERPIntegration = React.lazy(() => import("@/pages/ERPIntegration"));
const CustomerAccessManagement = React.lazy(() => import("@/pages/CustomerAccessManagement"));
const ServiceHub = React.lazy(() => import("@/pages/ServiceHub"));
const ApolloLeadEnrichment = React.lazy(() => import("@/pages/ApolloLeadEnrichment"));
const OnboardingDashboard = React.lazy(() => import("@/pages/OnboardingDashboard"));
const OnboardingDetails = React.lazy(() => import("@/pages/OnboardingDetails"));
const EnhancedOnboardingForm = React.lazy(() => import("@/pages/EnhancedOnboardingForm"));
const ComprehensiveOnboardingForm = React.lazy(() => import("@/pages/ComprehensiveOnboardingForm"));
const RoleManagement = React.lazy(() => import("@/pages/RoleManagement"));
const GPT5Dashboard = React.lazy(() => import("@/pages/GPT5Dashboard"));
const DocumentBuilder = React.lazy(() => import("@/pages/DocumentBuilder"));
const TechnicianManagement = React.lazy(() => import("@/pages/TechnicianManagement"));
const VehicleManagement = React.lazy(() => import("@/pages/VehicleManagement"));
const AssetManagement = React.lazy(() => import("@/pages/AssetManagement"));

// AI Hub Pages
const AIHub = React.lazy(() => import("@/pages/AIHub"));
const AIEmployeeDashboard = React.lazy(() => import("@/pages/AIEmployeeDashboard"));
const CalendarPage = React.lazy(() => import("@/pages/CalendarPage"));
const MeetingTranscription = React.lazy(() => import("@/pages/MeetingTranscription"));
const AITaskScheduling = React.lazy(() => import("@/pages/AITaskScheduling"));
const AISearchKnowledgeDashboard = React.lazy(() => import("@/pages/AISearchKnowledgeDashboard"));
const ConversationalAIDashboard = React.lazy(() => import("@/pages/ConversationalAIDashboard"));

// Lease Management Pages
const Leases = React.lazy(() => import("@/pages/Leases"));
const LeaseDetail = React.lazy(() => import("@/pages/LeaseDetail"));
const LeaseForm = React.lazy(() => import("@/pages/LeaseForm"));

// Knowledge Base Pages
const KnowledgeBase = React.lazy(() => import("@/pages/KnowledgeBase"));
const KnowledgeArticle = React.lazy(() => import("@/pages/KnowledgeArticle"));

// Platform Admin Pages
const RootAdminSecurity = React.lazy(() => import("@/pages/admin/RootAdminSecurity"));
const SystemSecurity = React.lazy(() => import("@/pages/admin/SystemSecurity"));
const DatabaseUpdaterPage = React.lazy(() => import("@/pages/admin/DatabaseUpdaterPage"));
const TenantManagement = React.lazy(() => import("@/pages/admin/TenantManagement"));
const UserManagement = React.lazy(() => import("@/pages/admin/UserManagement"));

const LAST_ROUTE_KEY = "printyx_last_route";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [pathname, setLocation] = useLocation();
  useSeo(pathname);

  // Save current route to localStorage when authenticated
  React.useEffect(() => {
    if (isAuthenticated && pathname !== "/" && !pathname.startsWith("/login")) {
      try {
        localStorage.setItem(LAST_ROUTE_KEY, pathname);
      } catch (error) {
        console.error("Error saving route:", error);
      }
    }
  }, [pathname, isAuthenticated]);

  // Restore last route on authentication
  React.useEffect(() => {
    if (isAuthenticated && pathname === "/") {
      try {
        const lastRoute = localStorage.getItem(LAST_ROUTE_KEY);
        if (lastRoute && lastRoute !== "/" && lastRoute !== "/login") {
          setLocation(lastRoute);
        }
      } catch (error) {
        console.error("Error restoring route:", error);
      }
    }
  }, [isAuthenticated, pathname, setLocation]);

  // Removed eager prefetching for better performance
  // Data will be fetched when components mount, which is more efficient
  // and prevents unnecessary data fetching for pages the user might not visit

  return (
    <Switch>
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="text-center animate-fade-in">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading Printyx...</p>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/verify-email" component={VerifyEmail} />
          <Route path="/eula" component={EndUserLicenseAgreement} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsAndConditions} />
          <Route path="/" component={Homepage} />

          {/* Strategic landing pages */}
          <Route path="/predictive-intelligence" component={PredictiveIntelligence} />
          <Route path="/modern-architecture" component={ModernArchitecture} />
          <Route path="/integration-marketplace" component={IntegrationMarketplace} />
          <Route path="/dealer-expertise" component={DealerExpertise} />

          {/* Blog routes */}
          <Route path="/blog" component={BlogIndex} />
          <Route path="/blog/ai-predictive-maintenance-vs-reactive-service" component={AIPredictiveMaintenanceBlog} />
          <Route path="/blog/e-automate-vs-modern-cloud-platforms" component={EAutomateVsModernBlog} />
          <Route path="/blog/dynamic-pricing-ai-copier-dealers" component={DynamicPricingAIBlog} />

          {/* Conversion pages */}
          <Route path="/roi-calculator" component={ROICalculator} />
          <Route path="/case-studies" component={CaseStudies} />

          {/* Other marketing pages */}
          <Route path="/p/copier-dealer-crm" component={CopierDealerCRM} />
          <Route
            path="/p/print-service-dispatch-mobile"
            component={PrintServiceDispatchMobile}
          />
          <Route
            path="/p/master-product-catalog-canon-imagerunner"
            component={CanonMasterProductCatalog}
          />
          <Route component={Homepage} />
        </Switch>
      ) : (
        <>
          <SubscriptionBanner />
          <Route path="/" component={Dashboard} />
          <Route path="/customers" component={Customers} />
          <Route path="/customers/:slug" component={CustomerDetail} />
          <Route path="/leads/:slug" component={CustomerDetail} />
          <Route path="/crm" component={CRMEnhanced} />
          <Route path="/business-records" component={BusinessRecords} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/deals" component={DealsManagement} />
          <Route path="/opportunities" component={DealsManagement} />
          <Route path="/deals-management" component={DealsManagement} />
          <Route path="/leads-management" component={LeadsManagement} />
          <Route path="/product-hub" component={ProductHub} />
          <Route path="/admin/product-hub" component={ProductHub} />
          <Route path="/equipment-lifecycle" component={EquipmentLifecycle} />
          <Route
            path="/admin/equipment-lifecycle"
            component={EquipmentLifecycle}
          />
          <Route path="/purchase-orders" component={PurchaseOrders} />
          <Route path="/admin/purchase-orders" component={PurchaseOrders} />
          <Route path="/warehouse-operations" component={WarehouseOperations} />
          <Route path="/crm-goals" component={CrmGoalsDashboard} />
          <Route path="/crm-goals-dashboard" component={CrmGoalsDashboard} />
          <Route path="/data-enrichment" component={DataEnrichment} />
          <Route
            path="/quickbooks-integration"
            component={QuickBooksIntegration}
          />
          <Route
            path="/quote-proposal-generation"
            component={QuoteProposalGeneration}
          />
          <Route path="/quotes" component={QuotesManagement} />
          <Route path="/quotes/new" component={QuoteBuilderPage} />
          <Route path="/quotes/:quoteId" component={QuoteBuilderPage} />
          <Route path="/quotes/:quoteId/view" component={QuoteView} />
          <Route path="/proposal-builder" component={ProposalBuilder} />
          <Route
            path="/preventive-maintenance"
            component={PreventiveMaintenanceScheduling}
          />
          <Route
            path="/preventive-maintenance-scheduling"
            component={PreventiveMaintenanceScheduling}
          />
          <Route
            path="/incident-response-system"
            component={IncidentResponseSystem}
          />
          <Route
            path="/customer-portal"
            component={CustomerSelfServicePortal}
          />
          <Route path="/advanced-billing" component={AdvancedBillingEngine} />
          <Route
            path="/financial-forecasting"
            component={FinancialForecasting}
          />
          <Route
            path="/equipment-lifecycle"
            component={EquipmentLifecycleManagement}
          />
          <Route
            path="/equipment-lifecycle-management"
            component={EquipmentLifecycleManagement}
          />
          <Route
            path="/admin/equipment-lifecycle-management"
            component={EquipmentLifecycleManagement}
          />
          <Route
            path="/commission-management"
            component={CommissionManagement}
          />
          <Route path="/remote-monitoring" component={RemoteMonitoring} />
          <Route path="/fleet-monitoring" component={FleetMonitoringDashboard} />
          <Route path="/mobile-service" component={MobileServiceApp} />
          <Route path="/service-analytics" component={ServiceAnalytics} />
          <Route path="/workflow-automation" component={WorkflowAutomation} />
          <Route
            path="/mobile-field-operations"
            component={MobileFieldOperations}
          />
          <Route
            path="/admin/warehouse-operations"
            component={WarehouseOperations}
          />
          <Route path="/leads/:slug" component={LeadDetail} />
          <Route
            path="/companies/:companyId/contacts"
            component={CompanyContacts}
          />
          <Route path="/company-contacts" component={CompanyContacts} />
          <Route path="/sales-reports" component={SalesReports} />
          <Route path="/service-reports" component={ServiceReports} />
          <Route path="/revenue-reports" component={RevenueReports} />
          <Route path="/contracts" component={Contracts} />
          <Route path="/contract-renewals" component={ContractRenewalDashboard} />
          <Route path="/leases" component={Leases} />
          <Route path="/leases/new" component={LeaseForm} />
          <Route path="/leases/:id/edit" component={LeaseForm} />
          <Route path="/leases/:id" component={LeaseDetail} />
          <Route path="/document-builder" component={DocumentBuilder} />
          <Route path="/meter-readings" component={MeterReadings} />
          <Route path="/invoices" component={Invoices} />
          <Route
            path="/service-dispatch"
            component={ServiceDispatchOptimization}
          />
          <Route path="/proactive-service" component={ProactiveServiceDashboard} />
          <Route path="/technician-management" component={TechnicianManagement} />
          <Route path="/vehicle-management" component={VehicleManagement} />
          <Route path="/asset-management" component={AssetManagement} />
          <Route path="/mobile-field-service" component={MobileFieldService} />
          <Route path="/product-catalog" component={ProductCatalog} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/product-models" component={ProductModels} />
          <Route path="/admin/product-models" component={ProductModels} />
          <Route
            path="/product-management-hub"
            component={ProductManagementHub}
          />
          <Route
            path="/admin/product-management-hub"
            component={ProductManagementHub}
          />
          <Route path="/product-accessories" component={EnhancedProductAccessories} />
          <Route path="/enhanced-product-accessories" component={EnhancedProductAccessories} />
          <Route path="/product-accessories-legacy" component={ProductAccessories} />
          <Route
            path="/admin/product-accessories"
            component={EnhancedProductAccessories}
          />
          <Route
            path="/professional-services"
            component={ProfessionalServices}
          />
          <Route
            path="/admin/professional-services"
            component={ProfessionalServices}
          />
          <Route path="/service-products" component={ServiceProducts} />
          <Route path="/admin/service-products" component={ServiceProducts} />
          <Route path="/software-products" component={SoftwareProducts} />
          <Route path="/admin/software-products" component={SoftwareProducts} />
          <Route path="/supplies" component={Supplies} />
          <Route path="/admin/supplies" component={Supplies} />
          <Route path="/managed-services" component={ManagedServices} />
          <Route path="/admin/managed-services" component={ManagedServices} />
          <Route path="/billing" component={MeterBilling} />
          <Route path="/meter-billing" component={MeterBilling} />
          <Route
            path="/advanced-billing-engine"
            component={AdvancedBillingEngine}
          />
          <Route path="/vendor-management" component={VendorManagement} />
          <Route path="/admin/vendor-management" component={VendorManagement} />
          <Route path="/vendors" component={Vendors} />
          <Route path="/accounts-payable" component={AccountsPayable} />
          <Route path="/accounts-receivable" component={AccountsReceivable} />
          <Route path="/chart-of-accounts" component={ChartOfAccounts} />
          <Route path="/journal-entries" component={JournalEntries} />
          <Route path="/reports" component={Reports} />
          <Route path="/advanced-reporting" component={AdvancedReporting} />
          <Route path="/advanced-analytics" component={AdvancedAnalytics} />
          <Route path="/workflow-automation" component={WorkflowAutomation} />
          <Route path="/mobile-optimization" component={MobileOptimization} />
          <Route
            path="/performance-monitoring"
            component={PerformanceMonitoring}
          />
          <Route path="/system-integrations" component={SystemIntegrations} />
          <Route path="/deployment-readiness" component={DeploymentReadiness} />
          <Route path="/task-management" component={TaskManagement} />
          <Route
            path="/customer-success-management"
            component={CustomerSuccessManagement}
          />
          <Route path="/basic-tasks" component={BasicTaskManagement} />
          <Route path="/pricing-management" component={PricingManagement} />
          <Route
            path="/admin/pricing-management"
            component={PricingManagement}
          />
          <Route path="/tenant-setup" component={TenantSetup} />
          <Route path="/settings" component={Settings} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/settings/subscription" component={SubscriptionSettings} />
          <Route path="/settings/billing" component={BillingPage} />
          <Route path="/company-ids-test" component={CompanyIdsTest} />
          <Route
            path="/customer-number-settings"
            component={CustomerNumberSettings}
          />
          <Route path="/demo-scheduling" component={DemoScheduling} />
          <Route
            path="/sales-pipeline-forecasting"
            component={SalesPipelineForecasting}
          />

          <Route
            path="/sales-pipeline-workflow"
            component={SalesPipelineWorkflow}
          />
          <Route path="/sales-pipeline" component={SalesPipelineWorkflow} />
          <Route
            path="/esignature-integration"
            component={ESignatureIntegration}
          />
          <Route path="/service-hub" component={ServiceHub} />
          <Route path="/apollo-leads" component={ApolloLeadEnrichment} />
          <Route
            path="/preventive-maintenance-automation"
            component={PreventiveMaintenanceAutomation}
          />
          <Route
            path="/commission-management"
            component={CommissionManagement}
          />
          <Route
            path="/customer-success"
            component={CustomerSuccessManagement}
          />
          <Route path="/remote-monitoring" component={RemoteMonitoring} />
          <Route path="/document-management" component={DocumentManagement} />
          <Route path="/mobile-service-app" component={MobileServiceApp} />
          <Route
            path="/advanced-analytics"
            component={AdvancedAnalyticsDashboard}
          />
          <Route
            path="/advanced-analytics-dashboard"
            component={AdvancedAnalyticsDashboard}
          />
          <Route
            path="/business-process-optimization"
            component={BusinessProcessOptimization}
          />
          <Route path="/security-compliance" component={SecurityCompliance} />
          <Route
            path="/security-compliance-management"
            component={SecurityComplianceManagement}
          />
          <Route
            path="/customer-portal"
            component={CustomerSelfServicePortal}
          />
          <Route
            path="/customer-self-service-portal"
            component={CustomerSelfServicePortal}
          />
          <Route path="/incident-response" component={IncidentResponseSystem} />
          <Route path="/ai-analytics" component={AIAnalyticsDashboard} />
          <Route
            path="/ai-analytics-dashboard"
            component={AIAnalyticsDashboard}
          />
          <Route path="/predictive-analytics" component={PredictiveAnalytics} />
          <Route path="/integration-hub" component={IntegrationHub} />
          <Route path="/integrations" component={IntegrationHub} />
          <Route path="/workflow-automation" component={WorkflowAutomation} />
          <Route
            path="/social-media-generator"
            component={SocialMediaGenerator}
          />
          <Route path="/security-management" component={SecurityManagement} />
          <Route path="/system-monitoring" component={SystemMonitoring} />
          <Route path="/access-control" component={AccessControl} />
          <Route path="/role-management" component={RoleManagement} />
          <Route path="/gpt5-dashboard" component={GPT5Dashboard} />
          <Route path="/root-admin-dashboard" component={RootAdminDashboard} />
          <Route path="/root-admin/seo" component={RootAdminSEO} />
          <Route path="/seo" component={SEODashboard} />

          {/* Platform Admin Routes */}
          <Route path="/admin/root-admin-security" component={RootAdminSecurity} />
          <Route path="/admin/system-security" component={SystemSecurity} />
          <Route path="/admin/database-updater" component={DatabaseUpdaterPage} />
          <Route path="/admin/tenant-management" component={TenantManagement} />
          <Route path="/admin/user-management" component={UserManagement} />
          <Route path="/admin/role-management" component={RoleManagement} />
          <Route path="/admin/system-settings" component={Settings} />
          <Route path="/admin/platform-analytics" component={AdvancedAnalyticsDashboard} />
          <Route
            path="/platform-configuration"
            component={PlatformConfiguration}
          />
          <Route path="/database-management" component={DatabaseManagement} />
          <Route path="/erp-integration" component={ERPIntegration} />
          <Route
            path="/customer-access-management"
            component={CustomerAccessManagement}
          />
          <Route
            path="/manufacturer-integration"
            component={ManufacturerIntegration}
          />
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
          <Route path="/ai-task-scheduling" component={AITaskScheduling} />
          <Route path="/ai-search" component={AISearchKnowledgeDashboard} />
          <Route path="/conversational-ai-dashboard" component={ConversationalAIDashboard} />
          
          {/* Knowledge Base Routes */}
          <Route path="/knowledge-base" component={KnowledgeBase} />
          <Route path="/knowledge-base/article/:slug" component={KnowledgeArticle} />
          <Route path="/knowledge-base/category/:slug" component={KnowledgeBase} />
          
          <Route path="/eula" component={EndUserLicenseAgreement} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsAndConditions} />
          <Route path="/onboarding" component={OnboardingDashboard} />
          <Route path="/onboarding/new" component={EnhancedOnboardingForm} />
          <Route
            path="/onboarding/enhanced"
            component={EnhancedOnboardingForm}
          />
          <Route
            path="/onboarding/original"
            component={ComprehensiveOnboardingForm}
          />
          <Route path="/onboarding/:id" component={OnboardingDetails} />
          <Route path="/sales/command-center" component={SalesCommandCenter} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ErrorBoundary>
          <React.Suspense fallback={<div className="p-6">Loading…</div>}>
            <Router />
          </React.Suspense>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.error("Global error boundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-muted-foreground">
              Please refresh the page. If the problem persists, contact support.
            </p>
            <button
              className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}
