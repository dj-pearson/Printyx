import MainLayout from '@/components/layout/main-layout';
import { RoleBasedDashboard } from '@/components/dashboards/RoleBasedDashboard';

export default function Dashboard() {
  return (
    <MainLayout title="Dashboard" description="Role-based metrics and business insights">
      <RoleBasedDashboard />
    </MainLayout>
  );
}
