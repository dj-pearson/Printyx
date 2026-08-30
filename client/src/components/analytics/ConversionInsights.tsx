/**
 * ConversionInsights — PA-040.
 *
 * This widget rendered invented funnel rates as a deal's real conversion
 * performance: 65% lead-to-qualified, 45% qualified-to-demo, 72%
 * demo-to-proposal, 38% proposal-to-won, an 8.2% overall rate, a 45-day sales
 * cycle, and four ranked loss reasons ("Price too high", 15). It is rendered
 * inside LeadDeals and CrmGoalsDashboard, both live pages.
 *
 * BOTH HOSTS SERVED THE SAME FICTION. In dev, server/analytics-routes.ts
 * answered /api/analytics/conversion-metrics with exactly that object and made
 * no database call at all (184 lines, four handlers, zero db access - deleted
 * with this change). In production the analytics edge function has no such
 * branch - it serves dashboard, sales, service and performance - so the request
 * 404'd and the component's own `select: (data) => data || {...}` supplied the
 * same numbers. The fallback was never a fallback.
 *
 * Nothing derives these rates today. Stage-to-stage conversion needs a deal's
 * movement between pipeline_stages over time, which is not recorded; loss
 * reasons need a closed-lost reason field, which deals does not have.
 *
 * The mock-driven UI (~350 lines) was removed rather than left as dead code;
 * recover it from git history when wiring the real source.
 */
import { NotConnectedState } from '@/components/ui/not-connected-state';

export const ConversionInsights: React.FC<{ dealId?: string }> = () => (
  <NotConnectedState
    title="Conversion insights"
    what="Stage-to-stage conversion rates and loss reasons need a record of how each deal moved between pipeline stages, and a reason captured when one is lost — neither is stored yet."
    storyRef="PA-040"
  />
);

export default ConversionInsights;
