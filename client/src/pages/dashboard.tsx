import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import ModularDashboard from "@/components/ModularDashboard";
import { DashboardSkeleton } from "@/components/ui/skeletons";

console.log("📊 Dashboard module loading...");

export default function Dashboard() {
  console.log("📊 Dashboard component rendering");
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  console.log("📊 Dashboard auth state:", { isAuthenticated, isLoading });

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
      <MainLayout title="Dashboard" description="Role-based metrics and business insights">
        <div className="p-4 sm:p-6 lg:p-8">
          <DashboardSkeleton />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dashboard" description="Role-based metrics and business insights">
      <ModularDashboard />
    </MainLayout>
  );
}
