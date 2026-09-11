/**
 * Platform configuration.
 *
 * Gated rather than rendered (PLATFORM-CONFIG-001). The 559 lines this replaces
 * opened with `// Mock configuration data` and drew 22 configuration sections -
 * SMTP hosts, rate limits, feature flags, retention periods - as the live
 * platform configuration, on a platform-admin-only route, with a "show
 * sensitive values" toggle beside them.
 *
 * A fabricated configuration screen is a particular kind of dangerous. Every
 * other fabrication on this platform misreports the business; this one
 * misreports the SYSTEM, to the one person who would act on it. An admin
 * reading "session timeout: 30 minutes" has no way to tell it from the real
 * setting, and the real setting is whatever it actually is - AUDIT-034 records
 * that session timeout is not enforced at all, because the middleware that
 * would do it is mounted by nothing.
 *
 * Nothing here was editable either: the toggles and inputs held local state and
 * no save path existed, so the page could not even have been describing itself.
 *
 * What a real version needs: `tenants.metadata` is the free-form config bag and
 * `GET /api/admin/settings` already serves it (the admin edge function reads
 * `metadata`, not a `settings` column, which is a trap recorded there). That is
 * tenant settings, though - a genuine PLATFORM configuration surface would need
 * a store that does not exist yet.
 */

import MainLayout from '@/components/layout/main-layout';
import { NotConnectedState } from '@/components/ui/not-connected-state';

export default function PlatformConfiguration() {
  return (
    <MainLayout
      title="Platform Configuration"
      description="Platform-wide settings and feature flags"
    >
      <NotConnectedState
        title="Platform settings"
        what="There is no platform-level configuration store to read or write. Tenant settings live in tenants.metadata and are served by /api/admin/settings; platform-wide values are held in environment variables and deployment config, which this application cannot see."
        storyRef="PLATFORM-CONFIG-001"
      />
    </MainLayout>
  );
}
