import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useLocation } from "wouter";
import { useSeo } from "@/lib/useSeo";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
const Homepage = React.lazy(() => import("@/pages/marketing/Homepage"));
const CopierDealerCRM = React.lazy(() => import("@/pages/marketing/CopierDealerCRM"));
const PrintServiceDispatchMobile = React.lazy(() => import("@/pages/marketing/PrintServiceDispatchMobile"));
const CanonMasterProductCatalog = React.lazy(() => import("@/pages/marketing/CanonMasterProductCatalog"));
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import CRMEnhanced from "@/pages/CRMEnhanced";
import LeadDetail from "@/pages/LeadDetail";
import SalesReports from "@/pages/placeholder/SalesReports";
import ServiceReports from "@/pages/placeholder/ServiceReports";
import RevenueReports from "@/pages/placeholder/RevenueReports";
import Contracts from "@/pages/contracts";
const ServiceDispatchOptimization = React.lazy(() => import("@/pages/ServiceDispatchOptimization"));
import Inventory from "@/pages/inventory";
import Billing from "@/pages/billing";
import Reports from "@/pages/Reports";
import MeterReadings from "@/pages/MeterReadings";
import ProductModels from "@/pages/ProductModels";
import ProductAccessories from "@/pages/ProductAccessories";
import EnhancedProductAccessories from "@/pages/EnhancedProductAccessories";
import ProfessionalServices from "@/pages/ProfessionalServices";
import ServiceProducts from "@/pages/ServiceProducts";
import SoftwareProducts from "@/pages/SoftwareProducts";
import Supplies from "@/pages/Supplies";
import ManagedServices from "@/pages/ManagedServices";
const Invoices = React.lazy(() => import("@/pages/Invoices"));
import CompanyContacts from "@/pages/CompanyContacts";
import Vendors from "@/pages/Vendors";
import AccountsPayable from "@/pages/AccountsPayable";
import AccountsReceivable from "@/pages/AccountsReceivable";
import ChartOfAccounts from "@/pages/ChartOfAccounts";
import JournalEntries from "@/pages/JournalEntries";
import MeterBilling from "@/pages/MeterBilling";
import AdvancedReporting from "@/pages/AdvancedReporting";
import MobileOptimization from "@/pages/MobileOptimization";
import PerformanceMonitoring from "@/pages/PerformanceMonitoring";
import SystemIntegrations from "@/pages/SystemIntegrations";
import DeploymentReadiness from "@/pages/DeploymentReadiness";
import TaskManagement from "@/pages/TaskManagement";
import BasicTaskManagement from "@/pages/BasicTaskManagement";
import DealsManagement from "@/pages/DealsManagement";
import ProductHub from "@/pages/ProductHub";
import EquipmentLifecycle from "@/pages/EquipmentLifecycle";
import PurchaseOrders from "@/pages/PurchaseOrders";
import WarehouseOperations from "@/pages/WarehouseOperations";
import CrmGoalsDashboard from "@/pages/CrmGoalsDashboard";
const MobileFieldService = React.lazy(() => import("@/pages/MobileFieldService"));
import ProductManagementHub from "@/pages/ProductManagementHub";
import PricingManagement from "@/pages/PricingManagement";
import Contacts from "@/pages/Contacts";
import CustomerDetail from "@/pages/CustomerDetail";
import BusinessRecords from "@/pages/BusinessRecords";
import TenantSetup from "@/pages/TenantSetup";
import Settings from "@/pages/Settings";
import DataEnrichment from "@/pages/DataEnrichment";
import QuickBooksIntegration from "@/pages/QuickBooksIntegration";
import ManufacturerIntegration from "@/pages/ManufacturerIntegration";
import ManufacturerIntegrationDevices from "@/pages/ManufacturerIntegrationDevices";
import ManufacturerIntegrationAudit from "@/pages/ManufacturerIntegrationAudit";
import EndUserLicenseAgreement from "@/pages/legal/EndUserLicenseAgreement";
import PrivacyPolicy from "@/pages/legal/PrivacyPolicy";
import TermsAndConditions from "@/pages/legal/TermsAndConditions";
import LeadsManagement from "@/pages/LeadsManagement";
import QuoteProposalGeneration from "@/pages/QuoteProposalGeneration";
import QuoteBuilderPage from "@/pages/QuoteBuilderPage";
const ProductCatalogOptimization = React.lazy(() => import("@/pages/ProductCatalogOptimization"));
const DealsManagementOptimization = React.lazy(() => import("@/pages/DealsManagementOptimization"));
const PurchaseOrdersOptimization = React.lazy(() => import("@/pages/PurchaseOrdersOptimization"));
const QuoteBuilderOptimization = React.lazy(() => import("@/pages/QuoteBuilderOptimization"));
const TaskManagementOptimization = React.lazy(() => import("@/pages/TaskManagementOptimization"));
const QuotesManagementOptimization = React.lazy(() => import("@/pages/QuotesManagementOptimization"));
const QuoteProposalGenerationOptimization = React.lazy(() => import("@/pages/QuoteProposalGenerationOptimization"));
import QuotesManagement from "@/pages/QuotesManagement";
import CompanyIdsTest from "@/pages/CompanyIdsTest";
import QuoteView from "@/pages/QuoteView";
const ProposalBuilder = React.lazy(() => import("@/pages/ProposalBuilder"));
import PreventiveMaintenanceScheduling from "@/pages/PreventiveMaintenanceScheduling";
import CustomerSelfServicePortal from "@/pages/CustomerSelfServicePortal";
import AdvancedBillingEngine from "@/pages/AdvancedBillingEngine";
const ProductCatalog = React.lazy(() => import("@/pages/ProductCatalog"));
import VendorManagement from "@/pages/VendorManagement";
import CustomerNumberSettings from "@/pages/CustomerNumberSettings";
import FinancialForecasting from "@/pages/FinancialForecasting";
import EquipmentLifecycleManagement from "@/pages/EquipmentLifecycleManagement";
import CommissionManagement from "@/pages/CommissionManagement";
import ServiceAnalytics from "@/pages/ServiceAnalytics";
import MobileFieldOperations from "@/pages/MobileFieldOperations";
import RemoteMonitoring from "@/pages/RemoteMonitoring";
import DemoScheduling from "@/pages/DemoScheduling";
import SocialMediaGenerator from "@/pages/SocialMediaGenerator";
import SecurityManagement from "@/pages/SecurityManagement";
import SystemMonitoring from "@/pages/SystemMonitoring";
import AccessControl from "@/pages/AccessControl";
import RootAdminDashboard from "@/pages/RootAdminDashboard";
import RootAdminSEO from "@/pages/RootAdminSEO";
import PlatformConfiguration from "@/pages/PlatformConfiguration";
import DatabaseManagement from "@/pages/DatabaseManagement";
import SalesPipelineForecasting from "@/pages/SalesPipelineForecasting";
import SalesPipelineWorkflow from "@/pages/SalesPipelineWorkflow";
import SalesCommandCenter from "@/pages/SalesCommandCenter";
import AdvancedAnalytics from "@/pages/AdvancedAnalytics";

