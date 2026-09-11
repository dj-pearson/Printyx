/**
 * Customer Connect dashboard.
 *
 * Gated rather than rendered (CONNECT-DASH-001). The 760 lines this replaces
 * made no request of any kind. They asserted a 5.2% churn rate, 64% portal
 * adoption, 127 active sessions, a satisfaction score of 4.3 and an NPS of 42 -
 * and then listed three NAMED customers as at risk: Acme Corporation at 68%
 * churn probability on $2,400 MRR, Global Tech Solutions at 82% on $5,200 with
 * "Immediate outreach required", Midwest Manufacturing at 51 health. None of
 * them exists.
 *
 * That is worse than a wrong number. A named account with a churn probability
 * and a recommended action is a work item: someone schedules the executive
 * review. And the figures beside it are the same ones customer-success reports
 * as null, because nothing measures them - there is no CSAT producer at all
 * (CSAT-PRODUCER-001) and no portal-adoption signal.
 *
 * The rule this follows is the one AUDIT-016 and LEGAL-010 set, and PA-040
 * applied to the analytics widgets: delete a claim with no backing data rather
 * than fake it, and say plainly what is not measured so an absence is not read
 * as an all-clear.
 */

import MainLayout from '@/components/layout/main-layout';
import { NotConnectedState } from '@/components/ui/not-connected-state';

export default function ConnectDashboard() {
  return (
    <MainLayout title="Customer Connect" description="Portal engagement, health and churn risk">
      <NotConnectedState
        title="Connect metrics"
        what="Portal adoption, session counts, satisfaction, NPS and per-customer churn risk each need a source that does not exist yet: nothing records a portal session, and no satisfaction survey can be created, so none can be answered."
        storyRef="CONNECT-DASH-001"
      />
    </MainLayout>
  );
}
