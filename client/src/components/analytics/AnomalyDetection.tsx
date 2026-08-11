/**
 * AnomalyDetection — COP-I07.
 *
 * This component rendered ENTIRELY fabricated data: it had zero useQuery /
 * apiRequest calls and never had a backend, yet it is reachable from the
 * sidebar via /advanced-analytics. Invented risk scores and metrics shown as a
 * customer's real numbers are worse than showing nothing, because a plausible
 * number gets quoted in a forecast or a QBR.
 *
 * The mock-driven UI (~500 lines of hardcoded scores) was removed rather than
 * left as dead code; recover it from git history when wiring the real source.
 */
import { NotConnectedState } from '@/components/ui/not-connected-state';

export default function AnomalyDetection() {
  return (
    <NotConnectedState
      title="Anomaly detection"
      what="Detecting unusual revenue, usage or service patterns needs a monitoring job over your real metrics — none is wired up."
      storyRef="COP-I07"
    />
  );
}
