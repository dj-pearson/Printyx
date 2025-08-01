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
import Invoices from "@/pages/Invoices";

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
          <Route path="/billing" component={Billing} />
          <Route path="/reports" component={Reports} />
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