import ESignatureIntegration from "@/pages/ESignatureIntegration";
import PreventiveMaintenanceAutomation from "@/pages/PreventiveMaintenanceAutomation";
import CustomerSuccessManagement from "@/pages/CustomerSuccessManagement";
import DocumentManagement from "@/pages/DocumentManagement";
import MobileServiceApp from "@/pages/MobileServiceApp";
import AdvancedAnalyticsDashboard from "@/pages/AdvancedAnalyticsDashboard";
import BusinessProcessOptimization from "@/pages/BusinessProcessOptimization";
import SecurityCompliance from "@/pages/SecurityCompliance";
import SecurityComplianceManagement from "@/pages/SecurityComplianceManagement";
import IncidentResponseSystem from "@/pages/IncidentResponseSystem";
import AIAnalyticsDashboard from "@/pages/AIAnalyticsDashboard";
import IntegrationHub from "@/pages/IntegrationHub";
import WorkflowAutomation from "@/pages/WorkflowAutomation";
import PredictiveAnalytics from "@/pages/PredictiveAnalytics";
import ERPIntegration from "@/pages/ERPIntegration";
import CustomerAccessManagement from "@/pages/CustomerAccessManagement";
const ServiceHub = React.lazy(() => import("@/pages/ServiceHub"));
import OnboardingDashboard from "@/pages/OnboardingDashboard";
import OnboardingDetails from "@/pages/OnboardingDetails";
import EnhancedOnboardingForm from "@/pages/EnhancedOnboardingForm";
import ComprehensiveOnboardingForm from "@/pages/ComprehensiveOnboardingForm";
import RoleManagement from "@/pages/RoleManagement";
import GPT5Dashboard from "@/pages/GPT5Dashboard";
import DocumentBuilder from "@/pages/DocumentBuilder";
import TechnicianManagement from "@/pages/TechnicianManagement";
import VehicleManagement from "@/pages/VehicleManagement";
import AssetManagement from "@/pages/AssetManagement";

