import MainLayout from '@/components/layout/main-layout';
import { ComingSoon } from '@/components/ui/coming-soon';
import { Smartphone } from 'lucide-react';

/**
 * AUDIT-015 — gated.
 *
 * This page is registered at /mobile-optimization, so it is user-facing. It queried
 * /api/mobile/metrics and /api/mobile/devices — NEITHER of which exists — and then
 * silently fell back to `|| mockMetrics` / `|| mockDeviceBreakdown`. The failed query
 * was invisible: users saw a confident 95% offline capability, 88% battery
 * optimization, 0.02% crash rate and a 68/22/10 device split, all invented.
 *
 * WHY GATED RATHER THAN WIRED (the AC asks to "implement the missing
 * /api/mobile/devices endpoint"): that instruction presumes data which does not
 * exist. Nothing in this system records it —
 *   - No device/session table carries a device type for app users. The ONLY
 *     device_type column in the schema is on a knowledge-base ARTICLE VIEW table
 *     (KB readers), so using it for an app-wide device breakdown would be a
 *     different, misleading number rather than a correct one.
 *   - offlineCapability / batteryOptimization / crashRate / dataUsage are APM/RUM
 *     metrics. There is no APM or client telemetry integration to source them from,
 *     and "battery optimization %" is not derivable from the database at all.
 * Implementing the endpoint would therefore mean INVENTING the figures server-side —
 * exactly what this story exists to remove (and exactly the trap the AI-employee
 * analytics endpoint had already fallen into). So the AC's own rule applies: a page
 * with no backend gets an explicit coming-soon state instead of fixtures.
 *
 * To restore: `git log --follow` this path once real client telemetry exists.
 */
export default function MobileOptimization() {
  return (
    <MainLayout
      title="Mobile Optimization"
      description="Monitor and optimize mobile app performance for field technicians"
    >
      <ComingSoon
        title="Mobile Optimization"
        description="Monitor and optimize mobile app performance for field technicians."
        icon={Smartphone}
        storyIds={['AUDIT-015']}
        capabilities={[
          'Active mobile users and device-type breakdown',
          'App response time and data usage',
          'Offline-capability and sync health',
          'Crash rate and error reporting',
        ]}
        note="Gated because none of these metrics have a source yet: /api/mobile/metrics and /api/mobile/devices do not exist, and there is no client telemetry/APM integration to build them from. The previous version of this page silently fell back to hardcoded numbers when those calls failed."
      />
    </MainLayout>
  );
}
