import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Homepage from "@/pages/marketing/Homepage";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import CRMEnhanced from "@/pages/CRMEnhanced";
import LeadDetail from "@/pages/LeadDetail";
import SalesReports from "@/pages/placeholder/SalesReports";
import ServiceReports from "@/pages/placeholder/ServiceReports";
import RevenueReports from "@/pages/placeholder/RevenueReports";
import Contracts from "@/pages/contracts";
import ServiceDispatchOptimization from "@/pages/ServiceDispatchOptimization";
import Inventory from "@/pages/inventory";
import Billing from "@/pages/billing";
import Reports from "@/pages/reports";
import MeterReadings from "@/pages/MeterReadings";
import ProductModels from "@/pages/ProductModels";
import ProductAccessories from "@/pages/ProductAccessories";
import ProfessionalServices from "@/pages/ProfessionalServices";
import ServiceProducts from "@/pages/ServiceProducts";
import SoftwareProducts from "@/pages/SoftwareProducts";
import Supplies from "@/pages/Supplies";
import ManagedServices from "@/pages/ManagedServices";
import Invoices from "@/pages/Invoices";
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
import MobileFieldService from "@/pages/MobileFieldService";
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
import QuotesManagement from "@/pages/QuotesManagement";
import QuoteView from "@/pages/QuoteView";
import PreventiveMaintenanceScheduling from "@/pages/PreventiveMaintenanceScheduling";
import CustomerSelfServicePortal from "@/pages/CustomerSelfServicePortal";
import AdvancedBillingEngine from "@/pages/AdvancedBillingEngine";
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
import PlatformConfiguration from "@/pages/PlatformConfiguration";
import DatabaseManagement from "@/pages/DatabaseManagement";
import SalesPipelineForecasting from "@/pages/SalesPipelineForecasting";
import SalesPipelineWorkflow from "@/pages/SalesPipelineWorkflow";
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

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

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
          <Route component={Homepage} />
        </Switch>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/customers" component={Customers} />
          <Route path="/customers/:id" component={CustomerDetail} />
          <Route path="/crm" component={CRMEnhanced} />
          <Route path="/crm-enhanced" component={CRMEnhanced} />
          <Route path="/business-records" component={BusinessRecords} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/deals" component={DealsManagement} />
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
          <Route path="/leads/:id" component={LeadDetail} />
          <Route
            path="/companies/:companyId/contacts"
            component={CompanyContacts}
          />
          <Route path="/company-contacts" component={CompanyContacts} />
          <Route path="/sales-reports" component={SalesReports} />
          <Route path="/service-reports" component={ServiceReports} />
          <Route path="/revenue-reports" component={RevenueReports} />
          <Route path="/contracts" component={Contracts} />
          <Route path="/meter-readings" component={MeterReadings} />
          <Route path="/invoices" component={Invoices} />
          <Route
            path="/service-dispatch"
            component={ServiceDispatchOptimization}
          />
          <Route path="/mobile-field-service" component={MobileFieldService} />
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
          <Route path="/product-accessories" component={ProductAccessories} />
          <Route
            path="/admin/product-accessories"
            component={ProductAccessories}
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
          <Route path="/workflow-automation" component={WorkflowAutomation} />
          <Route path="/mobile-optimization" component={MobileOptimization} />
          <Route
            path="/performance-monitoring"
            component={PerformanceMonitoring}
          />
          <Route path="/system-integrations" component={SystemIntegrations} />
          <Route path="/deployment-readiness" component={DeploymentReadiness} />
          <Route path="/task-management" component={TaskManagement} />
          <Route path="/basic-tasks" component={BasicTaskManagement} />
          <Route path="/pricing-management" component={PricingManagement} />
          <Route
            path="/admin/pricing-management"
            component={PricingManagement}
          />
          <Route path="/tenant-setup" component={TenantSetup} />
          <Route path="/settings" component={Settings} />
          <Route path="/customer-number-settings" component={CustomerNumberSettings} />
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
          <Route path="/workflow-automation" component={WorkflowAutomation} />
          <Route
            path="/social-media-generator"
            component={SocialMediaGenerator}
          />
          <Route path="/security-management" component={SecurityManagement} />
          <Route path="/system-monitoring" component={SystemMonitoring} />
          <Route path="/access-control" component={AccessControl} />
          <Route path="/root-admin-dashboard" component={RootAdminDashboard} />
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
          <Route path="/manufacturer-integration" component={ManufacturerIntegration} />
          <Route path="/manufacturer-integration/devices" component={ManufacturerIntegrationDevices} />
          <Route path="/manufacturer-integration/audit" component={ManufacturerIntegrationAudit} />
          <Route path="/eula" component={EndUserLicenseAgreement} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsAndConditions} />
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