// Platform Admin Pages
import RootAdminSecurity from "@/pages/admin/RootAdminSecurity";
import SystemSecurity from "@/pages/admin/SystemSecurity";
import DatabaseUpdaterPage from "@/pages/admin/DatabaseUpdaterPage";
import TenantManagement from "@/pages/admin/TenantManagement";
import UserManagement from "@/pages/admin/UserManagement";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [pathname] = useLocation();
  useSeo(pathname);
  React.useEffect(() => {
    if (isAuthenticated) {
      // Temporarily disable prefetching to avoid 401 errors
      // queryClient.prefetchQuery({ queryKey: ["/api/tasks"] });
      queryClient.prefetchQuery({ queryKey: ["/api/customers"] });
      queryClient.prefetchQuery({ queryKey: ["/api/service-tickets"] });
    }
  }, [isAuthenticated]);

  return (
    <Switch>
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading Printyx...</p>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/eula" component={EndUserLicenseAgreement} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsAndConditions} />
          <Route path="/" component={Homepage} />
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
          <Route path="/document-builder" component={DocumentBuilder} />
          <Route path="/meter-readings" component={MeterReadings} />
          <Route path="/invoices" component={Invoices} />
          <Route
            path="/service-dispatch"
            component={ServiceDispatchOptimization}
          />
          <Route
            path="/service-dispatch-optimization"
            component={ServiceDispatchOptimization}
          />
          <Route path="/technician-management" component={TechnicianManagement} />
          <Route path="/vehicle-management" component={VehicleManagement} />
          <Route path="/asset-management" component={AssetManagement} />
          <Route path="/mobile-field-service" component={MobileFieldService} />
          <Route path="/product-catalog" component={ProductCatalog} />
          <Route
            path="/product-catalog-optimization"
            component={ProductCatalogOptimization}
          />
          <Route
            path="/deals-management-optimization"
            component={DealsManagementOptimization}
          />
          <Route
            path="/purchase-orders-optimization"
            component={PurchaseOrdersOptimization}
          />
          <Route
            path="/quote-builder-optimization"
            component={QuoteBuilderOptimization}
          />
          <Route
            path="/task-management-optimization"
            component={TaskManagementOptimization}
          />
          <Route
            path="/quotes-management-optimization"
            component={QuotesManagementOptimization}
          />
          <Route
            path="/quote-proposal-generation-optimization"
            component={QuoteProposalGenerationOptimization}
          />
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
          <Route
            path="/service-dispatch-optimization"
            component={ServiceDispatchOptimization}
          />
          <Route path="/service-hub" component={ServiceHub} />
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
