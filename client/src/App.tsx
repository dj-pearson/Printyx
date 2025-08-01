import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Homepage from "@/pages/marketing/Homepage";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import CRMEnhanced from "@/pages/CRMEnhanced";
import LeadDetail from "@/pages/LeadDetail";
import SalesReports from "@/pages/placeholder/SalesReports";
import ServiceReports from "@/pages/placeholder/ServiceReports";
import RevenueReports from "@/pages/placeholder/RevenueReports";
import Contracts from "@/pages/contracts";
import ServiceDispatchEnhanced from "@/pages/ServiceDispatchEnhanced";
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
import WorkflowAutomation from "@/pages/WorkflowAutomation";

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
          <Route path="/" component={Homepage} />
          <Route component={Homepage} />
        </Switch>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/customers" component={Customers} />
          <Route path="/crm" component={CRMEnhanced} />
          <Route path="/leads/:id" component={LeadDetail} />
          <Route path="/companies/:companyId/contacts" component={CompanyContacts} />
          <Route path="/sales-reports" component={SalesReports} />
          <Route path="/service-reports" component={ServiceReports} />
          <Route path="/revenue-reports" component={RevenueReports} />
          <Route path="/contracts" component={Contracts} />
          <Route path="/meter-readings" component={MeterReadings} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/service-dispatch" component={ServiceDispatchEnhanced} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/product-models" component={ProductModels} />
          <Route path="/product-accessories" component={ProductAccessories} />
          <Route path="/professional-services" component={ProfessionalServices} />
          <Route path="/service-products" component={ServiceProducts} />
          <Route path="/software-products" component={SoftwareProducts} />
          <Route path="/supplies" component={Supplies} />
          <Route path="/managed-services" component={ManagedServices} />
          <Route path="/billing" component={MeterBilling} />
          <Route path="/vendors" component={Vendors} />
          <Route path="/accounts-payable" component={AccountsPayable} />
          <Route path="/accounts-receivable" component={AccountsReceivable} />
          <Route path="/chart-of-accounts" component={ChartOfAccounts} />
          <Route path="/journal-entries" component={JournalEntries} />
          <Route path="/reports" component={Reports} />
          <Route path="/advanced-reporting" component={AdvancedReporting} />
          <Route path="/workflow-automation" component={WorkflowAutomation} />
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
