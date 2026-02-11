import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { RoleBasedDashboard } from '@/components/dashboards/RoleBasedDashboard';
import { DashboardSkeleton } from '@/components/ui/skeletons';

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: 'Unauthorized',
        description: 'You are logged out. Logging in again...',
        variant: 'destructive',
      });
      setTimeout(() => {
        window.location.href = '/login';
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
      <RoleBasedDashboard />
    </MainLayout>
  );
}
