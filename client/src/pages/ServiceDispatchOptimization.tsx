import { MainLayout } from '@/components/layout/main-layout';
import { ComingSoon } from '@/components/ui/coming-soon';
import { Navigation } from 'lucide-react';

/**
 * AUDIT-015 — gated.
 *
 * This page is registered at /service-dispatch, so it is user-facing. It previously
 * rendered ~1,070 lines of fixtures: mockMetrics, mockTechnicians (invented names and
 * NYC coordinates — for a business with no stated NYC presence), mockRoutes and
 * mockAlerts. It imported useQuery/useMutation/useQueryClient and then never called
 * any of them; there was not a single apiRequest on the page. Every number, every
 * technician pin on the map and every "alert" was fabricated, and presented as live
 * operational data.
 *
 * Nothing backs it: there is no service-dispatch edge function, and the optimization/
 * routing/technician-tracking data it displays has no endpoint anywhere. (AUDIT-014's
 * navigation sweep independently flagged this page as entirely hardcoded.) So per
 * AUDIT-015's own rule it is gated rather than faked.
 *
 * NOT to be confused with the REAL, working service surfaces: /service-hub
 * (routes-mobile-api.ts GET /api/service-tickets) and /service-dispatch-optimization's
 * sibling predictive endpoints. Only this page's contents were fiction.
 *
 * To restore: `git log --follow` this path once there is a dispatch/routing API.
 */
export default function ServiceDispatchOptimization() {
  return (
    <MainLayout
      title="Service Dispatch"
      description="AI-powered route optimization and real-time technician tracking"
    >
      <ComingSoon
        title="Service Dispatch Optimization"
        description="AI-powered route optimization and real-time technician tracking."
        icon={Navigation}
        storyIds={['AUDIT-015']}
        capabilities={[
          'Live technician locations and status',
          'Optimized multi-stop routes with drive-time estimates',
          'Dispatch alerts (SLA risk, idle technicians, route conflicts)',
          'Fleet utilization and response-time metrics',
        ]}
        note="Gated because no dispatch/routing backend exists yet. The previous version of this page displayed invented technicians, routes and alerts as if they were live. For real service data see Service Hub."
      />
    </MainLayout>
  );
}
