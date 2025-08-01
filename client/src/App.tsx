import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import CRMEnhanced from "@/pages/CRMEnhanced";
import Contracts from "@/pages/contracts";
import ServiceDispatchEnhanced from "@/pages/ServiceDispatchEnhanced";
import Inventory from "@/pages/inventory";
import Billing from "@/pages/billing";
import Reports from "@/pages/reports";
import MeterReadings from "@/pages/MeterReadings";
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
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/customers" component={Customers} />
          <Route path="/crm" component={CRMEnhanced} />
          <Route path="/contracts" component={Contracts} />
          <Route path="/meter-readings" component={MeterReadings} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/service-dispatch" component={ServiceDispatchEnhanced} />
          <Route path="/inventory" component={Inventory} />
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
