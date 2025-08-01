import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import MetricsCards from "@/components/dashboard/metrics-cards";
import ServiceTickets from "@/components/dashboard/service-tickets";
import QuickActions from "@/components/dashboard/quick-actions";
import Alerts from "@/components/dashboard/alerts";
import RevenueChart from "@/components/dashboard/revenue-chart";
import TopCustomers from "@/components/dashboard/top-customers";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout title="Dashboard" description="Overview of your business metrics and activities">
      <MetricsCards />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <ServiceTickets />
        </div>
        
        <div className="space-y-4 sm:space-y-6">
          <QuickActions />
          <Alerts />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <RevenueChart />
        <TopCustomers />
      </div>
    </MainLayout>
  );
}
