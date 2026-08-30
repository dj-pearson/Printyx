/**
 * PipelineTrendWidgets — PA-040.
 *
 * Same defect as ConversionInsights beside it, and the same two hosts. This
 * widget drew statistical process-control charts - upper and lower control
 * limits, sigma bands, "in control" verdicts - over numbers nobody measured,
 * inside LeadDeals.
 *
 * server/analytics-routes.ts answered /api/analytics/control-charts and
 * /trend-widgets with hardcoded series and no database access (deleted with this
 * change). The analytics edge function has no branch for either, so production
 * 404'd and the component's `select: (data) => data || {...}` supplied the same
 * figures. A control chart is a claim about process stability; drawing one over
 * invented points asserts something specific and false.
 *
 * Recover the UI from git history when there is a real time series to chart.
 */
import { NotConnectedState } from '@/components/ui/not-connected-state';

export const PipelineTrendWidgets: React.FC = () => (
  <NotConnectedState
    title="Pipeline trends"
    what="Control charts and trend widgets need a stored time series of pipeline value and stage counts — nothing records one yet."
    storyRef="PA-040"
  />
);

export default PipelineTrendWidgets;
